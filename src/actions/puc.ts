'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type Account = Database['public']['Tables']['puc_accounts']['Row'];
type AccountInsert = Database['public']['Tables']['puc_accounts']['Insert'];

export async function getAccounts(search?: string) {
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
    const supabase = await createClient();
    const { error } = await supabase.from('puc_accounts').insert(account);
    if (error) throw new Error(error.message);
    return { success: true };
}
