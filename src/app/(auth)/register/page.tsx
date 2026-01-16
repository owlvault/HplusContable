'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (error) throw error;
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Error al registrarse');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <h2 style={{ marginBottom: '1rem' }}>¡Registro exitoso!</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
                    Revisa tu correo electrónico para confirmar tu cuenta.
                </p>
                <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    Ir a Iniciar Sesión
                </Link>
            </div>
        );
    }

    return (
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', color: 'hsl(var(--primary))', marginBottom: '0.5rem' }}>
                    DigiKawsay
                </h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Crea tu cuenta empresarial
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

            <form onSubmit={handleRegister}>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Nombre completo
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        data-testid="register-name-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="Juan Pérez"
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Correo electrónico
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="register-email-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="tu@empresa.com"
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Contraseña
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="register-password-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="Mínimo 6 caracteres"
                    />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>
                        Confirmar contraseña
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        data-testid="register-confirm-password-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                        }}
                        placeholder="Repite tu contraseña"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    data-testid="register-submit-button"
                    className="btn btn-primary"
                    style={{ width: '100%', marginBottom: '1rem' }}
                >
                    {loading ? 'Registrando...' : 'Crear Cuenta'}
                </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" style={{ color: 'hsl(var(--accent))', textDecoration: 'none' }}>
                    Inicia sesión
                </Link>
            </p>
        </div>
    );
}
