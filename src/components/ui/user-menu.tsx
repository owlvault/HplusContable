'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
    userName?: string;
};

export function UserMenu({ userName }: Props) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                }}
                data-testid="user-menu-button"
            >
                <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'hsl(var(--accent))',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600
                }}>
                    {userName?.charAt(0).toUpperCase() || 'U'}
                </span>
                <span style={{ color: 'hsl(var(--text-main))' }}>
                    {userName || 'Usuario'}
                </span>
                <span style={{ fontSize: '0.625rem', opacity: 0.5 }}>▼</span>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    backgroundColor: 'hsl(var(--surface))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '150px',
                    zIndex: 100
                }}>
                    <button
                        onClick={handleLogout}
                        disabled={loading}
                        data-testid="logout-button"
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.875rem',
                            color: 'hsl(var(--error))'
                        }}
                    >
                        {loading ? 'Saliendo...' : 'Cerrar Sesión'}
                    </button>
                </div>
            )}
        </div>
    );
}
