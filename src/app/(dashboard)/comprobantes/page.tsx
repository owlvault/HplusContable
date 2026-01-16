'use client';

import { useState, useEffect } from 'react';
import { getVouchers, VoucherType } from '@/actions/vouchers';
import { VoucherForm } from '@/components/comprobantes/voucher-form';
import { formatCOP } from '@/lib/utils/dian';

const voucherTypes: { value: VoucherType; label: string; icon: string }[] = [
    { value: 'INGRESO', label: 'Recibo de Caja', icon: '💵' },
    { value: 'EGRESO', label: 'Comprobante de Egreso', icon: '💸' },
    { value: 'COMPRA', label: 'Factura de Compra', icon: '🛢️' },
    { value: 'VENTA', label: 'Factura de Venta', icon: '🧾' },
    { value: 'NOTA_CONTABLE', label: 'Nota Contable', icon: '📝' }
];

export default function ComprobantesPage() {
    const [vouchers, setVouchers] = useState<any[]>([]);
    const [selectedType, setSelectedType] = useState<VoucherType | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<VoucherType | 'all'>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVouchers();
    }, [filter]);

    const loadVouchers = async () => {
        setLoading(true);
        try {
            const data = await getVouchers(filter === 'all' ? undefined : filter);
            setVouchers(data || []);
        } catch (error) {
            console.error('Error loading vouchers:', error);
            setVouchers([]);
        }
        setLoading(false);
    };

    const handleNewVoucher = (type: VoucherType) => {
        setSelectedType(type);
        setShowForm(true);
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Comprobantes Contables</h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Gestiona recibos de caja, egresos, facturas y notas contables
                </p>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {voucherTypes.map((type) => (
                    <button
                        key={type.value}
                        onClick={() => handleNewVoucher(type.value)}
                        className="card"
                        style={{
                            padding: '1.25rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: '1px solid hsl(var(--border))',
                            transition: 'all 0.2s'
                        }}
                        data-testid={`new-voucher-${type.value.toLowerCase()}`}
                    >
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>{type.icon}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{type.label}</span>
                    </button>
                ))}
            </div>

            {/* Filter and List */}
            <div style={{ marginBottom: '1.5rem' }}>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    style={{
                        padding: '0.625rem',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-md)'
                    }}
                >
                    <option value="all">Todos los comprobantes</option>
                    {voucherTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--surface-hover))', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>N°</th>
                            <th style={{ padding: '1rem' }}>Tipo</th>
                            <th style={{ padding: '1rem' }}>Fecha</th>
                            <th style={{ padding: '1rem' }}>Tercero</th>
                            <th style={{ padding: '1rem' }}>Descripción</th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '1rem' }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                    Cargando...
                                </td>
                            </tr>
                        ) : vouchers.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                    No hay comprobantes registrados. Crea uno nuevo usando los botones de arriba.
                                </td>
                            </tr>
                        ) : (
                            vouchers.map((v) => (
                                <tr key={v.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{v.number}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--surface-hover))' }}>
                                            {voucherTypes.find(t => t.value === v.type)?.label || v.type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{new Date(v.date).toLocaleDateString('es-CO')}</td>
                                    <td style={{ padding: '1rem' }}>{v.third_parties?.full_name || '-'}</td>
                                    <td style={{ padding: '1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {v.description}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>
                                        {formatCOP(v.total)}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            backgroundColor: v.state === 'APROBADO' ? 'hsl(var(--accent)/0.15)' : 'hsl(var(--text-secondary)/0.1)',
                                            color: v.state === 'APROBADO' ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))'
                                        }}>
                                            {v.state}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && selectedType && (
                <VoucherForm 
                    type={selectedType} 
                    onClose={() => { setShowForm(false); setSelectedType(null); }}
                    onSuccess={() => { setShowForm(false); setSelectedType(null); loadVouchers(); }}
                />
            )}
        </div>
    );
}
