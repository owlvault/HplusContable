'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', color: 'hsl(var(--primary))', marginBottom: '0.5rem' }}>
                    DigiKawsay
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Ingresa a tu cuenta
                </p>
            </div>

            {error && (
                <div style={{
                    backgroundColor: 'hsl(var(--error)/0.1)',
                    color: 'hsl(var(--error))',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Correo electrónico
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="login-email-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="tu@email.com"
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Contraseña
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="login-password-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    data-testid="login-submit-button"
                    className="btn btn-primary"
                    style={{ width: '100%', marginBottom: '1rem' }}
                >
                    {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
                ¿No tienes cuenta?{' '}
                <Link href="/register" style={{ color: 'hsl(var(--accent))', textDecoration: 'none' }}>
                    Regístrate
                </Link>
            </p>
        </div>
    );
}
