'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type ThirdParty = Database['public']['Tables']['third_parties']['Row'];
type ThirdPartyInsert = Database['public']['Tables']['third_parties']['Insert'];

export async function getThirdParties(search?: string) {
    const supabase = await createClient();
    let query = supabase.from('third_parties').select('*').order('full_name');

    if (search) {
        query = query.or(`full_name.ilike.%${search}%,document_number.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function createThirdParty(party: ThirdPartyInsert) {
    const supabase = await createClient();
    const { error } = await supabase.from('third_parties').insert(party);
    if (error) throw new Error(error.message);
    return { success: true };
}
