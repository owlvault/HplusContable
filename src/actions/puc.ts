'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';

type AccountInsert = Database['public']['Tables']['puc_accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['puc_accounts']['Update'];

export async function getAccounts(search?: string, activeOnly = false) {
    // RBAC: verificar permiso de lectura en PUC
    await enforcePermission('puc', 'read');

    const supabase = await createClient();
    let query = supabase.from('puc_accounts').select('*').order('code');

    if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function getAccount(code: string) {
    await enforcePermission('puc', 'read');
    const supabase = await createClient();
    const { data, error } = await supabase.from('puc_accounts').select('*').eq('code', code).single();
    if (error) throw new Error('Cuenta no encontrada');
    return data;
}

/**
 * Valida la coherencia de una cuenta del PUC:
 * - El nivel debe corresponder a la longitud del código (1=clase..6=auxiliar).
 * - Si tiene padre, el código debe empezar por el código del padre.
 */
async function validateAccountHierarchy(account: AccountInsert | AccountUpdate & { code?: string }) {
    const code = account.code;
    if (!code) return;

    // Longitud típica del PUC colombiano: 1,2,4,6,8+ dígitos
    const expectedLevelByLen: Record<number, number> = { 1: 1, 2: 2, 4: 3, 6: 4 };
    const expected = expectedLevelByLen[code.length];
    if (expected && account.level && account.level !== expected) {
        throw new Error(`El nivel (${account.level}) no corresponde a la longitud del código ${code} (esperado ${expected}).`);
    }

    if (account.parent_code) {
        if (!code.startsWith(account.parent_code)) {
            throw new Error(`El código ${code} no pertenece a la cuenta padre ${account.parent_code}.`);
        }
        const supabase = await createClient();
        const { data: parent } = await supabase
            .from('puc_accounts')
            .select('code')
            .eq('code', account.parent_code)
            .maybeSingle();
        if (!parent) {
            throw new Error(`La cuenta padre ${account.parent_code} no existe.`);
        }
    }
}

export async function createAccount(account: AccountInsert) {
    // RBAC: verificar permiso de escritura en PUC
    await enforcePermission('puc', 'write');
    await validateAccountHierarchy(account);

    const supabase = await createClient();

    const { data: existing } = await supabase
        .from('puc_accounts')
        .select('code')
        .eq('code', account.code)
        .maybeSingle();
    if (existing) {
        throw new Error(`Ya existe una cuenta con el código ${account.code}.`);
    }

    const { error } = await supabase.from('puc_accounts').insert(account);
    if (error) throw new Error(error.message);

    revalidatePath('/puc');
    return { success: true };
}

export async function updateAccount(code: string, changes: AccountUpdate) {
    await enforcePermission('puc', 'write');

    // No se permite cambiar el código (rompería referencias). Solo atributos.
    const { code: _ignore, ...safeChanges } = changes;
    await validateAccountHierarchy({ ...safeChanges, code });

    const supabase = await createClient();
    const { error } = await supabase.from('puc_accounts').update(safeChanges).eq('code', code);
    if (error) throw new Error(error.message);

    revalidatePath('/puc');
    return { success: true };
}

/**
 * Inactiva una cuenta. Bloquea si tiene movimiento contable o cuentas hijas activas
 * (no se elimina físicamente para preservar la integridad histórica).
 */
export async function deactivateAccount(code: string) {
    await enforcePermission('puc', 'delete');
    const supabase = await createClient();

    // ¿Tiene movimiento en asientos?
    const { count: lineCount } = await supabase
        .from('journal_lines')
        .select('*', { count: 'exact', head: true })
        .eq('account_code', code);
    if (lineCount && lineCount > 0) {
        throw new Error('La cuenta tiene movimientos contables y no puede inactivarse. Use un cierre en su lugar.');
    }

    // ¿Tiene hijas activas?
    const { count: childCount } = await supabase
        .from('puc_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('parent_code', code)
        .eq('is_active', true);
    if (childCount && childCount > 0) {
        throw new Error('La cuenta tiene subcuentas activas. Inactive primero las subcuentas.');
    }

    const { error } = await supabase.from('puc_accounts').update({ is_active: false }).eq('code', code);
    if (error) throw new Error(error.message);

    revalidatePath('/puc');
    return { success: true };
}

export async function reactivateAccount(code: string) {
    await enforcePermission('puc', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('puc_accounts').update({ is_active: true }).eq('code', code);
    if (error) throw new Error(error.message);
    revalidatePath('/puc');
    return { success: true };
}

/**
 * Importación masiva de cuentas (p. ej. cargar el PUC oficial).
 * Inserta en lote, ignorando las que ya existen (upsert por código).
 */
export async function importAccounts(accounts: AccountInsert[]) {
    await enforcePermission('puc', 'write');
    if (!accounts.length) return { success: true, inserted: 0 };

    const supabase = await createClient();
    const { error, count } = await supabase
        .from('puc_accounts')
        .upsert(accounts, { onConflict: 'code', ignoreDuplicates: true, count: 'exact' });
    if (error) throw new Error(error.message);

    revalidatePath('/puc');
    return { success: true, inserted: count ?? accounts.length };
}
