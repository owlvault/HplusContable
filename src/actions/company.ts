'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { calculateDV } from '@/lib/utils/dian';

type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type CompanyUpdate = Database['public']['Tables']['company_settings']['Update'];

/**
 * Mapa de cuentas contables por defecto. Centraliza los códigos PUC que el
 * sistema usa para contabilizar automáticamente, en vez de tenerlos hardcodeados.
 */
export interface DefaultAccounts {
    caja?: string;
    bancos?: string;
    clientes?: string;
    proveedores?: string;
    iva_generado?: string;       // 240805
    iva_descontable?: string;    // 240810
    retefuente_practicada?: string;   // pasivo 2365xx
    retefuente_sufrida?: string;      // activo 135515
    reteiva_practicada?: string;      // 2367
    reteiva_sufrida?: string;
    reteica_practicada?: string;      // 2368
    ingresos_ventas?: string;
    utilidad_ejercicio?: string;      // 3605
    perdida_ejercicio?: string;       // 3610
    ganancias_perdidas?: string;      // 590505 cierre
    [key: string]: string | undefined;
}

export async function getCompanySettings(): Promise<CompanySettings> {
    await enforcePermission('configuracion', 'read');
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('singleton', true)
        .single();
    if (error) throw new Error('No se encontró la configuración de la empresa. Ejecute la migración 0003.');
    return data;
}

export async function getDefaultAccounts(): Promise<DefaultAccounts> {
    const settings = await getCompanySettings();
    return (settings.default_accounts as DefaultAccounts) || {};
}

export async function updateCompanySettings(changes: CompanyUpdate) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();

    // Recalcular DV si cambió el NIT y no se informó explícitamente
    if (changes.nit && (changes.dv === undefined || changes.dv === null)) {
        changes.dv = calculateDV(changes.nit);
    }

    const { error } = await supabase
        .from('company_settings')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('singleton', true);
    if (error) throw new Error(error.message);

    revalidatePath('/configuracion');
    return { success: true };
}

export async function updateDefaultAccounts(accounts: DefaultAccounts) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();
    const { error } = await supabase
        .from('company_settings')
        .update({ default_accounts: accounts, updated_at: new Date().toISOString() })
        .eq('singleton', true);
    if (error) throw new Error(error.message);
    revalidatePath('/configuracion');
    return { success: true };
}
