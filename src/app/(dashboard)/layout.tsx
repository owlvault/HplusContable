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
<<<<<<< Updated upstream
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: 'hsl(var(--surface))',
                borderRight: '1px solid hsl(var(--border))',
                padding: '1.5rem',
                position: 'fixed',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                    <div style={{ marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.15rem', color: 'hsl(var(--primary))', lineHeight: '1.2' }}>
                        HPlus Contable
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
                            CFO IA
                        </div>
                    </div>
                </Link>
=======
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100">
            {/* Master Sidebar */}
            <Sidebar userName={userName} />
>>>>>>> Stashed changes

            {/* Main Content Viewport */}
            <main className="ml-64 flex-1 p-6 md:p-8 min-h-screen overflow-x-hidden">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
