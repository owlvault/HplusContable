import { globalDianCircuitBreaker, DianCircuitBreaker, CircuitState } from './circuit-breaker';
import { DianInDoubtReconciler } from './in-doubt-reconciler';
import { generateCufe, generateDianQrContent } from './signer';

export interface OutboxEventRecord {
    id: string;
    organization_id?: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    headers?: Record<string, unknown>;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DLQ';
    retry_count: number;
    max_retries: number;
    scheduled_for: string;
    locked_by?: string | null;
    locked_until?: string | null;
    last_error?: string | null;
    created_at: string;
    processed_at?: string | null;
}

export interface WorkerProcessingResult {
    processedCount: number;
    acceptedCount: number;
    contingencyCount: number;
    failedCount: number;
    dlqCount: number;
}

export interface ExternalDianSender {
    (payload: Record<string, unknown>): Promise<{
        success: boolean;
        dianResponseCode: string;
        dianMessage: string;
        cufe?: string;
        qrContent?: string;
        xmlUrl?: string;
    }>;
}

/**
 * Worker Asíncrono de Procesamiento de Outbox con Patrón Claim-and-Commit (2 Fases).
 * Garantiza cero conexiones de BD retenidas durante llamadas HTTP/SOAP externas.
 */
export class OutboxWorker {
    private workerId: string;

    constructor(workerId: string = `worker-${Math.random().toString(36).substring(2, 9)}`) {
        this.workerId = workerId;
    }

    /**
     * Filtra los eventos que pueden ser reclamados (pendientes, reintentos o zombies expirados).
     */
    public filterClaimableEvents(events: OutboxEventRecord[], now: Date = new Date()): OutboxEventRecord[] {
        const nowMs = now.getTime();
        return events.filter((ev) => {
            if (ev.status === 'COMPLETED' || ev.status === 'DLQ') {
                return false;
            }

            const schedMs = new Date(ev.scheduled_for).getTime();
            if (schedMs > nowMs) {
                return false; // Scheduled for future
            }

            if (ev.status === 'PENDING' || ev.status === 'FAILED') {
                return true;
            }

            if (ev.status === 'PROCESSING') {
                // Check if lock expired (Zombie event recovery)
                if (ev.locked_until) {
                    const lockExpMs = new Date(ev.locked_until).getTime();
                    return lockExpMs < nowMs;
                }
                return false;
            }

            return false;
        });
    }

    /**
     * Paso 1: Reclama un lote de eventos marcándolos como PROCESSING con lease de 2 minutos.
     */
    public claimEvents(
        events: OutboxEventRecord[],
        limit: number = 10,
        leaseDurationMs: number = 120000
    ): OutboxEventRecord[] {
        const claimable = this.filterClaimableEvents(events);
        const batch = claimable.slice(0, limit);
        const now = new Date();
        const lockedUntil = new Date(now.getTime() + leaseDurationMs).toISOString();

        return batch.map((ev) => ({
            ...ev,
            status: 'PROCESSING',
            locked_by: this.workerId,
            locked_until: lockedUntil,
            retry_count: ev.status === 'FAILED' ? ev.retry_count + 1 : ev.retry_count,
        }));
    }

