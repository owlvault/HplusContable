
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/ui/user-menu';
import { NotificationBell } from '@/components/ui/notification-bell';
import { ensureAdminRoleForCurrentUser } from '@/lib/rbac';

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

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: '📊' },
        { href: '/puc', label: 'Plan de Cuentas', icon: '📖' },
        { href: '/terceros', label: 'Terceros', icon: '👥' },
        { href: '/ventas', label: 'Ventas', icon: '🎯' },
        { href: '/facturas', label: 'Facturación', icon: '🧾' },
        { href: '/cartera', label: 'Cartera', icon: '💰' },
        { href: '/tesoreria', label: 'Tesorería', icon: '🏦' },
        { href: '/nomina', label: 'Nómina', icon: '💼' },
        { href: '/asientos', label: 'Asientos', icon: '📝' },
        { href: '/comprobantes', label: 'Comprobantes', icon: '📋' },
        { href: '/reportes', label: 'Reportes', icon: '📈' },
        { href: '/cierre', label: 'Cierre Contable', icon: '🔒' },
        { href: '/conciliacion', label: 'Conciliación', icon: '🔄' },
        { href: '/usuarios', label: 'Usuarios', icon: '👤' },
        { href: '/configuracion', label: 'Configuración', icon: '⚙️' },
    ];

    return (
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

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: 'hsl(var(--text-main))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '0.9375rem',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* User info at bottom */}
                <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <NotificationBell />
                        <UserMenu userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]} />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ marginLeft: '250px', flex: 1, padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
                {children}
            </main>
        </div>
    );
}
