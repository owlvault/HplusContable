'use server';

import { createClient } from '@/lib/supabase/server';

export type Permission = 'read' | 'write' | 'delete' | 'approve';

interface RBACResult {
    allowed: boolean;
    userId?: string;
    error?: string;
}

/**
 * Verifica si el usuario actual tiene permiso para realizar una acción en un módulo
 * @param module - Identificador del módulo (puc, terceros, facturas, etc.)
 * @param action - Tipo de acción (read, write, delete, approve)
 * @returns Resultado con estado y usuario
 */
export async function requirePermission(module: string, action: Permission): Promise<RBACResult> {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { allowed: false, error: 'Usuario no autenticado' };
    }
    
    // Verificar si el usuario tiene roles asignados
    const { data: assignments, error: assignError } = await supabase
        .from('user_role_assignments')
        .select('role_id')
        .eq('user_id', user.id);
    
    // Si no tiene roles asignados, es probablemente el primer usuario (admin)
    // Dar acceso completo temporalmente
    if (!assignments || assignments.length === 0) {
        return { allowed: true, userId: user.id };
    }
    
    // Verificar permisos del módulo
    const roleIds = assignments.map(a => a.role_id);
    
    const { data: permissions, error: permError } = await supabase
        .from('role_permissions')
        .select('can_read, can_write, can_delete, can_approve')
        .in('role_id', roleIds)
        .eq('module', module);
    
    if (permError || !permissions || permissions.length === 0) {
        // Si no hay permisos específicos, denegar
        return { allowed: false, userId: user.id, error: 'Sin permisos para este módulo' };
    }
    
    // Agregar permisos (OR de todos los roles)
    const hasPermission = permissions.some(p => {
        switch (action) {
            case 'read': return p.can_read;
            case 'write': return p.can_write;
            case 'delete': return p.can_delete;
            case 'approve': return p.can_approve;
            default: return false;
        }
    });
    
    if (!hasPermission) {
        return { 
            allowed: false, 
            userId: user.id, 
            error: `No tiene permiso de ${action} en ${module}` 
        };
    }
    
    return { allowed: true, userId: user.id };
}

/**
 * Wrapper para proteger Server Actions con RBAC
 * @throws Error si no tiene permiso
 */
export async function enforcePermission(module: string, action: Permission): Promise<string> {
    const result = await requirePermission(module, action);
    
    if (!result.allowed) {
        throw new Error(result.error || 'Acceso denegado');
    }
    
    return result.userId!;
}

/**
 * Asigna el rol de Administrador al usuario actual si no tiene ningún rol
 */
export async function ensureAdminRoleForCurrentUser(): Promise<void> {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Verificar si ya tiene roles
    const { data: existingRoles } = await supabase
        .from('user_role_assignments')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
    
    if (existingRoles && existingRoles.length > 0) {
        return; // Ya tiene roles
    }
    
    // Obtener el rol de Administrador
    const { data: adminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'Administrador')
        .single();
    
    if (!adminRole) {
        console.error('Rol Administrador no encontrado');
        return;
    }
    
    // Asignar rol de Administrador
    const { error } = await supabase
        .from('user_role_assignments')
        .insert({
            user_id: user.id,
            role_id: adminRole.id,
            assigned_by: user.id,
        });
    
    if (error) {
        console.error('Error asignando rol admin:', error);
    }
}
