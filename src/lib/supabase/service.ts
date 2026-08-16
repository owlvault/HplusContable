import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente con rol de servicio, sin sesión de usuario.
 *
 * Lo usa únicamente la ingesta desde el CLI local, que se autentica con su
 * propio token y no tiene cookies de Supabase. Nunca debe exponerse a
 * componentes de cliente: la clave de servicio salta las políticas RLS.
 */
export function createServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            'Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY para la ingesta de ventas.'
        );
    }

    return createSupabaseClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
