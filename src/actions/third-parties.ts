'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { calculateDV } from '@/lib/utils/dian';

type ThirdPartyInsert = Database['public']['Tables']['third_parties']['Insert'];
type ThirdPartyUpdate = Database['public']['Tables']['third_parties']['Update'];

export async function getThirdParties(search?: string, activeOnly = true) {
    // RBAC: verificar permiso de lectura en terceros
    await enforcePermission('terceros', 'read');

    const supabase = await createClient();
    let query = supabase.from('third_parties').select('*').order('full_name');

    if (search) {
        query = query.or(`full_name.ilike.%${search}%,document_number.ilike.%${search}%`);
    }
    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function getThirdParty(id: string) {
    await enforcePermission('terceros', 'read');
    const supabase = await createClient();
    const { data, error } = await supabase.from('third_parties').select('*').eq('id', id).single();
    if (error) throw new Error('Tercero no encontrado');
    return data;
}

/** Calcula el DV automáticamente para NIT si no viene informado. */
function withComputedDv<T extends { document_type?: string; document_number?: string; dv?: number | null }>(party: T): T {
    if (party.document_type === 'NIT' && party.document_number && (party.dv === undefined || party.dv === null)) {
        return { ...party, dv: calculateDV(party.document_number) };
    }
    return party;
}

export async function createThirdParty(party: ThirdPartyInsert) {
    // RBAC: verificar permiso de escritura en terceros
    await enforcePermission('terceros', 'write');

    const supabase = await createClient();

    // Evitar duplicados por (tipo, número)
    const { data: existing } = await supabase
        .from('third_parties')
        .select('id')
        .eq('document_type', party.document_type)
        .eq('document_number', party.document_number)
        .maybeSingle();
    if (existing) {
        throw new Error(`Ya existe un tercero con ${party.document_type} ${party.document_number}.`);
    }

    const { error } = await supabase.from('third_parties').insert(withComputedDv(party));
    if (error) throw new Error(error.message);

    revalidatePath('/terceros');
    return { success: true };
}

export async function updateThirdParty(id: string, changes: ThirdPartyUpdate) {
    await enforcePermission('terceros', 'write');

    const supabase = await createClient();
    const { error } = await supabase
        .from('third_parties')
        .update({ ...withComputedDv(changes), updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw new Error(error.message);

    revalidatePath('/terceros');
    revalidatePath(`/terceros/${id}`);
    return { success: true };
}

/**
 * Inactiva un tercero. No se elimina físicamente para preservar la trazabilidad
 * histórica (facturas, asientos, cartera lo referencian).
 */
export async function deactivateThirdParty(id: string) {
    await enforcePermission('terceros', 'delete');
    const supabase = await createClient();

    const { count } = await supabase
        .from('journal_lines')
        .select('*', { count: 'exact', head: true })
        .eq('third_party_id', id);

    // Con movimiento: solo inactivar. Sin movimiento: igual inactivamos (soft-delete uniforme).
    const { error } = await supabase.from('third_parties').update({ is_active: false }).eq('id', id);
    if (error) throw new Error(error.message);

    revalidatePath('/terceros');
    return { success: true, hadMovements: (count ?? 0) > 0 };
}

export async function reactivateThirdParty(id: string) {
    await enforcePermission('terceros', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('third_parties').update({ is_active: true }).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath('/terceros');
    return { success: true };
}
