// Client-safe helpers for audit log formatting (no server actions)

export function formatAuditAction(action: string): string {
    const labels: Record<string, string> = {
        INSERT: 'Creación',
        UPDATE: 'Actualización',
        DELETE: 'Eliminación',
        APPROVE: 'Aprobación',
        CANCEL: 'Anulación',
        PAYMENT: 'Pago registrado',
    };
    return labels[action] || action;
}
