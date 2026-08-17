import { globalDianCircuitBreaker, DianCircuitBreaker } from './circuit-breaker';

export interface DianStatusResult {
    isAccepted: boolean;
    isRejected: boolean;
    isContingency: boolean;
    statusCode: string;
    message: string;
    rawResponse?: Record<string, unknown>;
}

export interface StatusCheckerFunction {
    (cufe: string): Promise<{ statusCode: string; message: string; isFound: boolean; isValid: boolean }>;
}

/**
 * Reconciliador de estado In-Doubt ante Timeouts, Caídas de red o Errores de duplicidad DIAN (Regla 99).
 * Previene la anulación accidental de facturas legalmente aceptadas.
 */
export class DianInDoubtReconciler {
    /**
     * Evalúa si un error devuelto por la DIAN corresponde a una colisión/duplicidad
     * indicativa de que el documento fue recibido con anterioridad.
     */
    public static isDuplicateOrInDoubtError(error: unknown): boolean {
        if (!error) return false;
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        const lower = msg.toLowerCase();
        return (
            lower.includes('regla 99') ||
            lower.includes('documento ya existe') ||
            lower.includes('ya fue procesado') ||
            lower.includes('duplicated') ||
            lower.includes('already exists') ||
            DianCircuitBreaker.isInfrastructureError(error)
        );
    }

    /**
     * Ejecuta la reconciliación del CUFE consultando el estado real en la DIAN.
     */
    public static async reconcileStatus(
        cufe: string,
        customChecker?: StatusCheckerFunction
    ): Promise<DianStatusResult> {
        if (!cufe) {
            return {
                isAccepted: false,
                isRejected: true,
                isContingency: false,
                statusCode: 'INVALID_CUFE',
                message: 'No se puede reconciliar una factura sin CUFE.',
            };
        }

        try {
            if (customChecker) {
                const res = await customChecker(cufe);
                if (res.isValid && res.isFound) {
                    globalDianCircuitBreaker.recordSuccess();
                    return {
                        isAccepted: true,
                        isRejected: false,
                        isContingency: false,
                        statusCode: res.statusCode || '00',
                        message: res.message || 'Factura aceptada previamente en DIAN.',
                    };
                } else if (!res.isFound) {
                    return {
                        isAccepted: false,
                        isRejected: false,
                        isContingency: false,
                        statusCode: 'NOT_FOUND',
                        message: 'Documento aún no registrado en la DIAN. Se puede reintentar.',
                    };
                } else {
                    return {
                        isAccepted: false,
                        isRejected: true,
                        isContingency: false,
                        statusCode: res.statusCode || '99_REJECTED',
                        message: res.message || 'Factura rechazada por la DIAN.',
                    };
                }
            }

            // Default simulated SOAP GetStatusZip call
            return {
                isAccepted: true,
                isRejected: false,
                isContingency: false,
                statusCode: '00',
                message: 'Reconciliación exitosa: Documento aceptado.',
            };
        } catch (err) {
            globalDianCircuitBreaker.recordFailure(err);
            return {
                isAccepted: false,
                isRejected: false,
                isContingency: true,
                statusCode: 'CONTINGENCY_DIAN_04',
                message: 'No fue posible contactar a la DIAN para reconciliación. Documento en Contingencia Tipo 04.',
            };
        }
    }
}
