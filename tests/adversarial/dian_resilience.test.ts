import { describe, it, expect, beforeEach } from 'vitest';
import { DianCircuitBreaker, CircuitState } from '../../src/lib/dian/circuit-breaker';
import { DianInDoubtReconciler } from '../../src/lib/dian/in-doubt-reconciler';
import { OutboxWorker, OutboxEventRecord } from '../../src/lib/dian/outbox-worker';
import { generateCufe, generateDianQrContent } from '../../src/lib/dian/signer';

describe('Matriz Adversarial: Resiliencia DIAN y Patrón Outbox (T-01, T-02, T-09, T-10)', () => {
    let circuitBreaker: DianCircuitBreaker;

    beforeEach(() => {
        circuitBreaker = new DianCircuitBreaker({
            failureThreshold: 3,
            recoveryTimeoutMs: 50, // fast for testing
            probeTimeoutMs: 100,
        });
    });

    describe('T-01: Reconciliador In-Doubt y Prevención de Falsos Rollbacks', () => {
        it('debe reconciliar exitosamente si la DIAN ya tenía el CUFE registrado (Aceptado previamente)', async () => {
            const testCufe = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
            
            // Simular respuesta positiva de GetStatusZip ante duplicidad
            const mockChecker = async (cufe: string) => {
                expect(cufe).toBe(testCufe);
                return {
                    statusCode: '00',
                    message: 'Procesado y aceptado en fecha previa',
                    isFound: true,
                    isValid: true,
                };
            };

            const result = await DianInDoubtReconciler.reconcileStatus(testCufe, mockChecker);

            expect(result.isAccepted).toBe(true);
            expect(result.isRejected).toBe(false);
            expect(result.isContingency).toBe(false);
            expect(result.statusCode).toBe('00');
        });

        it('debe identificar errores tipo Regla 99 / Duplicado como candidatos de Reconciliación In-Doubt', () => {
            const error99 = new Error('Regla 99: El documento con prefijo FEV y número 1045 ya existe en la DIAN');
            const errorNormal = new Error('Error 400: El NIT no tiene dígito de verificación válido');

            expect(DianInDoubtReconciler.isDuplicateOrInDoubtError(error99)).toBe(true);
            expect(DianInDoubtReconciler.isDuplicateOrInDoubtError(errorNormal)).toBe(false);
        });
    });

    describe('T-02: Outbox Worker Zombie Recovery & Claim-and-Commit', () => {
        it('debe recuperar eventos huérfanos cuyo locked_until ya expiró (Zombie Recovery)', () => {
            const worker = new OutboxWorker('test-worker-1');
            const now = new Date('2026-08-17T12:00:00Z');
            const expiredLock = new Date('2026-08-17T11:55:00Z').toISOString(); // 5 min ago
            const activeLock = new Date('2026-08-17T12:05:00Z').toISOString();  // in future

            const mockEvents: OutboxEventRecord[] = [
                {
                    id: 'ev-1',
                    aggregate_type: 'INVOICE',
                    aggregate_id: 'inv-1',
                    event_type: 'invoice.dian_emission_requested',
                    payload: { invoiceId: 'inv-1' },
                    status: 'PROCESSING',
                    locked_by: 'dead-worker',
                    locked_until: expiredLock, // Expired zombie!
                    retry_count: 1,
                    max_retries: 5,
                    scheduled_for: '2026-08-17T11:00:00Z',
                    created_at: '2026-08-17T11:00:00Z',
                },
                {
                    id: 'ev-2',
                    aggregate_type: 'INVOICE',
                    aggregate_id: 'inv-2',
                    event_type: 'invoice.dian_emission_requested',
                    payload: { invoiceId: 'inv-2' },
                    status: 'PROCESSING',
                    locked_by: 'live-worker',
                    locked_until: activeLock, // Active lock
                    retry_count: 0,
                    max_retries: 5,
                    scheduled_for: '2026-08-17T11:00:00Z',
                    created_at: '2026-08-17T11:00:00Z',
                },
                {
                    id: 'ev-3',
                    aggregate_type: 'INVOICE',
                    aggregate_id: 'inv-3',
                    event_type: 'invoice.dian_emission_requested',
                    payload: { invoiceId: 'inv-3' },
                    status: 'PENDING',
                    retry_count: 0,
                    max_retries: 5,
                    scheduled_for: '2026-08-17T11:00:00Z',
                    created_at: '2026-08-17T11:00:00Z',
                },
            ];

            const claimable = worker.filterClaimableEvents(mockEvents, now);

            expect(claimable.map((e) => e.id)).toEqual(['ev-1', 'ev-3']);
            expect(claimable.find((e) => e.id === 'ev-2')).toBeUndefined();
        });

        it('debe marcar eventos como PROCESSING con nuevo lease al ser reclamados', () => {
            const worker = new OutboxWorker('worker-alpha');
            const mockEvents: OutboxEventRecord[] = [
                {
                    id: 'ev-1',
                    aggregate_type: 'INVOICE',
                    aggregate_id: 'inv-1',
                    event_type: 'invoice.dian_emission_requested',
                    payload: { invoiceId: 'inv-1' },
                    status: 'PENDING',
                    retry_count: 0,
                    max_retries: 5,
                    scheduled_for: '2026-08-17T11:00:00Z',
                    created_at: '2026-08-17T11:00:00Z',
                },
            ];

            const claimed = worker.claimEvents(mockEvents, 10, 60000);

            expect(claimed.length).toBe(1);
            expect(claimed[0].status).toBe('PROCESSING');
            expect(claimed[0].locked_by).toBe('worker-alpha');
            expect(claimed[0].locked_until).toBeDefined();
        });
    });

    describe('T-10: Circuit Breaker Distribuido y Clasificación de Errores (5xx vs 4xx)', () => {
        it('NO debe abrir el circuito ante errores 4xx semánticos del cliente', () => {
            const clientError = new Error('400 Bad Request: NIT inválido');

            for (let i = 0; i < 5; i++) {
                circuitBreaker.recordFailure(clientError);
            }

            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
            expect(circuitBreaker.canExecute()).toBe(true);
        });

        it('debe abrir el circuito (OPEN) ante fallas de infraestructura repetidas (5xx / Timeout)', () => {
            const timeoutError = new Error('ETIMEDOUT: Connection timeout to DIAN SOAP service');

            circuitBreaker.recordFailure(timeoutError);
            circuitBreaker.recordFailure(timeoutError);
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

            // 3ra falla -> supera umbral
            circuitBreaker.recordFailure(timeoutError);
            expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
            expect(circuitBreaker.canExecute()).toBe(false);
        });

        it('debe permitir solo una Sonda Canario Única en estado HALF_OPEN', async () => {
            circuitBreaker.forceState(CircuitState.OPEN, Date.now() - 100);

            // El estado debe pasar a HALF_OPEN
            expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

            // Primer intento adquiere la sonda canario
            const canary1 = circuitBreaker.canExecute();
            expect(canary1).toBe(true);

            // Segundo intento simultáneo es bloqueado (Single Canary)
            const canary2 = circuitBreaker.canExecute();
            expect(canary2).toBe(false);

            // Éxito de la sonda restablece el circuito a CLOSED
            circuitBreaker.recordSuccess();
            expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
            expect(circuitBreaker.canExecute()).toBe(true);
        });
    });

    describe('Cálculo Criptográfico de CUFE y QR DIAN', () => {
        it('debe generar un hash CUFE SHA-384 determinista y formatear el QR oficial', () => {
            const cufe = generateCufe({
                invoiceNumber: 'FEV1001',
                issueDate: '2026-08-17',
                issueTime: '10:30:00-05:00',
                subtotal: 100000,
                ivaAmount: 19000,
                consumptionTax: 0,
                icaTax: 0,
                total: 119000,
                sellerNit: '901234567',
                buyerDocument: '1020304050',
                technicalKey: 'secret_key_12345',
                environment: '2',
            });

            expect(cufe).toBeDefined();
            expect(cufe.length).toBe(96); // SHA-384 en hex tiene 96 caracteres

            const qr = generateDianQrContent({
                documentNumber: 'FEV1001',
                issueDate: '2026-08-17',
                issueTime: '10:30:00-05:00',
                sellerNit: '901234567',
                buyerDocument: '1020304050',
                ivaAmount: 19000,
                total: 119000,
                cufeOrCude: cufe,
                environment: '2',
            });

            expect(qr).toContain('NumFac: FEV1001');
            expect(qr).toContain(`CUFE: ${cufe}`);
            expect(qr).toContain('catalogo-vpfe-hab.dian.gov.co');
        });
    });
});
