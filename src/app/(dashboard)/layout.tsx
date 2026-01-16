
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/ui/user-menu';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: '📊' },
        { href: '/puc', label: 'Plan de Cuentas', icon: '📖' },
        { href: '/terceros', label: 'Terceros', icon: '👥' },
        { href: '/asientos', label: 'Asientos', icon: '📝' },
        { href: '/comprobantes', label: 'Comprobantes', icon: '🧾' },
        { href: '/reportes', label: 'Reportes', icon: '📈' },
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
                    <div style={{ marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.25rem', color: 'hsl(var(--primary))' }}>
                        DigiKawsay
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
                    <UserMenu userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]} />
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ marginLeft: '250px', flex: 1, padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
                {children}
            </main>
        </div>
    );
}
