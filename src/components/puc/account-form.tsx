'use client';

import { useState } from 'react';
import { createAccount } from '@/actions/puc';
import { useRouter } from 'next/navigation';

type Props = {
    onClose: () => void;
    parentAccount?: { code: string; name: string } | null;
};

export function AccountForm({ onClose, parentAccount }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        code: parentAccount ? parentAccount.code : '',
        name: '',
        type: 'ACTIVO' as const,
        nature: 'DEBITO' as const,
        level: parentAccount ? (parentAccount.code.length <= 2 ? 4 : 6) : 1,
        parent_code: parentAccount?.code || null
    });

    const accountTypes = [
        { value: 'ACTIVO', label: 'Activo' },
        { value: 'PASIVO', label: 'Pasivo' },
        { value: 'PATRIMONIO', label: 'Patrimonio' },
        { value: 'INGRESO', label: 'Ingreso' },
        { value: 'GASTO', label: 'Gasto' },
        { value: 'COSTO_VENTAS', label: 'Costo de Ventas' },
        { value: 'COSTO_PRODUCCION', label: 'Costo de Producción' },
        { value: 'CUENTAS_ORDEN', label: 'Cuentas de Orden' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await createAccount(formData);
            router.refresh();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>
                    {parentAccount ? `Nueva subcuenta de ${parentAccount.name}` : 'Nueva Cuenta'}
                </h2>

                {error && (
                    <div style={{ backgroundColor: 'hsl(var(--error)/0.1)', color: 'hsl(var(--error))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Código</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                required
                                placeholder={parentAccount ? `${parentAccount.code}XX` : '1'}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nivel</label>
                            <select
                                value={formData.level}
                                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            >
                                <option value={1}>1 - Clase</option>
                                <option value={2}>2 - Grupo</option>
                                <option value={4}>4 - Cuenta</option>
                                <option value={6}>6 - Subcuenta</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                            required
                            placeholder="NOMBRE DE LA CUENTA"
                            style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            >
                                {accountTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Naturaleza</label>
                            <select
                                value={formData.nature}
                                onChange={(e) => setFormData({ ...formData, nature: e.target.value as any })}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            >
                                <option value="DEBITO">Débito</option>
                                <option value="CREDITO">Crédito</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
