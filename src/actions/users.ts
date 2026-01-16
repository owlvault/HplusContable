'use server';

import { createClient } from '@/lib/supabase/server';

export type UserRole = 'ADMIN' | 'CONTADOR' | 'AUXILIAR' | 'GERENTE' | 'VIEWER';

export async function getUserProfile() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        // Create default profile
        const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
                id: user.id,
                role: 'VIEWER',
                full_name: user.user_metadata?.full_name || user.email
            })
            .select()
            .single();

        return newProfile;
    }

    return profile;
}

export async function updateUserRole(userId: string, role: UserRole) {
    const supabase = await createClient();
    
    // Check if current user is admin
    const currentProfile = await getUserProfile();
    if (currentProfile?.role !== 'ADMIN') {
        throw new Error('Solo los administradores pueden cambiar roles');
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', userId);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getAllUsers() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

// Permission helpers
const rolePermissions: Record<UserRole, string[]> = {
    ADMIN: ['*'], // All permissions
    CONTADOR: ['read', 'create', 'update', 'approve', 'reports'],
    AUXILIAR: ['read', 'create'],
    GERENTE: ['read', 'reports', 'approve'],
    VIEWER: ['read']
};

export async function checkPermission(permission: string): Promise<boolean> {
    const profile = await getUserProfile();
    if (!profile) return false;

    const permissions = rolePermissions[profile.role as UserRole] || [];
    return permissions.includes('*') || permissions.includes(permission);
}
