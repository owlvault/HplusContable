'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAuditLog(tableName?: string, limit: number = 50) {
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
    return data;
}

export async function logAuditEvent(
    tableName: string,
    recordId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldData?: any,
    newData?: any
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
            user_id: user?.id
        });

    if (error) console.error('Audit log error:', error);
}
