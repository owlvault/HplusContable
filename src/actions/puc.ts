'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { enforcePermission } from '@/lib/rbac';

type AccountInsert = Database['public']['Tables']['puc_accounts']['Insert'];

export async function getAccounts(search?: string) {
    // RBAC: verificar permiso de lectura en PUC
    await enforcePermission('puc', 'read');
    
    const supabase = await createClient();
    let query = supabase.from('puc_accounts').select('*').order('code');

    if (search) {
        query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function createAccount(account: AccountInsert) {
    // RBAC: verificar permiso de escritura en PUC
    await enforcePermission('puc', 'write');
    
    const supabase = await createClient();
    const { error } = await supabase.from('puc_accounts').insert(account);
    if (error) throw new Error(error.message);
    return { success: true };
}
