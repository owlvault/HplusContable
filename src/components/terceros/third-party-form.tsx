'use client';

import { useState } from 'react';
import { createThirdParty } from '@/actions/third-parties';
import { useRouter } from 'next/navigation';
import { calculateDV } from '@/lib/utils/dian';

type Props = {
    onClose: () => void;
};

export function ThirdPartyForm({ onClose }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        document_type: 'CC' as const,
        document_number: '',
        dv: null as number | null,
        full_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        is_client: false,
        is_provider: false,
        is_employee: false
    });

    const documentTypes = [
        { value: 'CC', label: 'Cédula de Ciudadanía' },
        { value: 'NIT', label: 'NIT' },
        { value: 'CE', label: 'Cédula de Extranjería' },
        { value: 'PASAPORTE', label: 'Pasaporte' },
        { value: 'TI', label: 'Tarjeta de Identidad' }
    ];

    const handleDocumentChange = (value: string) => {
        setFormData(prev => {
            const newData = { ...prev, document_number: value };
            if (prev.document_type === 'NIT' && value.length >= 6) {
                newData.dv = calculateDV(value);
            }
            return newData;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.is_client && !formData.is_provider && !formData.is_employee) {
            setError('Debe seleccionar al menos un tipo de tercero');
            return;
        }

        setLoading(true);

        try {
            await createThirdParty(formData);
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
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Nuevo Tercero</h2>

                {error && (
                    <div style={{ backgroundColor: 'hsl(var(--error)/0.1)', color: 'hsl(var(--error))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Document */}
                    <div style={{ display: 'grid', gridTemplateColumns: formData.document_type === 'NIT' ? '1fr 2fr auto' : '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tipo Doc.</label>
                            <select
                                value={formData.document_type}
                                onChange={(e) => setFormData({ ...formData, document_type: e.target.value as any, dv: null })}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            >
                                {documentTypes.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Número</label>
                            <input
                                type="text"
                                value={formData.document_number}
                                onChange={(e) => handleDocumentChange(e.target.value.replace(/\D/g, ''))}
                                required
                                placeholder="123456789"
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        {formData.document_type === 'NIT' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>DV</label>
                                <input
                                    type="text"
                                    value={formData.dv ?? ''}
                                    readOnly
                                    style={{ 
                                        width: '60px', 
                                        padding: '0.625rem', 
                                        border: '1px solid hsl(var(--border))', 
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'hsl(var(--surface-hover))',
                                        textAlign: 'center',
                                        fontWeight: 'bold'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre / Razón Social</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            required
                            placeholder="Juan Pérez / Empresa S.A.S"
                            style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                        />
                    </div>

                    {/* Contact */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="correo@ejemplo.com"
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Teléfono</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="3001234567"
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Dirección</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Calle 123 # 45-67"
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Ciudad</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                placeholder="Bogotá"
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                    </div>

                    {/* Type checkboxes */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500 }}>Tipo de Tercero</label>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_client}
                                    onChange={(e) => setFormData({ ...formData, is_client: e.target.checked })}
                                />
                                Cliente
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_provider}
                                    onChange={(e) => setFormData({ ...formData, is_provider: e.target.checked })}
                                />
                                Proveedor
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_employee}
                                    onChange={(e) => setFormData({ ...formData, is_employee: e.target.checked })}
                                />
                                Empleado
                            </label>
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
