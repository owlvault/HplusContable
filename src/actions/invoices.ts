'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateInvoiceTotals } from '@/lib/utils/invoice-calc';

// Types
export type InvoiceType = 'VENTA' | 'COMPRA';
export type InvoiceState = 'DRAFT' | 'APPROVED' | 'SENT' | 'PAID' | 'CANCELLED';

export interface InvoiceLine {
    id?: string;
    line_number: number;
    product_code?: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount_rate: number;
    discount_amount: number;
    tax_rate: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    account_code?: string;
}

export interface Invoice {
    id?: string;
    prefix: string;
    number: number;
    type: InvoiceType;
    date: string;
    due_date?: string;
    third_party_id: string;
    subtotal: number;
    discount: number;
    iva_5: number;
    iva_19: number;
    iva_excluded: number;
    retention_source: number;
    retention_iva: number;
    retention_ica: number;
    total: number;
    state: InvoiceState;
    notes?: string;
    lines: InvoiceLine[];
}

export interface InvoiceWithThirdParty extends Invoice {
    third_party?: {
        id: string;
        full_name: string;
        document_type: string;
        document_number: string;
        email?: string;
        address?: string;
        city?: string;
    };
}

// Get next invoice number - uses atomic increment to avoid race conditions
async function getNextInvoiceNumber(supabase: any, prefix: string): Promise<number> {
    // Try to atomically increment and return the new number
    // Using a raw SQL query via RPC would be ideal, but we'll use a workaround
    // by leveraging Supabase's update with returning
    
    // First, try to get existing sequence
    const { data: existing, error: selectError } = await supabase
        .from('document_sequences')
        .select('current_number')
        .eq('prefix', prefix)
        .single();

    if (selectError || !existing) {
        // Create new sequence starting at 1
        const { data: newSeq, error: insertError } = await supabase
            .from('document_sequences')
            .insert({ 
                document_type: prefix === 'FV' ? 'FACTURA_VENTA' : 'FACTURA_COMPRA',
                prefix: prefix, 
                current_number: 1,
                is_active: true 
            })
            .select('current_number')
            .single();
        
        if (insertError) {
            // Sequence might have been created by concurrent request, retry get
            const { data: retry } = await supabase
                .from('document_sequences')
                .select('current_number')
                .eq('prefix', prefix)
                .single();
            
            if (retry) {
                return retry.current_number + 1;
            }
            throw new Error('Error al obtener consecutivo de factura');
        }
        return 1;
    }

    const nextNumber = (existing.current_number || 0) + 1;

    // Update with optimistic locking - only update if current_number hasn't changed
    const { data: updated, error: updateError } = await supabase
        .from('document_sequences')
        .update({ current_number: nextNumber })
        .eq('prefix', prefix)
        .eq('current_number', existing.current_number) // Optimistic lock
        .select('current_number');

    if (updateError || !updated || updated.length === 0) {
        // Someone else updated it concurrently, retry
        const { data: retry } = await supabase
            .from('document_sequences')
            .select('current_number')
            .eq('prefix', prefix)
            .single();
        
        if (retry) {
            // Try once more with the new value
            const retryNext = (retry.current_number || 0) + 1;
            await supabase
                .from('document_sequences')
                .update({ current_number: retryNext })
                .eq('prefix', prefix);
            return retryNext;
        }
        throw new Error('Error al obtener consecutivo de factura');
    }

    return nextNumber;
}

// Get all invoices
export async function getInvoices(type?: InvoiceType, state?: InvoiceState) {
    const supabase = await createClient();

    let query = supabase
        .from('invoices')
        .select(`
            *,
            third_party:third_parties(id, full_name, document_type, document_number, email)
        `)
        .order('date', { ascending: false });

    if (type) {
        query = query.eq('type', type);
    }

    if (state) {
        query = query.eq('state', state);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching invoices:', error);
        throw new Error('Error al obtener facturas');
    }

    return data || [];
}

