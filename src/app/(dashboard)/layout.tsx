
import Link from 'next/link';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: 'hsl(var(--surface))',
                borderRight: '1px solid hsl(var(--border))',
                padding: '1.5rem',
                position: 'fixed',
                height: '100%'
            }}>
                <div style={{ marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.25rem', color: 'hsl(var(--primary))' }}>
                    DigiKawsay
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link href="/dashboard" style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'hsl(var(--text-main))' }}>
                        Dashboard
                    </Link>
                    <Link href="/puc" style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'hsl(var(--text-main))' }}>
                        Plan de Cuentas
                    </Link>
                    <Link href="/terceros" style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'hsl(var(--text-main))' }}>
                        Terceros
                    </Link>
                    <Link href="/asientos" style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'hsl(var(--text-main))' }}>
                        Asientos
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main style={{ marginLeft: '250px', flex: 1, padding: '2rem', backgroundColor: 'hsl(var(--background))' }}>
                {children}
            </main>
        </div>
    );
}
