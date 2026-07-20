'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

// Calculate invoice totals
export function calculateInvoiceTotals(lines: Omit<InvoiceLine, 'id'>[]): {
    subtotal: number;
    discount: number;
    iva_5: number;
    iva_19: number;
    iva_excluded: number;
    total: number;
} {
    let subtotal = 0;
    let discount = 0;
    let iva_5 = 0;
    let iva_19 = 0;
    let iva_excluded = 0;

    for (const line of lines) {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * (line.discount_rate / 100);
        const taxableAmount = lineSubtotal - lineDiscount;
        
        subtotal += lineSubtotal;
        discount += lineDiscount;

        if (line.tax_rate === 5) {
            iva_5 += taxableAmount * 0.05;
        } else if (line.tax_rate === 19) {
            iva_19 += taxableAmount * 0.19;
        } else {
            iva_excluded += taxableAmount;
        }
    }

    const total = subtotal - discount + iva_5 + iva_19;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        iva_5: Math.round(iva_5 * 100) / 100,
        iva_19: Math.round(iva_19 * 100) / 100,
        iva_excluded: Math.round(iva_excluded * 100) / 100,
        total: Math.round(total * 100) / 100,
    };
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
            due_date: invoiceData.due_date,
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
            notes: invoiceData.notes,
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

// Approve invoice
export async function approveInvoice(id: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('invoices')
        .update({ state: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('state', 'DRAFT')
        .select();

    if (error) {
        throw new Error('Error al aprobar factura');
    }

    if (!data || data.length === 0) {
        throw new Error('La factura no se puede aprobar (ya está aprobada o no existe)');
    }

    revalidatePath('/facturas');
    revalidatePath(`/facturas/${id}`);
    return { success: true };
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