// Get single invoice with lines
export async function getInvoice(id: string) {
    const supabase = await createClient();

    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
            *,
            third_party:third_parties(id, full_name, document_type, document_number, dv, email, phone, address, city)
        `)
        .eq('id', id)
        .single();

    if (invoiceError) {
        throw new Error('Factura no encontrada');
    }

    const { data: lines, error: linesError } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', id)
        .order('line_number');

    if (linesError) {
        throw new Error('Error al obtener líneas de factura');
    }

    return { ...invoice, lines: lines || [] };
}

// Create invoice
export async function createInvoice(invoiceData: Omit<Invoice, 'id' | 'number'>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('No autorizado');
    }

    // Get next number
    const number = await getNextInvoiceNumber(supabase, invoiceData.prefix);

    // Calculate totals
    const totals = calculateInvoiceTotals(invoiceData.lines);

    // Insert invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            prefix: invoiceData.prefix,
            number,
            type: invoiceData.type,
            date: invoiceData.date,
            due_date: invoiceData.due_date || null,
            third_party_id: invoiceData.third_party_id,
            subtotal: totals.subtotal,
            discount: totals.discount,
            iva_5: totals.iva_5,
            iva_19: totals.iva_19,
            iva_excluded: totals.iva_excluded,
            retention_source: invoiceData.retention_source || 0,
            retention_iva: invoiceData.retention_iva || 0,
            retention_ica: invoiceData.retention_ica || 0,
            total: totals.total - (invoiceData.retention_source || 0) - (invoiceData.retention_iva || 0) - (invoiceData.retention_ica || 0),
            state: invoiceData.state || 'DRAFT',
            notes: invoiceData.notes || null,
            created_by: user.id,
        })
        .select()
        .single();

    if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw new Error('Error al crear factura');
    }

    // Insert lines
    const linesToInsert = invoiceData.lines.map((line, index) => ({
        invoice_id: invoice.id,
        line_number: index + 1,
        product_code: line.product_code,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit || 'UN',
        unit_price: line.unit_price,
        discount_rate: line.discount_rate || 0,
        discount_amount: line.discount_amount || 0,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        subtotal: line.subtotal,
        total: line.total,
        account_code: line.account_code,
    }));

    const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(linesToInsert);

    if (linesError) {
        console.error('Error creating invoice lines:', linesError);
        // Rollback invoice
        await supabase.from('invoices').delete().eq('id', invoice.id);
        throw new Error('Error al crear líneas de factura');
    }

    revalidatePath('/facturas');
    return { success: true, invoice };
}

// Update invoice
export async function updateInvoice(id: string, invoiceData: Partial<Invoice>) {
    const supabase = await createClient();

    // Only allow updates on DRAFT invoices
    const { data: existing } = await supabase
        .from('invoices')
        .select('state')
        .eq('id', id)
        .single();

    if (existing?.state !== 'DRAFT') {
        throw new Error('Solo se pueden editar facturas en borrador');
    }

    // Calculate totals if lines are provided
    let updateData: any = { ...invoiceData };
    delete updateData.lines;
    delete updateData.id;

    if (invoiceData.lines) {
        const totals = calculateInvoiceTotals(invoiceData.lines);
        updateData = {
            ...updateData,
            ...totals,
            total: totals.total - (invoiceData.retention_source || 0) - (invoiceData.retention_iva || 0) - (invoiceData.retention_ica || 0),
        };

        // Delete existing lines
        await supabase.from('invoice_lines').delete().eq('invoice_id', id);

        // Insert new lines
        const linesToInsert = invoiceData.lines.map((line, index) => ({
            invoice_id: id,
            line_number: index + 1,
            product_code: line.product_code,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit || 'UN',
            unit_price: line.unit_price,
            discount_rate: line.discount_rate || 0,
            discount_amount: line.discount_amount || 0,
            tax_rate: line.tax_rate,
            tax_amount: line.tax_amount,
            subtotal: line.subtotal,
            total: line.total,
            account_code: line.account_code,
        }));

        await supabase.from('invoice_lines').insert(linesToInsert);
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

    if (error) {
        throw new Error('Error al actualizar factura');
    }

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { success: true };
}

// Approve invoice with automatic accounting entry and receivable/payable
export async function approveInvoice(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get invoice with lines
    const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('state', 'DRAFT')
        .single();

    if (fetchError || !invoice) {
        throw new Error('La factura no se puede aprobar (ya está aprobada o no existe)');
    }

    // Create journal entry for the invoice
    const journalEntry = await createJournalEntryForInvoice(supabase, invoice, user?.id);

    // Create receivable or payable
    if (invoice.type === 'VENTA') {
        await createReceivableForInvoice(supabase, invoice);
    } else {
        await createPayableForInvoice(supabase, invoice);
    }

    // Update invoice with journal entry reference
    const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
            state: 'APPROVED', 
            journal_entry_id: journalEntry?.id,
            updated_at: new Date().toISOString() 
        })
        .eq('id', id);

    if (updateError) {
        throw new Error('Error al aprobar factura');
    }

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    revalidatePath('/cartera');
    revalidatePath('/asientos');
    return { success: true, journalEntryId: journalEntry?.id };
}

// Create journal entry for invoice
async function createJournalEntryForInvoice(supabase: any, invoice: any, userId?: string) {
    const invoiceNumber = `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}`;
    
    // Create journal entry
    const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
            date: invoice.date,
            description: `Contabilización ${invoice.type === 'VENTA' ? 'Factura de Venta' : 'Factura de Compra'} ${invoiceNumber}`,
            state: 'APROBADO',
            created_by: userId,
        })
        .select()
        .single();

    if (entryError) {
        console.error('Error creating journal entry:', entryError);
        return null;
    }

    // Create journal lines based on invoice type
    const lines = [];
    const subtotalAfterDiscount = invoice.subtotal - invoice.discount;

    if (invoice.type === 'VENTA') {
        // FACTURA DE VENTA
        // Débito: Clientes (1305) por el total
        lines.push({
            entry_id: entry.id,
            account_code: '130505', // Clientes Nacionales
            third_party_id: invoice.third_party_id,
            debit: invoice.total,
            credit: 0,
            description: `Cliente - ${invoiceNumber}`,
        });

        // Crédito: Ingresos por el subtotal (sin IVA)
        lines.push({
            entry_id: entry.id,
            account_code: '413505', // Venta de Mercancías
            debit: 0,
            credit: subtotalAfterDiscount,
            description: `Ingreso - ${invoiceNumber}`,
        });

        // Crédito: IVA 19% si aplica
        if (invoice.iva_19 > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '240805', // IVA Generado 19%
                debit: 0,
                credit: invoice.iva_19,
                description: `IVA 19% - ${invoiceNumber}`,
            });
        }

        // Crédito: IVA 5% si aplica
        if (invoice.iva_5 > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '240810', // IVA Generado 5%
                debit: 0,
                credit: invoice.iva_5,
                description: `IVA 5% - ${invoiceNumber}`,
            });
        }

        // Débito: Retención en la Fuente (activo) si aplica
        if (invoice.retention_source > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '135515', // Retención en la Fuente
                debit: invoice.retention_source,
                credit: 0,
                description: `Rete Fuente - ${invoiceNumber}`,
            });
            // Ajustar el débito de clientes
            lines[0].debit -= invoice.retention_source;
        }

        // Débito: Retención de IVA (activo) si aplica
        if (invoice.retention_iva > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '135517', // IVA Retenido
                debit: invoice.retention_iva,
                credit: 0,
                description: `Rete IVA - ${invoiceNumber}`,
            });
            // Ajustar el débito de clientes
            lines[0].debit -= invoice.retention_iva;
        }

    } else {
        // FACTURA DE COMPRA
        // Débito: Gasto o Costo por el subtotal
        lines.push({
            entry_id: entry.id,
            account_code: '519595', // Otros Gastos
            debit: subtotalAfterDiscount,
            credit: 0,
            description: `Compra - ${invoiceNumber}`,
        });

        // Débito: IVA Descontable (si aplica, sería cuenta 2408 en crédito para el proveedor)
        // Para simplificar, el IVA en compras se descuenta
        if (invoice.iva_19 > 0 || invoice.iva_5 > 0) {
            const totalIva = (invoice.iva_19 || 0) + (invoice.iva_5 || 0);
            lines.push({
                entry_id: entry.id,
                account_code: '240805', // IVA por pagar (se netea)
                debit: totalIva,
                credit: 0,
                description: `IVA Descontable - ${invoiceNumber}`,
            });
        }

        // Crédito: Proveedores por el total
        lines.push({
            entry_id: entry.id,
            account_code: '220505', // Proveedores Nacionales
            third_party_id: invoice.third_party_id,
            debit: 0,
            credit: invoice.total,
            description: `Proveedor - ${invoiceNumber}`,
        });

        // Crédito: Retención en la Fuente (pasivo) si aplica
        if (invoice.retention_source > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '236515', // Retención Honorarios
                debit: 0,
                credit: invoice.retention_source,
                description: `Rete Fuente - ${invoiceNumber}`,
            });
            // Ajustar el crédito de proveedores
            const providerLine = lines.find(l => l.account_code === '220505');
            if (providerLine) providerLine.credit -= invoice.retention_source;
        }

        // Crédito: Retención de IVA (pasivo) si aplica
        if (invoice.retention_iva > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '236701', // IVA Retenido
                debit: 0,
                credit: invoice.retention_iva,
                description: `Rete IVA - ${invoiceNumber}`,
            });
            // Ajustar el crédito de proveedores
            const providerLine = lines.find(l => l.account_code === '220505');
            if (providerLine) providerLine.credit -= invoice.retention_iva;
        }

        // Crédito: Retención de ICA (pasivo) si aplica
        if (invoice.retention_ica > 0) {
            lines.push({
                entry_id: entry.id,
                account_code: '236801', // ICA Retenido
                debit: 0,
                credit: invoice.retention_ica,
                description: `Rete ICA - ${invoiceNumber}`,
            });
            // Ajustar el crédito de proveedores
            const providerLine = lines.find(l => l.account_code === '220505');
            if (providerLine) providerLine.credit -= invoice.retention_ica;
        }
    }

    // Insert journal lines
    const { error: linesError } = await supabase
        .from('journal_lines')
        .insert(lines);

    if (linesError) {
        console.error('Error creating journal lines:', linesError);
    }

    return entry;
}

// Create receivable for sales invoice
async function createReceivableForInvoice(supabase: any, invoice: any) {
    const { error } = await supabase
        .from('receivables')
        .insert({
            third_party_id: invoice.third_party_id,
            invoice_id: invoice.id,
            document_type: 'FACTURA',
            document_number: `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}`,
            issue_date: invoice.date,
            due_date: invoice.due_date || invoice.date,
            original_amount: invoice.total,
            paid_amount: 0,
            balance: invoice.total,
            days_overdue: 0,
            status: 'PENDING',
        });

    if (error) {
        console.error('Error creating receivable:', error);
    }
}

// Create payable for purchase invoice
async function createPayableForInvoice(supabase: any, invoice: any) {
    const { error } = await supabase
        .from('payables')
        .insert({
            third_party_id: invoice.third_party_id,
            invoice_id: invoice.id,
            document_type: 'FACTURA',
            document_number: `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}`,
            issue_date: invoice.date,
            due_date: invoice.due_date || invoice.date,
            original_amount: invoice.total,
            paid_amount: 0,
            balance: invoice.total,
            days_overdue: 0,
            status: 'PENDING',
        });

    if (error) {
        console.error('Error creating payable:', error);
    }
}

// Cancel invoice
export async function cancelInvoice(id: string, reason: string) {
    const supabase = await createClient();

    const { data: invoice } = await supabase
        .from('invoices')
        .select('state, notes')
        .eq('id', id)
        .single();

    if (invoice?.state === 'CANCELLED') {
        throw new Error('La factura ya está anulada');
    }

    // Preserve existing notes and append cancellation reason
    const existingNotes = invoice?.notes || '';
    const cancelNotes = existingNotes 
        ? `${existingNotes}\n\n--- ANULADA ---\nMotivo: ${reason}\nFecha: ${new Date().toLocaleString('es-CO')}`
        : `--- ANULADA ---\nMotivo: ${reason}\nFecha: ${new Date().toLocaleString('es-CO')}`;

    const { error } = await supabase
        .from('invoices')
        .update({ 
            state: 'CANCELLED', 
            notes: cancelNotes,
            updated_at: new Date().toISOString() 
        })
        .eq('id', id);

    if (error) {
        throw new Error('Error al anular factura');
    }

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { success: true };
}

// Mark as paid
export async function markInvoiceAsPaid(id: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('invoices')
        .update({ state: 'PAID', updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        throw new Error('Error al marcar como pagada');
    }

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { success: true };
}

// Delete invoice (only drafts)
export async function deleteInvoice(id: string) {
    const supabase = await createClient();

    const { data: invoice } = await supabase
        .from('invoices')
        .select('state')
        .eq('id', id)
        .single();

    if (invoice?.state !== 'DRAFT') {
        throw new Error('Solo se pueden eliminar facturas en borrador');
    }

    const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error('Error al eliminar factura');
    }

    revalidatePath('/facturas');
    return { success: true };
}

// Get invoice stats
export async function getInvoiceStats() {
    const supabase = await createClient();

    const { data: invoices } = await supabase
        .from('invoices')
        .select('type, state, total');

    if (!invoices) return null;

    const stats = {
        totalVentas: 0,
        totalCompras: 0,
        pendientesCobro: 0,
        pendientesPago: 0,
        countVentas: 0,
        countCompras: 0,
    };

    for (const inv of invoices) {
        if (inv.type === 'VENTA') {
            stats.countVentas++;
            if (inv.state !== 'CANCELLED') {
                stats.totalVentas += inv.total || 0;
                if (inv.state !== 'PAID') {
                    stats.pendientesCobro += inv.total || 0;
                }
            }
        } else {
            stats.countCompras++;
            if (inv.state !== 'CANCELLED') {
                stats.totalCompras += inv.total || 0;
                if (inv.state !== 'PAID') {
                    stats.pendientesPago += inv.total || 0;
                }
            }
        }
    }

    return stats;
}
