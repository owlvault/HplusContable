import { createClient } from '@/lib/supabase/server';
import { ensureAdminRoleForCurrentUser } from '@/lib/rbac';
import { Sidebar } from '@/components/navigation/sidebar';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Auto-asignar rol de Administrador si el usuario no tiene roles
    if (user) {
        await ensureAdminRoleForCurrentUser();
    }

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100">
            {/* Master Sidebar */}
            <Sidebar userName={userName} />

            {/* Main Content Viewport */}
            <main className="ml-64 flex-1 p-6 md:p-8 min-h-screen overflow-x-hidden">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