    /**
     * Paso 2 y 3: Procesa un evento reclamado fuera de BD y consolida el resultado.
     */
    public async processSingleEvent(
        event: OutboxEventRecord,
        externalSender?: ExternalDianSender
    ): Promise<{
        updatedEvent: OutboxEventRecord;
        action: 'ACCEPT' | 'CONTINGENCY' | 'RETRY' | 'DLQ';
        metadata?: Record<string, unknown>;
    }> {
        // Verificar estado del Circuit Breaker
        if (!globalDianCircuitBreaker.canExecute()) {
            // Circuit Breaker OPEN -> Activar Contingencia Tipo 04
            return {
                updatedEvent: {
                    ...event,
                    status: 'PROCESSING',
                    last_error: 'Circuit Breaker OPEN: Servidores DIAN no disponibles. Fallback Contingencia 04.',
                },
                action: 'CONTINGENCY',
                metadata: {
                    contingencyType: '04',
                    reason: 'DIAN_CIRCUIT_OPEN',
                },
            };
        }

        try {
            if (externalSender) {
                const res = await externalSender(event.payload);

                if (res.success) {
                    globalDianCircuitBreaker.recordSuccess();
                    return {
                        updatedEvent: {
                            ...event,
                            status: 'COMPLETED',
                            processed_at: new Date().toISOString(),
                            locked_by: null,
                            locked_until: null,
                        },
                        action: 'ACCEPT',
                        metadata: {
                            cufe: res.cufe,
                            qrContent: res.qrContent,
                            xmlUrl: res.xmlUrl,
                            dianMessage: res.dianMessage,
                        },
                    };
                } else {
                    // DIAN returned explicit business rejection or error
                    if (DianInDoubtReconciler.isDuplicateOrInDoubtError(new Error(res.dianMessage))) {
                        // Reconcile in-doubt
                        const cufe = (event.payload.cufe as string) || '';
                        const reconcResult = await DianInDoubtReconciler.reconcileStatus(cufe);

                        if (reconcResult.isAccepted) {
                            return {
                                updatedEvent: {
                                    ...event,
                                    status: 'COMPLETED',
                                    processed_at: new Date().toISOString(),
                                },
                                action: 'ACCEPT',
                                metadata: { cufe, message: reconcResult.message },
                            };
                        }
                    }

                    // Check retry count vs max_retries
                    const currentRetries = event.retry_count + 1;
                    if (currentRetries >= event.max_retries) {
                        return {
                            updatedEvent: {
                                ...event,
                                status: 'DLQ',
                                retry_count: currentRetries,
                                last_error: res.dianMessage,
                                locked_by: null,
                                locked_until: null,
                            },
                            action: 'DLQ',
                            metadata: { failureReason: res.dianMessage },
                        };
                    }

                    return {
                        updatedEvent: {
                            ...event,
                            status: 'FAILED',
                            retry_count: currentRetries,
                            last_error: res.dianMessage,
                            locked_by: null,
                            locked_until: null,
                        },
                        action: 'RETRY',
                        metadata: { error: res.dianMessage },
                    };
                }
            }

            // Default simulated local processing
            const cufe = generateCufe({
                invoiceNumber: (event.payload.number as string) || '1',
                issueDate: (event.payload.date as string) || '2026-01-01',
                issueTime: '12:00:00-05:00',
                subtotal: Number(event.payload.subtotal) || 100000,
                ivaAmount: Number(event.payload.iva) || 19000,
                consumptionTax: 0,
                icaTax: 0,
                total: Number(event.payload.total) || 119000,
                sellerNit: (event.payload.sellerNit as string) || '901000111',
                buyerDocument: (event.payload.buyerDocument as string) || '222222222',
                technicalKey: 'mock-tech-key',
                environment: '2',
            });

            const qrContent = generateDianQrContent({
                documentNumber: (event.payload.number as string) || '1',
                issueDate: (event.payload.date as string) || '2026-01-01',
                issueTime: '12:00:00-05:00',
                sellerNit: (event.payload.sellerNit as string) || '901000111',
                buyerDocument: (event.payload.buyerDocument as string) || '222222222',
                ivaAmount: Number(event.payload.iva) || 19000,
                total: Number(event.payload.total) || 119000,
                cufeOrCude: cufe,
                environment: '2',
            });

            return {
                updatedEvent: {
                    ...event,
                    status: 'COMPLETED',
                    processed_at: new Date().toISOString(),
                    locked_by: null,
                    locked_until: null,
                },
                action: 'ACCEPT',
                metadata: { cufe, qrContent },
            };
        } catch (error) {
            globalDianCircuitBreaker.recordFailure(error);
            const isInfra = DianCircuitBreaker.isInfrastructureError(error);

            if (isInfra && globalDianCircuitBreaker.getState() === CircuitState.OPEN) {
                return {
                    updatedEvent: {
                        ...event,
                        status: 'PROCESSING',
                        last_error: `Falla de infraestructura: ${error instanceof Error ? error.message : String(error)}`,
                    },
                    action: 'CONTINGENCY',
                    metadata: { contingencyType: '04' },
                };
            }

            const currentRetries = event.retry_count + 1;
            if (currentRetries >= event.max_retries) {
                return {
                    updatedEvent: {
                        ...event,
                        status: 'DLQ',
                        retry_count: currentRetries,
                        last_error: error instanceof Error ? error.message : String(error),
                    },
                    action: 'DLQ',
                };
            }

            return {
                updatedEvent: {
                    ...event,
                    status: 'FAILED',
                    retry_count: currentRetries,
                    last_error: error instanceof Error ? error.message : String(error),
                },
                action: 'RETRY',
            };
        }
    }
}
