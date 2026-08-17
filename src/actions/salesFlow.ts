'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { enforcePermission } from '@/lib/rbac';
import { logAuditEvent } from '@/actions/audit';
import { calculateDV } from '@/lib/utils/dian';
import { createInvoice, approveInvoice } from '@/actions/invoices';

export interface GuidedLineItem {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    taxRate: number; // 0, 5, 19
    discountRate?: number;
}

export interface GuidedSalePayload {
    client: {
        id?: string;
        documentType: 'NIT' | 'CC' | 'CE';
        documentNumber: string;
        fullName: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        taxRegime?: string;
    };
    date: string;
    dueDate?: string;
    notes?: string;
    items: GuidedLineItem[];
    // Auto-emission flag
    emitElectronicInvoiceImmediately?: boolean;
    // Immediate payment details if paying upfront
    immediatePayment?: {
        paymentMethod: string; // 'BANCO' | 'EFECTIVO' | 'TRANSFERENCIA' | 'NEQUI'
        bankAccountId?: string;
        amount: number;
        reference?: string;
        applyReteFuente?: boolean;
        applyReteIca?: boolean;
    };
}

export interface GuidedPipelineItem {
    id: string;
    code: string; // e.g. "FV-00102"
    type: 'INVOICE';
    stage: 'VENTA_BORRADOR' | 'LISTA_PARA_FACTURAR' | 'FACTURADA_PENDIENTE_PAGO' | 'PAGADA';
    clientName: string;
    clientDoc: string;
    date: string;
    dueDate?: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    paidAmount: number;
    balance: number;
    dianStatus?: string;
    invoiceId?: string;
    receivableId?: string;
    itemsCount: number;
    nextAction: {
        label: string;
        actionType: 'EMITIR_FACTURA' | 'REGISTRAR_COBRO' | 'VER_COMPROBANTE' | 'COMPLETAR_DATOS';
        color: 'blue' | 'emerald' | 'amber' | 'gray';
    };
}

export interface GuidedFlowSummary {
    pipelineItems: GuidedPipelineItem[];
    stats: {
        pendingBillingCount: number;
        pendingBillingAmount: number;
        pendingPaymentCount: number;
        pendingPaymentAmount: number;
        collectedThisMonthCount: number;
        collectedThisMonthAmount: number;
    };
    clients: Array<{
        id: string;
        fullName: string;
        documentType: string;
        documentNumber: string;
        email?: string;
        phone?: string;
        taxRegime?: string;
    }>;
    bankAccounts: Array<{
        id: string;
        bankName: string;
        accountNumber: string;
        accountType: string;
        balance: number;
    }>;
    actionCards: Array<{
        id: string;
        type: 'MISSING_CLIENT_EMAIL' | 'OVERDUE_INVOICE' | 'PENDING_DIAN_BATCH' | 'CFO_TIP';
        title: string;
        description: string;
        badgeText: string;
        actionLabel: string;
        targetId?: string;
    }>;
}

/**
 * Retorna todo el estado necesario para el Flujo Comercial Guiado
 */
