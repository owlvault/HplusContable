'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { generateCufe } from '@/lib/dian/signer';

const MODULE = 'facturacion';

export interface Contingency03Item {
    paperNumber: number;
    prefix: string; // 'TC'
    physicalIssuedAt: string; // Fecha física en que se emitió en papel
    thirdPartyId: string;
    subtotal: number;
    ivaAmount: number;
    total: number;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
    }>;
}

export interface IngestContingencyResult {
    ingestedCount: number;
    errorsCount: number;
    createdInvoiceIds: string[];
}

/**
 * Ingesta por lote de Facturas de Contingencia del Emisor (Tipo 03 - Talonario de Papel 'TC').
 * Registra la fecha física histórica y programa la transmisión UBL 03 dentro del plazo de 48h.
 */
export async function ingestContingency03Batch(
    items: Contingency03Item[]
): Promise<IngestContingencyResult> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const createdInvoiceIds: string[] = [];
    let errorsCount = 0;

    for (const item of items) {
        try {
            const prefix = item.prefix || 'TC';
            const cufe = generateCufe({
                invoiceNumber: `${prefix}${item.paperNumber}`,
                issueDate: item.physicalIssuedAt.split('T')[0],
                issueTime: '12:00:00-05:00',
                subtotal: item.subtotal,
                ivaAmount: item.ivaAmount,
                consumptionTax: 0,
                icaTax: 0,
                total: item.total,
                sellerNit: '901000111',
                buyerDocument: item.thirdPartyId,
                technicalKey: 'mock-tech-key',
                environment: '2',
            });

            // 1. Insertar Factura
            const { data: inv, error: invError } = await supabase
                .from('invoices')
                .insert({
                    prefix,
                    number: item.paperNumber,
                    type: 'CONTINGENCIA_03',
                    date: item.physicalIssuedAt.split('T')[0],
                    physical_issued_at: item.physicalIssuedAt,
                    third_party_id: item.thirdPartyId,
                    subtotal: item.subtotal,
                    iva_19: item.ivaAmount,
                    total: item.total,
                    state: 'APPROVED',
                    dian_status: 'ISSUED_PENDING_DIAN',
                    cufe,
                })
                .select('id')
                .single();

            if (invError || !inv) {
                errorsCount++;
                continue;
            }

            createdInvoiceIds.push(inv.id);

            // 2. Insertar Líneas
            const lines = item.items.map((line, idx) => ({
                invoice_id: inv.id,
                line_number: idx + 1,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unitPrice,
                tax_rate: line.taxRate,
                tax_amount: (line.quantity * line.unitPrice * line.taxRate) / 100,
                subtotal: line.quantity * line.unitPrice,
                total: line.quantity * line.unitPrice * (1 + line.taxRate / 100),
            }));

            await supabase.from('invoice_lines').insert(lines);

            // 3. Registrar en Outbox para transmisión con UBL 03
            await supabase.from('outbox_events').insert({
                aggregate_type: 'INVOICE',
                aggregate_id: inv.id,
                event_type: 'invoice.dian_emission_requested',
                payload: {
                    invoiceId: inv.id,
                    prefix,
                    number: item.paperNumber,
                    isContingency03: true,
                    physicalIssuedAt: item.physicalIssuedAt,
                    cufe,
                    total: item.total,
                },
                status: 'PENDING',
            });
        } catch {
            errorsCount++;
        }
    }

    revalidatePath('/invoices');

    return {
        ingestedCount: createdInvoiceIds.length,
        errorsCount,
        createdInvoiceIds,
    };
}

/**
 * Obtiene las facturas emitidas bajo Contingencia DIAN Tipo 04 pendientes de sincronización.
 */
export async function getContingency04Invoices() {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('dian_status', 'CONTINGENCY_04')
        .order('date', { ascending: false });

    if (error) throw new Error(`Error al consultar facturas en contingencia: ${error.message}`);
    return data || [];
}
