'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface Receivable {
    id: string;
    third_party_id: string;
    invoice_id?: string;
    document_type: string;
    document_number: string;
    issue_date: string;
    due_date: string;
    original_amount: number;
    paid_amount: number;
    balance: number;
    days_overdue: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'WRITTEN_OFF';
    third_party?: {
        full_name: string;
        document_number: string;
    };
    invoice?: {
        prefix: string;
        number: number;
    };
}

export interface Payable {
    id: string;
    third_party_id: string;
    invoice_id?: string;
    document_type: string;
    document_number: string;
    issue_date: string;
    due_date: string;
    original_amount: number;
    paid_amount: number;
    balance: number;
    days_overdue: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID';
    third_party?: {
        full_name: string;
        document_number: string;
    };
    invoice?: {
        prefix: string;
        number: number;
    };
}

export interface AgingBucket {
    range: string;
    count: number;
    total: number;
}

export interface CarteraStats {
    totalReceivables: number;
    totalPayables: number;
    overdueReceivables: number;
    overduePayables: number;
    receivablesCount: number;
    payablesCount: number;
    agingReceivables: AgingBucket[];
    agingPayables: AgingBucket[];
}

// Calculate days overdue
function calculateDaysOverdue(dueDate: string): number {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

// Get aging bucket
function getAgingBucket(daysOverdue: number): string {
    if (daysOverdue === 0) return 'Corriente';
    if (daysOverdue <= 30) return '1-30 días';
    if (daysOverdue <= 60) return '31-60 días';
    if (daysOverdue <= 90) return '61-90 días';
    return 'Más de 90 días';
}

// Get all receivables (cuentas por cobrar)
export async function getReceivables(status?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('receivables')
        .select(`
            *,
            third_party:third_parties(full_name, document_number),
            invoice:invoices(prefix, number)
        `)
        .order('due_date', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching receivables:', error);
        throw new Error('Error al obtener cuentas por cobrar');
    }

    // Update days_overdue for each receivable
    const receivables = (data || []).map(r => ({
        ...r,
        days_overdue: calculateDaysOverdue(r.due_date),
    }));

    return receivables;
}

// Get all payables (cuentas por pagar)
export async function getPayables(status?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('payables')
        .select(`
            *,
            third_party:third_parties(full_name, document_number),
            invoice:invoices(prefix, number)
        `)
        .order('due_date', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching payables:', error);
        throw new Error('Error al obtener cuentas por pagar');
    }

    // Update days_overdue for each payable
    const payables = (data || []).map(p => ({
        ...p,
        days_overdue: calculateDaysOverdue(p.due_date),
    }));

    return payables;
}

// Get cartera statistics
export async function getCarteraStats(): Promise<CarteraStats> {
    const [receivables, payables] = await Promise.all([
        getReceivables(),
        getPayables(),
    ]);

    // Calculate totals
    let totalReceivables = 0;
    let totalPayables = 0;
    let overdueReceivables = 0;
    let overduePayables = 0;

    // Aging buckets
    const agingReceivablesMap: Record<string, { count: number; total: number }> = {
        'Corriente': { count: 0, total: 0 },
        '1-30 días': { count: 0, total: 0 },
        '31-60 días': { count: 0, total: 0 },
        '61-90 días': { count: 0, total: 0 },
        'Más de 90 días': { count: 0, total: 0 },
    };

    const agingPayablesMap: Record<string, { count: number; total: number }> = {
        'Corriente': { count: 0, total: 0 },
        '1-30 días': { count: 0, total: 0 },
        '31-60 días': { count: 0, total: 0 },
        '61-90 días': { count: 0, total: 0 },
        'Más de 90 días': { count: 0, total: 0 },
    };

    // Process receivables
    for (const r of receivables) {
        if (r.status !== 'PAID' && r.status !== 'WRITTEN_OFF') {
            totalReceivables += r.balance;
            if (r.days_overdue > 0) {
                overdueReceivables += r.balance;
            }
            const bucket = getAgingBucket(r.days_overdue);
            agingReceivablesMap[bucket].count++;
            agingReceivablesMap[bucket].total += r.balance;
        }
    }

    // Process payables
    for (const p of payables) {
        if (p.status !== 'PAID') {
            totalPayables += p.balance;
            if (p.days_overdue > 0) {
                overduePayables += p.balance;
            }
            const bucket = getAgingBucket(p.days_overdue);
            agingPayablesMap[bucket].count++;
            agingPayablesMap[bucket].total += p.balance;
        }
    }

    return {
        totalReceivables,
        totalPayables,
        overdueReceivables,
        overduePayables,
        receivablesCount: receivables.filter(r => r.status !== 'PAID' && r.status !== 'WRITTEN_OFF').length,
        payablesCount: payables.filter(p => p.status !== 'PAID').length,
        agingReceivables: Object.entries(agingReceivablesMap).map(([range, data]) => ({
            range,
            count: data.count,
            total: data.total,
        })),
        agingPayables: Object.entries(agingPayablesMap).map(([range, data]) => ({
            range,
            count: data.count,
            total: data.total,
        })),
    };
}

// Create receivable from invoice
export async function createReceivableFromInvoice(invoiceId: string) {
    const supabase = await createClient();

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (invoiceError || !invoice) {
        throw new Error('Factura no encontrada');
    }

    if (invoice.type !== 'VENTA') {
        throw new Error('Solo se pueden crear cuentas por cobrar de facturas de venta');
    }

    // Check if receivable already exists
    const { data: existing } = await supabase
        .from('receivables')
        .select('id')
        .eq('invoice_id', invoiceId)
        .single();

    if (existing) {
        return { success: true, message: 'La cuenta por cobrar ya existe' };
    }

    // Create receivable
    const { error } = await supabase
        .from('receivables')
        .insert({
            third_party_id: invoice.third_party_id,
            invoice_id: invoiceId,
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
        throw new Error('Error al crear cuenta por cobrar');
    }

    revalidatePath('/cartera');
    return { success: true };
}

// Create payable from invoice
export async function createPayableFromInvoice(invoiceId: string) {
    const supabase = await createClient();

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (invoiceError || !invoice) {
        throw new Error('Factura no encontrada');
    }

    if (invoice.type !== 'COMPRA') {
        throw new Error('Solo se pueden crear cuentas por pagar de facturas de compra');
    }

    // Check if payable already exists
    const { data: existing } = await supabase
        .from('payables')
        .select('id')
        .eq('invoice_id', invoiceId)
        .single();

    if (existing) {
        return { success: true, message: 'La cuenta por pagar ya existe' };
    }

    // Create payable
    const { error } = await supabase
        .from('payables')
        .insert({
            third_party_id: invoice.third_party_id,
            invoice_id: invoiceId,
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
        throw new Error('Error al crear cuenta por pagar');
    }

    revalidatePath('/cartera');
    return { success: true };
}

// Register payment for receivable
export async function registerReceivablePayment(
    receivableId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    reference?: string
) {
    const supabase = await createClient();

    // Get current receivable
    const { data: receivable, error: fetchError } = await supabase
        .from('receivables')
        .select('*')
        .eq('id', receivableId)
        .single();

    if (fetchError || !receivable) {
        throw new Error('Cuenta por cobrar no encontrada');
    }

    if (amount > receivable.balance) {
        throw new Error('El monto del pago excede el saldo pendiente');
    }

    const newPaidAmount = receivable.paid_amount + amount;
    const newBalance = receivable.original_amount - newPaidAmount;
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

    // Update receivable
    const { error: updateError } = await supabase
        .from('receivables')
        .update({
            paid_amount: newPaidAmount,
            balance: newBalance,
            status: newStatus,
        })
        .eq('id', receivableId);

    if (updateError) {
        throw new Error('Error al actualizar cuenta por cobrar');
    }

    // Register payment
    const { error: paymentError } = await supabase
        .from('receivable_payments')
        .insert({
            receivable_id: receivableId,
            payment_date: paymentDate,
            amount: amount,
            payment_method: paymentMethod,
            reference: reference,
        });

    if (paymentError) {
        console.error('Error registering payment:', paymentError);
    }

    revalidatePath('/cartera');
    return { success: true };
}

// Register payment for payable
export async function registerPayablePayment(
    payableId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    reference?: string
) {
    const supabase = await createClient();

    // Get current payable
    const { data: payable, error: fetchError } = await supabase
        .from('payables')
        .select('*')
        .eq('id', payableId)
        .single();

    if (fetchError || !payable) {
        throw new Error('Cuenta por pagar no encontrada');
    }

    if (amount > payable.balance) {
        throw new Error('El monto del pago excede el saldo pendiente');
    }

    const newPaidAmount = payable.paid_amount + amount;
    const newBalance = payable.original_amount - newPaidAmount;
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

    // Update payable
    const { error: updateError } = await supabase
        .from('payables')
        .update({
            paid_amount: newPaidAmount,
            balance: newBalance,
            status: newStatus,
        })
        .eq('id', payableId);

    if (updateError) {
        throw new Error('Error al actualizar cuenta por pagar');
    }

    // Register payment
    const { error: paymentError } = await supabase
        .from('payable_payments')
        .insert({
            payable_id: payableId,
            payment_date: paymentDate,
            amount: amount,
            payment_method: paymentMethod,
            reference: reference,
        });

    if (paymentError) {
        console.error('Error registering payment:', paymentError);
    }

    revalidatePath('/cartera');
    return { success: true };
}

// Get overdue alerts
export async function getOverdueAlerts() {
    const [receivables, payables] = await Promise.all([
        getReceivables(),
        getPayables(),
    ]);

    const alerts = [];

    // Receivables alerts
    for (const r of receivables) {
        if (r.status !== 'PAID' && r.status !== 'WRITTEN_OFF' && r.days_overdue > 0) {
            alerts.push({
                type: 'receivable' as const,
                id: r.id,
                documentNumber: r.document_number,
                thirdParty: r.third_party?.full_name || 'Desconocido',
                amount: r.balance,
                daysOverdue: r.days_overdue,
                severity: r.days_overdue > 90 ? 'critical' : r.days_overdue > 60 ? 'high' : r.days_overdue > 30 ? 'medium' : 'low',
            });
        }
    }

    // Payables alerts
    for (const p of payables) {
        if (p.status !== 'PAID' && p.days_overdue > 0) {
            alerts.push({
                type: 'payable' as const,
                id: p.id,
                documentNumber: p.document_number,
                thirdParty: p.third_party?.full_name || 'Desconocido',
                amount: p.balance,
                daysOverdue: p.days_overdue,
                severity: p.days_overdue > 90 ? 'critical' : p.days_overdue > 60 ? 'high' : p.days_overdue > 30 ? 'medium' : 'low',
            });
        }
    }

    // Sort by days overdue (most overdue first)
    alerts.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return alerts;
}