export async function getGuidedFlowData(): Promise<GuidedFlowSummary> {
    const supabase = await createClient();

    // 1. Obtener Terceros Clientes
    const { data: clientsData } = await supabase
        .from('third_parties')
        .select('id, full_name, document_type, document_number, email, phone, tax_regime')
        .eq('is_client', true)
        .eq('is_active', true)
        .order('full_name');

    const clients = (clientsData || []).map((c: any) => ({
        id: c.id,
        fullName: c.full_name,
        documentType: c.document_type,
        documentNumber: c.document_number,
        email: c.email || undefined,
        phone: c.phone || undefined,
        taxRegime: c.tax_regime || 'RESPONSABLE_IVA',
    }));

    // 2. Obtener Cuentas Bancarias
    const { data: bankAccountsData } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_number, account_type, current_balance')
        .eq('is_active', true)
        .order('bank_name');

    const bankAccounts = (bankAccountsData || []).map((b: any) => ({
        id: b.id,
        bankName: b.bank_name,
        accountNumber: b.account_number,
        accountType: b.account_type,
        balance: Number(b.current_balance || 0),
    }));

    // 3. Obtener Facturas de Venta Recientes
    const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
            *,
            third_party:third_parties(id, full_name, document_type, document_number, email)
        `)
        .eq('type', 'VENTA')
        .order('created_at', { ascending: false })
        .limit(50);

    // 4. Obtener Cuentas por Cobrar (Receivables)
    const { data: receivablesData } = await supabase
        .from('receivables')
        .select('*');

    const recByInvoice = new Map<string, any>();
    (receivablesData || []).forEach((r: any) => {
        if (r.invoice_id) recByInvoice.set(r.invoice_id, r);
    });

    // 5. Construir Pipeline Unificado
    const pipelineItems: GuidedPipelineItem[] = [];
    let pendingBillingCount = 0;
    let pendingBillingAmount = 0;
    let pendingPaymentCount = 0;
    let pendingPaymentAmount = 0;
    let collectedCount = 0;
    let collectedAmount = 0;

    const actionCards: GuidedFlowSummary['actionCards'] = [];

    (invoicesData || []).forEach((inv: any) => {
        const rec = recByInvoice.get(inv.id);
        const paidAmount = rec ? Number(rec.paid_amount || 0) : (inv.state === 'PAID' ? Number(inv.total) : 0);
        const balance = rec ? Number(rec.balance) : (inv.state === 'PAID' ? 0 : Number(inv.total));
        const invoiceCode = `${inv.prefix}-${String(inv.number).padStart(5, '0')}`;

        let stage: GuidedPipelineItem['stage'] = 'FACTURADA_PENDIENTE_PAGO';
        let nextAction: GuidedPipelineItem['nextAction'] = {
            label: 'Registrar Cobro',
            actionType: 'REGISTRAR_COBRO',
            color: 'emerald',
        };

        if (inv.state === 'DRAFT') {
            stage = 'LISTA_PARA_FACTURAR';
            pendingBillingCount++;
            pendingBillingAmount += Number(inv.total);
            nextAction = {
                label: '⚡ Emitir Factura DIAN',
                actionType: 'EMITIR_FACTURA',
                color: 'blue',
            };
        } else if (inv.state === 'PAID' || balance <= 0) {
            stage = 'PAGADA';
            collectedCount++;
            collectedAmount += Number(inv.total);
            nextAction = {
                label: 'Ver Comprobante',
                actionType: 'VER_COMPROBANTE',
                color: 'gray',
            };
        } else {
            // Aprobada / Pendiente de Cobro
            stage = 'FACTURADA_PENDIENTE_PAGO';
            pendingPaymentCount++;
            pendingPaymentAmount += balance;
            nextAction = {
                label: '💵 Registrar Cobro',
                actionType: 'REGISTRAR_COBRO',
                color: 'emerald',
            };

            // Detectar facturas vencidas o sin pago
            if (inv.due_date && new Date(inv.due_date) < new Date()) {
                actionCards.push({
                    id: `overdue-${inv.id}`,
                    type: 'OVERDUE_INVOICE',
                    title: `Factura ${invoiceCode} vencida`,
                    description: `El cliente ${inv.third_party?.full_name || 'Desconocido'} tiene un saldo pendiente de $${balance.toLocaleString('es-CO')}.`,
                    badgeText: 'Cobro Prioritario',
                    actionLabel: 'Cobrar Ahora',
                    targetId: inv.id,
                });
            }
        }

        // Revisar si cliente no tiene email
        if (!inv.third_party?.email && inv.state === 'DRAFT') {
            actionCards.push({
                id: `no-email-${inv.third_party?.id}`,
                type: 'MISSING_CLIENT_EMAIL',
                title: `Falta correo de ${inv.third_party?.full_name}`,
                description: 'La DIAN requiere un correo electrónico válido para enviar la factura electrónica.',
                badgeText: 'Dato Requerido',
                actionLabel: 'Completar Correo',
                targetId: inv.third_party?.id,
            });
        }

        pipelineItems.push({
            id: inv.id,
            code: invoiceCode,
            type: 'INVOICE',
            stage,
            clientName: inv.third_party?.full_name || 'Cliente sin nombre',
            clientDoc: `${inv.third_party?.document_type || 'NIT'} ${inv.third_party?.document_number || 'S/N'}`,
            date: inv.date,
            dueDate: inv.due_date || undefined,
            subtotal: Number(inv.subtotal || 0),
            taxTotal: Number(inv.iva_19 || 0) + Number(inv.iva_5 || 0),
            total: Number(inv.total || 0),
            paidAmount,
            balance,
            dianStatus: inv.dian_status || (inv.state === 'APPROVED' ? 'Aprobada DIAN' : 'Pendiente'),
            invoiceId: inv.id,
            receivableId: rec?.id,
            itemsCount: 1,
            nextAction,
        });
    });

    // Añadir tarjeta de consejo CFO si todo está al día
    if (actionCards.length === 0) {
        actionCards.push({
            id: 'cfo-tip-1',
            type: 'CFO_TIP',
            title: 'Flujo Comercial en Orden',
            description: 'Todas tus facturas emitidas están al día y las ventas están sincronizadas con la contabilidad.',
            badgeText: 'Salud Financiera Excelente',
            actionLabel: '+ Nueva Venta',
        });
    }

    return {
        pipelineItems,
        stats: {
            pendingBillingCount,
            pendingBillingAmount,
            pendingPaymentCount,
            pendingPaymentAmount,
            collectedThisMonthCount: collectedCount,
            collectedThisMonthAmount: collectedAmount,
        },
        clients,
        bankAccounts,
        actionCards,
    };
}

/**
 * Crea una venta asistida y opcionalmente emite factura y registra cobro en 1 paso
 */
export async function createGuidedSale(payload: GuidedSalePayload) {
    await enforcePermission('ventas', 'write');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Usuario no autenticado');

    // 1. Resolver o Crear Tercero
    let clientId = payload.client.id;
    if (!clientId) {
        // Buscar por documento
        const { data: existingParty } = await supabase
            .from('third_parties')
            .select('id')
            .eq('document_type', payload.client.documentType)
            .eq('document_number', payload.client.documentNumber)
            .maybeSingle();

        if (existingParty) {
            clientId = existingParty.id;
        } else {
            // Crear nuevo cliente rápido
            const computedDv = payload.client.documentType === 'NIT' 
                ? calculateDV(payload.client.documentNumber) 
                : null;

            const { data: newParty, error: partyError } = await supabase
                .from('third_parties')
                .insert({
                    document_type: payload.client.documentType,
                    document_number: payload.client.documentNumber,
                    dv: computedDv,
                    full_name: payload.client.fullName,
                    email: payload.client.email || null,
                    phone: payload.client.phone || null,
                    address: payload.client.address || null,
                    city: payload.client.city || 'Bogotá',
                    is_client: true,
                    is_provider: false,
                    is_employee: false,
                    tax_regime: payload.client.taxRegime || 'RESPONSABLE_IVA',
                    is_active: true,
                })
                .select('id')
                .single();

            if (partyError) {
                console.error('Error creating client:', partyError);
                throw new Error(`Error al registrar cliente: ${partyError.message}`);
            }
            clientId = newParty.id;
        }
    }

    // 2. Calcular Totales con desglose exacto
    let subtotal = 0;
    let discount = 0;
    let iva_19 = 0;
    let iva_5 = 0;
    let iva_excluded = 0;

    const invoiceLines = payload.items.map((item, idx) => {
        const lineSubtotal = item.quantity * item.unitPrice;
        const lineDiscount = lineSubtotal * ((item.discountRate || 0) / 100);
        const taxable = lineSubtotal - lineDiscount;
        let lineTax = 0;

        if (item.taxRate === 19) {
            lineTax = taxable * 0.19;
            iva_19 += lineTax;
        } else if (item.taxRate === 5) {
            lineTax = taxable * 0.05;
            iva_5 += lineTax;
        } else {
            iva_excluded += taxable;
        }

        subtotal += lineSubtotal;
        discount += lineDiscount;

        const lineTotal = taxable + lineTax;

        return {
            line_number: idx + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'UN',
            unit_price: item.unitPrice,
            discount_rate: item.discountRate || 0,
            discount_amount: Math.round(lineDiscount * 100) / 100,
            tax_rate: item.taxRate,
            tax_amount: Math.round(lineTax * 100) / 100,
            subtotal: Math.round(taxable * 100) / 100,
            total: Math.round(lineTotal * 100) / 100,
            account_code: '413505',
        };
    });

    const taxTotal = iva_19 + iva_5;
    const totalAmount = (subtotal - discount) + taxTotal;

    // 3. Crear Factura
    const invoiceResult = await createInvoice({
        prefix: 'FV',
        type: 'VENTA',
        date: payload.date || new Date().toISOString().split('T')[0],
        due_date: payload.dueDate || payload.date,
        third_party_id: clientId!,
        notes: payload.notes || 'Venta asistida creada desde el Centro de Operaciones',
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        iva_5: Math.round(iva_5 * 100) / 100,
        iva_19: Math.round(iva_19 * 100) / 100,
        iva_excluded: Math.round(iva_excluded * 100) / 100,
        retention_source: 0,
        retention_iva: 0,
        retention_ica: 0,
        total: Math.round(totalAmount * 100) / 100,
        state: 'DRAFT',
        lines: invoiceLines,
    });

    const createdInvoice = invoiceResult.invoice;

    // 4. Si se solicitó emitir inmediatamente
    if (payload.emitElectronicInvoiceImmediately && createdInvoice?.id) {
        await approveInvoice(createdInvoice.id);

        // 5. Si además se registró pago inmediato
        if (payload.immediatePayment && payload.immediatePayment.amount > 0) {
            await quickRegisterPayment({
                invoiceId: createdInvoice.id,
                amount: payload.immediatePayment.amount,
                paymentDate: payload.date || new Date().toISOString().split('T')[0],
                paymentMethod: payload.immediatePayment.paymentMethod,
                bankAccountId: payload.immediatePayment.bankAccountId,
                reference: payload.immediatePayment.reference,
            });
        }
    }

    revalidatePath('/ventas');
    revalidatePath('/facturas');
    revalidatePath('/dashboard');
    revalidatePath('/cartera');

    return {
        success: true,
        invoiceId: createdInvoice?.id,
        invoiceNumber: createdInvoice?.number,
    };
}

/**
 * 1-Click: Emite la factura electrónica a la DIAN, genera el asiento contable y la cartera
 */
export async function quickEmitInvoice(invoiceId: string) {
    await enforcePermission('facturas', 'approve');
    const res = await approveInvoice(invoiceId);
    
    revalidatePath('/ventas');
    revalidatePath('/facturas');
    revalidatePath('/dashboard');
    revalidatePath('/cartera');
    
    return res;
}

/**
 * 1-Click: Registra el cobro de una factura sin requerir conocimientos de débito/crédito
 */
export async function quickRegisterPayment(params: {
    invoiceId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    bankAccountId?: string;
    reference?: string;
    retentionSource?: number;
    retentionIca?: number;
}) {
    await enforcePermission('cartera', 'write');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Obtener Factura y Cuenta por Cobrar
    const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('*, third_party:third_parties(id, full_name)')
        .eq('id', params.invoiceId)
        .single();

    if (invError || !invoice) throw new Error('Factura no encontrada');

    const { data: receivable, error: recError } = await supabase
        .from('receivables')
        .select('*')
        .eq('invoice_id', params.invoiceId)
        .maybeSingle();

    const invoiceNumber = `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}`;
    const reteFuente = params.retentionSource || 0;
    const reteIca = params.retentionIca || 0;
    const netReceived = params.amount - (reteFuente + reteIca);

    // 2. Crear Asiento Contable Automático de Recibo de Caja
    const { data: paymentEntry, error: entryErr } = await supabase
        .from('journal_entries')
        .insert({
            date: params.paymentDate,
            description: `Recibo de Caja - Cobro Factura ${invoiceNumber} (${invoice.third_party?.full_name})`,
            state: 'APROBADO',
            created_by: user?.id,
        })
        .select()
        .single();

    if (paymentEntry) {
        const lines: any[] = [];
        
        // Débito: Caja o Bancos por el valor neto recibido
        const accountCode = params.paymentMethod === 'EFECTIVO' ? '110505' : '111005';
        lines.push({
            entry_id: paymentEntry.id,
            account_code: accountCode,
            third_party_id: invoice.third_party_id,
            debit: netReceived > 0 ? netReceived : params.amount,
            credit: 0,
            description: `Cobro en ${params.paymentMethod} - ${invoiceNumber}`,
        });

        // Débito: ReteFuente si aplica
        if (reteFuente > 0) {
            lines.push({
                entry_id: paymentEntry.id,
                account_code: '135515', // Anticipo de Impuestos Retención en la Fuente
                third_party_id: invoice.third_party_id,
                debit: reteFuente,
                credit: 0,
                description: `ReteFuente 2.5% - ${invoiceNumber}`,
            });
        }

        // Débito: ReteICA si aplica
        if (reteIca > 0) {
            lines.push({
                entry_id: paymentEntry.id,
                account_code: '135518', // Anticipo ReteICA
                third_party_id: invoice.third_party_id,
                debit: reteIca,
                credit: 0,
                description: `ReteICA - ${invoiceNumber}`,
            });
        }

        // Crédito: Clientes Nacionales (130505) por el total liquidado
        lines.push({
            entry_id: paymentEntry.id,
            account_code: '130505',
            third_party_id: invoice.third_party_id,
            debit: 0,
            credit: params.amount,
            description: `Cancelación Cartera Cliente - ${invoiceNumber}`,
        });

        await supabase.from('journal_lines').insert(lines);
    }

    // 3. Actualizar Cartera / Receivable
    if (receivable) {
        const newPaid = Number(receivable.paid_amount || 0) + params.amount;
        const newBalance = Math.max(0, Number(receivable.original_amount) - newPaid);
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

        await supabase
            .from('receivables')
            .update({
                paid_amount: newPaid,
                balance: newBalance,
                status: newStatus,
            })
            .eq('id', receivable.id);

        // Registrar detalle en receivable_payments
        await supabase
            .from('receivable_payments')
            .insert({
                receivable_id: receivable.id,
                payment_date: params.paymentDate,
                amount: params.amount,
                payment_method: params.paymentMethod,
                reference: params.reference || `Cobro rápido ${invoiceNumber}`,
            });

        // Si la cartera quedó en 0, marcar la factura como PAID
        if (newBalance <= 0) {
            await supabase
                .from('invoices')
                .update({ state: 'PAID' })
                .eq('id', params.invoiceId);
        }
    } else {
        // Si no había registro de cartera explícito, marcar factura como pagada directamente
        await supabase
            .from('invoices')
            .update({ state: 'PAID' })
            .eq('id', params.invoiceId);
    }

    // 4. Si se especificó cuenta bancaria, registrar movimiento bancario
    if (params.bankAccountId) {
        await supabase
            .from('bank_movements')
            .insert({
                bank_account_id: params.bankAccountId,
                movement_date: params.paymentDate,
                movement_type: 'CREDITO', // Depósito en la cuenta bancaria
                amount: netReceived > 0 ? netReceived : params.amount,
                description: `Cobro Factura ${invoiceNumber} - ${invoice.third_party?.full_name}`,
                reference: params.reference || invoiceNumber,
                is_reconciled: false,
            });
    }

    // 5. Auditoría
    await logAuditEvent(
        'receivables',
        params.invoiceId,
        'UPDATE',
        { status: 'PENDING' },
        { status: 'PAID', amount: params.amount },
        `Cobro rápido de $${params.amount.toLocaleString('es-CO')} registrado para Factura ${invoiceNumber}`
    );

    revalidatePath('/ventas');
    revalidatePath('/facturas');
    revalidatePath('/dashboard');
    revalidatePath('/cartera');
    revalidatePath('/tesoreria');

    return { success: true };
}
