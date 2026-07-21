'use server';

import { createClient } from '@/lib/supabase/server';

export interface DueNotification {
    id: string;
    type: 'receivable' | 'payable';
    documentNumber: string;
    thirdPartyName: string;
    dueDate: string;
    amount: number;
    balance: number;
    daysUntilDue: number;
    status: 'upcoming' | 'due_today' | 'overdue';
    priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Calcula los días hasta el vencimiento (negativo si está vencido)
 */
function calculateDaysUntilDue(dueDate: string): number {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determina el estado basado en los días hasta el vencimiento
 */
function getStatus(daysUntilDue: number): DueNotification['status'] {
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue === 0) return 'due_today';
    return 'upcoming';
}

/**
 * Determina la prioridad basada en los días y el monto
 */
function getPriority(daysUntilDue: number, amount: number): DueNotification['priority'] {
    if (daysUntilDue < -30) return 'critical';
    if (daysUntilDue < 0) return 'high';
    if (daysUntilDue <= 3) return 'medium';
    return 'low';
}

/**
 * Obtiene las notificaciones de vencimiento
 * @param daysAhead - Cuántos días hacia adelante buscar (default 7)
 * @param includeOverdue - Incluir documentos vencidos (default true)
 */
export async function getDueNotifications(
    daysAhead: number = 7,
    includeOverdue: boolean = true
): Promise<DueNotification[]> {
    const supabase = await createClient();
    const notifications: DueNotification[] = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    // Obtener cuentas por cobrar pendientes
    let receivablesQuery = supabase
        .from('receivables')
        .select(`
            id,
            document_number,
            due_date,
            original_amount,
            balance,
            third_party:third_parties(full_name)
        `)
        .in('status', ['PENDING', 'PARTIAL'])
        .lte('due_date', futureDate.toISOString().split('T')[0]);
    
    if (!includeOverdue) {
        receivablesQuery = receivablesQuery.gte('due_date', today.toISOString().split('T')[0]);
    }
    
    const { data: receivables } = await receivablesQuery;
    
    if (receivables) {
        for (const r of receivables) {
            const daysUntilDue = calculateDaysUntilDue(r.due_date);
            notifications.push({
                id: r.id,
                type: 'receivable',
                documentNumber: r.document_number,
                thirdPartyName: (r.third_party as any)?.full_name || 'Desconocido',
                dueDate: r.due_date,
                amount: r.original_amount,
                balance: r.balance,
                daysUntilDue,
                status: getStatus(daysUntilDue),
                priority: getPriority(daysUntilDue, r.balance),
            });
        }
    }
    
    // Obtener cuentas por pagar pendientes
    let payablesQuery = supabase
        .from('payables')
        .select(`
            id,
            document_number,
            due_date,
            original_amount,
            balance,
            third_party:third_parties(full_name)
        `)
        .in('status', ['PENDING', 'PARTIAL'])
        .lte('due_date', futureDate.toISOString().split('T')[0]);
    
    if (!includeOverdue) {
        payablesQuery = payablesQuery.gte('due_date', today.toISOString().split('T')[0]);
    }
    
    const { data: payables } = await payablesQuery;
    
    if (payables) {
        for (const p of payables) {
            const daysUntilDue = calculateDaysUntilDue(p.due_date);
            notifications.push({
                id: p.id,
                type: 'payable',
                documentNumber: p.document_number,
                thirdPartyName: (p.third_party as any)?.full_name || 'Desconocido',
                dueDate: p.due_date,
                amount: p.original_amount,
                balance: p.balance,
                daysUntilDue,
                status: getStatus(daysUntilDue),
                priority: getPriority(daysUntilDue, p.balance),
            });
        }
    }
    
    // Ordenar por prioridad y días hasta vencimiento
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    notifications.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.daysUntilDue - b.daysUntilDue;
    });
    
    return notifications;
}

/**
 * Obtiene el resumen de notificaciones para el dashboard
 */
export async function getNotificationSummary() {
    const notifications = await getDueNotifications(7, true);
    
    return {
        total: notifications.length,
        overdue: notifications.filter(n => n.status === 'overdue').length,
        dueToday: notifications.filter(n => n.status === 'due_today').length,
        upcoming: notifications.filter(n => n.status === 'upcoming').length,
        critical: notifications.filter(n => n.priority === 'critical').length,
        totalAmountAtRisk: notifications
            .filter(n => n.status === 'overdue')
            .reduce((sum, n) => sum + n.balance, 0),
        receivablesCount: notifications.filter(n => n.type === 'receivable').length,
        payablesCount: notifications.filter(n => n.type === 'payable').length,
    };
}
