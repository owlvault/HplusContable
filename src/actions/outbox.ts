'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { OutboxWorker, OutboxEventRecord } from '@/lib/dian/outbox-worker';

const MODULE = 'facturacion';

/**
 * Obtiene los eventos en cola Outbox.
 */
export async function getOutboxEvents(status?: string): Promise<OutboxEventRecord[]> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    let query = supabase
        .from('outbox_events')
        .select('*')
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Error al consultar outbox: ${error.message}`);
    return (data || []) as OutboxEventRecord[];
}

/**
 * Dispara un ciclo de procesamiento de Outbox (Claim-and-Commit).
 */
export async function processOutboxBatch(batchSize: number = 10): Promise<{
    processed: number;
    accepted: number;
    failed: number;
    contingency: number;
    dlq: number;
}> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    // 1. Obtener eventos pendientes o fallidos
    const { data: rawEvents, error: pollError } = await supabase
        .from('outbox_events')
        .select('*')
        .in('status', ['PENDING', 'FAILED', 'PROCESSING'])
        .order('created_at', { ascending: true })
        .limit(batchSize * 2);

    if (pollError || !rawEvents || rawEvents.length === 0) {
        return { processed: 0, accepted: 0, failed: 0, contingency: 0, dlq: 0 };
    }

    const worker = new OutboxWorker();
    const claimedEvents = worker.claimEvents(rawEvents as OutboxEventRecord[], batchSize);

    if (claimedEvents.length === 0) {
        return { processed: 0, accepted: 0, failed: 0, contingency: 0, dlq: 0 };
    }

    // Actualizar estado de reclamo en BD
    for (const ev of claimedEvents) {
        await supabase
            .from('outbox_events')
            .update({
                status: ev.status,
                locked_by: ev.locked_by,
                locked_until: ev.locked_until,
                retry_count: ev.retry_count,
            })
            .eq('id', ev.id);
    }

    let accepted = 0;
    let failed = 0;
    let contingency = 0;
    let dlq = 0;

    // Procesar cada evento reclamado
    for (const ev of claimedEvents) {
        const result = await worker.processSingleEvent(ev);

        if (result.action === 'ACCEPT') {
            accepted++;
            await supabase
                .from('outbox_events')
                .update({
                    status: 'COMPLETED',
                    processed_at: new Date().toISOString(),
                    locked_by: null,
                    locked_until: null,
                })
                .eq('id', ev.id);

            // Actualizar factura o nota crédito
            if (ev.aggregate_type === 'INVOICE') {
                await supabase
                    .from('invoices')
                    .update({
                        dian_status: 'DIAN_ACCEPTED',
                        cufe: (result.metadata?.cufe as string) || null,
                        qr_content: (result.metadata?.qrContent as string) || null,
                    })
                    .eq('id', ev.aggregate_id);
            }
        } else if (result.action === 'CONTINGENCY') {
            contingency++;
            if (ev.aggregate_type === 'INVOICE') {
                await supabase
                    .from('invoices')
                    .update({ dian_status: 'CONTINGENCY_04' })
                    .eq('id', ev.aggregate_id);
            }
        } else if (result.action === 'DLQ') {
            dlq++;
            await supabase
                .from('outbox_events')
                .update({
                    status: 'DLQ',
                    last_error: result.updatedEvent.last_error,
                    locked_by: null,
                    locked_until: null,
                })
                .eq('id', ev.id);

            await supabase
                .from('dead_letter_events')
                .insert({
                    outbox_event_id: ev.id,
                    aggregate_type: ev.aggregate_type,
                    aggregate_id: ev.aggregate_id,
                    event_type: ev.event_type,
                    payload: ev.payload,
                    failure_reason: result.updatedEvent.last_error || 'Max retries exceeded',
                });
        } else {
            failed++;
            await supabase
                .from('outbox_events')
                .update({
                    status: 'FAILED',
                    retry_count: result.updatedEvent.retry_count,
                    last_error: result.updatedEvent.last_error,
                    locked_by: null,
                    locked_until: null,
                })
                .eq('id', ev.id);
        }
    }

    return {
        processed: claimedEvents.length,
        accepted,
        failed,
        contingency,
        dlq,
    };
}

/**
 * Reintenta un evento desde la Dead Letter Queue (DLQ Replay).
 */
export async function replayDeadLetterEvent(dlqId: string): Promise<boolean> {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const { data: dlqItem, error } = await supabase
        .from('dead_letter_events')
        .select('*')
        .eq('id', dlqId)
        .single();

    if (error || !dlqItem) throw new Error('Evento DLQ no encontrado');

    // Reactivar en outbox_events
    if (dlqItem.outbox_event_id) {
        await supabase
            .from('outbox_events')
            .update({
                status: 'PENDING',
                retry_count: 0,
                last_error: null,
                scheduled_for: new Date().toISOString(),
            })
            .eq('id', dlqItem.outbox_event_id);
    }

    await supabase
        .from('dead_letter_events')
        .update({
            replayed_at: new Date().toISOString(),
            resolution_notes: 'Replayed manually by administrator',
        })
        .eq('id', dlqId);

    return true;
}
