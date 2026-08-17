'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { generateCufe } from '@/lib/dian/signer';

const MODULE = 'facturacion';

export interface PosLeaseRequest {
    posTerminalId: string;
    prefix: string;
    chunkSize?: number; // Default: 50
    leaseDurationHours?: number; // Default: 24h
}

export interface PosLeaseResponse {
    leaseId: string;
    posTerminalId: string;
    prefix: string;
    leasedFrom: number;
    leasedTo: number;
    currentLeasedNumber: number;
    expiresAt: string;
}

export interface OfflineSaleItem {
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    taxRate: number;
    productId?: string;
}

export interface OfflineSaleRecord {
    posTerminalId: string;
    prefix: string;
    number: number;
    thirdPartyId: string;
    date: string;
    total: number;
    subtotal: number;
    ivaAmount: number;
    items: OfflineSaleItem[];
}

/**
 * Arrienda un bloque de consecutivos para que la terminal POS pueda operar offline con cero colisiones.
 */
export async function leaseConsecutiveRange(
    req: PosLeaseRequest
): Promise<PosLeaseResponse> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const chunkSize = req.chunkSize || 50;
    const durationHours = req.leaseDurationHours || 24;
    const prefix = req.prefix || 'POS';

    // 1. Obtener consecutivo base actual
    const { data: seqData } = await supabase
        .from('document_sequences')
        .select('current_number')
        .eq('doc_type', prefix)
        .single();

    const startNumber = (seqData?.current_number || 1000) + 1;
    const endNumber = startNumber + chunkSize - 1;

    // Actualizar secuencia global
    await supabase
        .from('document_sequences')
        .upsert({ doc_type: prefix, prefix: `${prefix}-`, current_number: endNumber });

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    // 2. Registrar arriendo en pos_consecutive_leases
    const { data: lease, error } = await supabase
        .from('pos_consecutive_leases')
        .insert({
            pos_terminal_id: req.posTerminalId,
            prefix,
            leased_from: startNumber,
            leased_to: endNumber,
            current_leased_number: startNumber,
            expires_at: expiresAt,
        })
        .select()
        .single();

    if (error || !lease) {
        throw new Error(`Error al registrar arriendo de consecutivos: ${error?.message}`);
    }

    return {
        leaseId: lease.id,
        posTerminalId: lease.pos_terminal_id,
        prefix: lease.prefix,
        leasedFrom: lease.leased_from,
        leasedTo: lease.leased_to,
        currentLeasedNumber: lease.current_leased_number,
        expiresAt: lease.expires_at,
    };
}

/**
 * Sincroniza ventas realizadas offline dentro de rangos arrendados.
 */
export async function syncOfflineSalesBatch(
    sales: OfflineSaleRecord[]
): Promise<{
    syncedCount: number;
    failedCount: number;
    syncedInvoiceIds: string[];
}> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const syncedInvoiceIds: string[] = [];
    let failedCount = 0;

    for (const sale of sales) {
        try {
            const cufe = generateCufe({
                invoiceNumber: `${sale.prefix}${sale.number}`,
                issueDate: sale.date.split('T')[0],
                issueTime: '12:00:00-05:00',
                subtotal: sale.subtotal,
                ivaAmount: sale.ivaAmount,
                consumptionTax: 0,
                icaTax: 0,
                total: sale.total,
                sellerNit: '901000111',
                buyerDocument: sale.thirdPartyId,
                technicalKey: 'mock-tech-key',
                environment: '2',
            });

            // Insertar factura con is_offline_sync: true
            const { data: inv, error: invError } = await supabase
                .from('invoices')
                .insert({
                    prefix: sale.prefix,
                    number: sale.number,
                    type: 'POS',
                    date: sale.date.split('T')[0],
                    third_party_id: sale.thirdPartyId,
                    subtotal: sale.subtotal,
                    iva_19: sale.ivaAmount,
                    total: sale.total,
                    state: 'PAID',
                    dian_status: 'ISSUED_PENDING_DIAN',
                    cufe,
                    is_offline_sync: true,
                })
                .select('id')
                .single();

            if (invError || !inv) {
                failedCount++;
                continue;
            }

            syncedInvoiceIds.push(inv.id);

            // Insertar líneas con unit_cost histórico
            const lines = sale.items.map((it, idx) => ({
                invoice_id: inv.id,
                line_number: idx + 1,
                product_id: it.productId || null,
                description: it.description,
                quantity: it.quantity,
                unit_price: it.unitPrice,
                unit_cost: it.unitCost || 0,
                cogs_amount: (it.unitCost || 0) * it.quantity,
                tax_rate: it.taxRate,
                tax_amount: (it.quantity * it.unitPrice * it.taxRate) / 100,
                subtotal: it.quantity * it.unitPrice,
                total: it.quantity * it.unitPrice * (1 + it.taxRate / 100),
            }));

            await supabase.from('invoice_lines').insert(lines);

            // Despachar a Outbox
            await supabase.from('outbox_events').insert({
                aggregate_type: 'INVOICE',
                aggregate_id: inv.id,
                event_type: 'invoice.dian_emission_requested',
                payload: {
                    invoiceId: inv.id,
                    prefix: sale.prefix,
                    number: sale.number,
                    isOfflineSync: true,
                    cufe,
                    total: sale.total,
                },
                status: 'PENDING',
            });
        } catch {
            failedCount++;
        }
    }

    return {
        syncedCount: syncedInvoiceIds.length,
        failedCount,
        syncedInvoiceIds,
    };
}
