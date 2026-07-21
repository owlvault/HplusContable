'use server';

import { createClient } from '@/lib/supabase/server';

export interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    old_data?: Record<string, any>;
    new_data?: Record<string, any>;
    user_id?: string;
    user_email?: string;
    description?: string;
    created_at: string;
}

export async function getAuditLog(tableName?: string, limit: number = 50): Promise<AuditLog[]> {
    const supabase = await createClient();

    let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (tableName) {
        query = query.eq('table_name', tableName);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getRecordHistory(recordId: string): Promise<AuditLog[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return [];
    return data || [];
}

export async function logAuditEvent(
    tableName: string,
    recordId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'CANCEL' | 'PAYMENT',
    oldData?: any,
    newData?: any,
    description?: string
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('audit_log')
        .insert({
            table_name: tableName,
            record_id: recordId,
            action,
            old_data: oldData,
            new_data: newData,
            user_id: user?.id,
            user_email: user?.email,
            description: description,
        });

    if (error) console.error('Audit log error:', error);
}

