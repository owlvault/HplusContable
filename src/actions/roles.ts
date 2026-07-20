'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { MODULES } from '@/lib/modules';

export interface Role {
    id: string;
    name: string;
    description: string | null;
    is_system_role: boolean;
    created_at: string;
}

export interface RolePermission {
    id: string;
    role_id: string;
    module: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    can_approve: boolean;
}

export interface UserRoleAssignment {
    id: string;
    user_id: string;
    role_id: string;
    assigned_at: string;
    role?: Role;
    user?: {
        id: string;
        email: string;
    };
}

export interface UserPermissions {
    module: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    can_approve: boolean;
}

// Get all roles
export async function getRoles(): Promise<Role[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error fetching roles:', error);
        return [];
    }
    
    return data || [];
}

// Get role with permissions
export async function getRoleWithPermissions(roleId: string) {
    const supabase = await createClient();
    
    const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', roleId)
        .single();
    
    if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
    }
    
    const { data: permissions, error: permError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId);
    
    if (permError) {
        console.error('Error fetching permissions:', permError);
    }
    
    return { ...role, permissions: permissions || [] };
}

// Create role
export async function createRole(name: string, description: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('user_roles')
        .insert({ name, description, is_system_role: false })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating role:', error);
        throw new Error('Error al crear rol');
    }
    
    // Create default permissions (all false)
    const defaultPermissions = MODULES.map(m => ({
        role_id: data.id,
        module: m.id,
        can_read: false,
        can_write: false,
        can_delete: false,
        can_approve: false,
    }));
    
    await supabase.from('role_permissions').insert(defaultPermissions);
    
    revalidatePath('/usuarios');
    return data;
}

// Update role
export async function updateRole(id: string, name: string, description: string) {
    const supabase = await createClient();
    
    // Check if it's a system role
    const { data: existing } = await supabase
        .from('user_roles')
        .select('is_system_role')
        .eq('id', id)
        .single();
    
    if (existing?.is_system_role) {
        throw new Error('No se pueden modificar roles del sistema');
    }
    
    const { error } = await supabase
        .from('user_roles')
        .update({ name, description })
        .eq('id', id);
    
    if (error) {
        console.error('Error updating role:', error);
        throw new Error('Error al actualizar rol');
    }
    
    revalidatePath('/usuarios');
}

// Delete role
export async function deleteRole(id: string) {
    const supabase = await createClient();
    
    // Check if it's a system role
    const { data: existing } = await supabase
        .from('user_roles')
        .select('is_system_role')
        .eq('id', id)
        .single();
    
    if (existing?.is_system_role) {
        throw new Error('No se pueden eliminar roles del sistema');
    }
    
    const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting role:', error);
        throw new Error('Error al eliminar rol');
    }
    
    revalidatePath('/usuarios');
}

// Update role permissions
export async function updateRolePermissions(roleId: string, permissions: Partial<RolePermission>[]) {
    const supabase = await createClient();
    
    for (const perm of permissions) {
        const { error } = await supabase
            .from('role_permissions')
            .upsert({
                role_id: roleId,
                module: perm.module,
                can_read: perm.can_read ?? false,
                can_write: perm.can_write ?? false,
                can_delete: perm.can_delete ?? false,
                can_approve: perm.can_approve ?? false,
            }, {
                onConflict: 'role_id,module',
            });
        
        if (error) {
            console.error('Error updating permission:', error);
        }
    }
    
    revalidatePath('/usuarios');
}

// Get users with their roles
export async function getUsersWithRoles() {
    const supabase = await createClient();
    
    // Get all users from auth.users via a view or RPC
    // For now, we'll get users from user_role_assignments
    const { data: assignments, error } = await supabase
        .from('user_role_assignments')
        .select(`
            *,
            role:user_roles(id, name, description)
        `);
    
    if (error) {
        console.error('Error fetching user roles:', error);
        return [];
    }
    
    return assignments || [];
}

// Assign role to user
export async function assignRoleToUser(userId: string, roleId: string) {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
        .from('user_role_assignments')
        .insert({
            user_id: userId,
            role_id: roleId,
            assigned_by: user?.id,
        });
    
    if (error) {
        if (error.code === '23505') {
            throw new Error('El usuario ya tiene este rol asignado');
        }
        console.error('Error assigning role:', error);
        throw new Error('Error al asignar rol');
    }
    
    revalidatePath('/usuarios');
}

// Remove role from user
export async function removeRoleFromUser(userId: string, roleId: string) {
    const supabase = await createClient();
    
    const { error } = await supabase
        .from('user_role_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);
    
    if (error) {
        console.error('Error removing role:', error);
        throw new Error('Error al remover rol');
    }
    
    revalidatePath('/usuarios');
}

// Get current user's permissions
export async function getCurrentUserPermissions(): Promise<UserPermissions[]> {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    // Try to use RPC function
    const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_permissions', { p_user_id: user.id });
    
    if (!rpcError && rpcData) {
        return rpcData;
    }
    
    // Fallback: query directly
    const { data: assignments, error } = await supabase
        .from('user_role_assignments')
        .select(`
            role_id,
            role:user_roles!inner(
                permissions:role_permissions(module, can_read, can_write, can_delete, can_approve)
            )
        `)
        .eq('user_id', user.id);
    
    if (error || !assignments) {
        console.error('Error fetching permissions:', error);
        // Return default permissions for admin (first user)
        return MODULES.map(m => ({
            module: m.id,
            can_read: true,
            can_write: true,
            can_delete: true,
            can_approve: true,
        }));
    }
    
    // Aggregate permissions from all roles
    const permMap: Record<string, UserPermissions> = {};
    
    for (const assignment of assignments) {
        const permissions = (assignment.role as any)?.permissions || [];
        for (const perm of permissions) {
            if (!permMap[perm.module]) {
                permMap[perm.module] = {
                    module: perm.module,
                    can_read: false,
                    can_write: false,
                    can_delete: false,
                    can_approve: false,
                };
            }
            // Merge permissions (OR logic)
            permMap[perm.module].can_read = permMap[perm.module].can_read || perm.can_read;
            permMap[perm.module].can_write = permMap[perm.module].can_write || perm.can_write;
            permMap[perm.module].can_delete = permMap[perm.module].can_delete || perm.can_delete;
            permMap[perm.module].can_approve = permMap[perm.module].can_approve || perm.can_approve;
        }
    }
    
    return Object.values(permMap);
}

// Check if user has permission
export async function checkPermission(module: string, action: 'read' | 'write' | 'delete' | 'approve'): Promise<boolean> {
    const permissions = await getCurrentUserPermissions();
    
    // If no permissions configured, assume admin (first user scenario)
    if (permissions.length === 0) {
        return true;
    }
    
    const modulePerm = permissions.find(p => p.module === module);
    if (!modulePerm) return false;
    
    switch (action) {
        case 'read': return modulePerm.can_read;
        case 'write': return modulePerm.can_write;
        case 'delete': return modulePerm.can_delete;
        case 'approve': return modulePerm.can_approve;
        default: return false;
    }
}
