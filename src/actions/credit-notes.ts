'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { generateCude } from '@/lib/dian/signer';

const MODULE = 'facturacion';

export type DianCreditNoteConcept = '1' | '2' | '3' | '4' | '5';

export interface CreateCreditNoteLineInput {
    productId?: string;
    productCode?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    historicalUnitCost: number; // Costo histórico congelado
    taxRate: number;
}

export interface CreateCreditNoteInput {
    invoiceId: string;
    dianConceptCode: DianCreditNoteConcept;
    notes?: string;
    lines: CreateCreditNoteLineInput[];
}

export interface CreditNoteResult {
    id: string;
    prefix: string;
    number: number;
    cude: string;
    total: number;
    journalEntryId?: string;
    restockedItemsCount: number;
}

/**
 * Emite una Nota Crédito respetando la Matriz Normativa DIAN y Kardex Congelado:
 * - Conceptos 1 y 2: Restock en Kardex con costo histórico congelado (`historical_unit_cost`).
 * - Conceptos 3 y 4: CERO RESTOCK de inventario (solo ajuste financiero y tributario).
 */
export async function createCreditNote(input: CreateCreditNoteInput): Promise<CreditNoteResult> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    // 1. Validar existencia de factura original
    const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('*, invoice_lines(*)')
        .eq('id', input.invoiceId)
        .single();

    if (invError || !invoice) {
        throw new Error('Factura original no encontrada para emitir Nota Crédito');
    }

    // 2. Determinar si requiere restock según concepto DIAN
    // Concepto 3 (Rebaja/Descuento) y 4 (Ajuste de precio) -> CERO RESTOCK
    const shouldRestock = input.dianConceptCode === '1' || input.dianConceptCode === '2';

    // 3. Calcular totales
    let subtotal = 0;
    let taxAmount = 0;
    let totalCogsReversal = 0;

    const formattedLines = input.lines.map((line, idx) => {
        const lineSubtotal = line.quantity * line.unitPrice;
        const lineTax = (lineSubtotal * line.taxRate) / 100;
        const lineCogs = line.quantity * (line.historicalUnitCost || 0);

        subtotal += lineSubtotal;
        taxAmount += lineTax;
        if (shouldRestock) {
            totalCogsReversal += lineCogs;
        }

        return {
            line_number: idx + 1,
            product_id: line.productId || null,
            product_code: line.productCode || null,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            historical_unit_cost: line.historicalUnitCost || 0,
            tax_rate: line.taxRate,
            tax_amount: lineTax,
            subtotal: lineSubtotal,
            total: lineSubtotal + lineTax,
            restock_inventory: shouldRestock,
        };
    });

    const total = subtotal + taxAmount;
    const prefix = 'NC';

    // 4. Obtener consecutivo
    const { data: seqData } = await supabase
        .from('document_sequences')
        .select('current_number')
        .eq('doc_type', 'NC')
        .single();

    const currentNumber = (seqData?.current_number || 0) + 1;

    await supabase
        .from('document_sequences')
        .upsert({ doc_type: 'NC', prefix: 'NC-', current_number: currentNumber });

    // 5. Calcular CUDE
    const cude = generateCude({
        documentNumber: `NC-${currentNumber}`,
        issueDate: new Date().toISOString().split('T')[0],
        issueTime: '12:00:00-05:00',
        subtotal,
        ivaAmount: taxAmount,
        consumptionTax: 0,
        icaTax: 0,
        total,
        sellerNit: '901000111',
        buyerDocument: invoice.third_party_id || '222222222',
        softwarePin: '12345',
        environment: '2',
    });

    // 6. Generar Asiento Contable Balanceado (Partida Doble)
    const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
            date: new Date().toISOString(),
            description: `Nota Crédito NC-${currentNumber} a Factura ${invoice.prefix || ''}${invoice.number} (Concepto ${input.dianConceptCode})`,
            state: 'APROBADO',
        })
        .select()
        .single();

    if (journalError || !journalEntry) {
        throw new Error(`Error creando asiento de Nota Crédito: ${journalError?.message}`);
    }

    const journalLines: Array<{
        entry_id: string;
        account_code: string;
        third_party_id: string;
        debit: number;
        credit: number;
        description: string;
    }> = [];

    // Débito 4175 (Devoluciones y rebajas en ventas)
    journalLines.push({
        entry_id: journalEntry.id,
        account_code: '417505',
        third_party_id: invoice.third_party_id,
        debit: subtotal,
        credit: 0,
        description: 'Devolución / Descuento en ventas',
    });

    // Débito 2408 (IVA generado descontable en devolución)
    if (taxAmount > 0) {
        journalLines.push({
            entry_id: journalEntry.id,
            account_code: '240801',
            third_party_id: invoice.third_party_id,
            debit: taxAmount,
            credit: 0,
            description: 'IVA en Nota Crédito',
        });
    }

    // Crédito 1305 (Cuentas por cobrar clientes)
    journalLines.push({
        entry_id: journalEntry.id,
        account_code: '130505',
        third_party_id: invoice.third_party_id,
        debit: 0,
        credit: total,
        description: 'Ajuste de cartera por Nota Crédito',
    });

    // Reversión de Costo de Ventas e Inventario si aplica restock (@ costo histórico congelado)
    if (shouldRestock && totalCogsReversal > 0) {
        // Débito 1435 (Inventario / Mercancías no fabricadas por la empresa)
        journalLines.push({
            entry_id: journalEntry.id,
            account_code: '143505',
            third_party_id: invoice.third_party_id,
            debit: totalCogsReversal,
            credit: 0,
            description: 'Reingreso a inventario @ costo histórico congelado',
        });

        // Crédito 6135 (Costo de ventas)
        journalLines.push({
            entry_id: journalEntry.id,
            account_code: '613505',
            third_party_id: invoice.third_party_id,
            debit: 0,
            credit: totalCogsReversal,
            description: 'Reversión costo de ventas @ costo histórico congelado',
        });
    }

    await supabase.from('journal_lines').insert(journalLines);

    // 7. Insertar Nota Crédito y Líneas
    const { data: creditNote, error: cnError } = await supabase
        .from('credit_notes')
        .insert({
            invoice_id: invoice.id,
            prefix,
            number: currentNumber,
            dian_concept_code: input.dianConceptCode,
            third_party_id: invoice.third_party_id,
            subtotal,
            tax_amount: taxAmount,
            total,
            cude,
            journal_entry_id: journalEntry.id,
            state: 'APPROVED',
            dian_status: 'ISSUED_PENDING_DIAN',
            notes: input.notes,
        })
        .select()
        .single();

    if (cnError || !creditNote) {
        throw new Error(`Error guardando Nota Crédito: ${cnError?.message}`);
    }

    const linesToInsert = formattedLines.map((l) => ({
        ...l,
        credit_note_id: creditNote.id,
    }));

    await supabase.from('credit_note_lines').insert(linesToInsert);

    // 8. Despachar a Outbox
    await supabase.from('outbox_events').insert({
        aggregate_type: 'CREDIT_NOTE',
        aggregate_id: creditNote.id,
        event_type: 'credit_note.dian_emission_requested',
        payload: {
            creditNoteId: creditNote.id,
            prefix,
            number: currentNumber,
            cude,
            total,
            dianConceptCode: input.dianConceptCode,
        },
        status: 'PENDING',
    });

    revalidatePath('/invoices');
    revalidatePath('/accounting');

    return {
        id: creditNote.id,
        prefix,
        number: currentNumber,
        cude,
        total,
        journalEntryId: journalEntry.id,
        restockedItemsCount: shouldRestock ? input.lines.length : 0,
    };
}
