'use client';

import { useState, useEffect } from 'react';
import { VoucherType, createVoucher, getTaxRates } from '@/actions/vouchers';
import { getThirdParties } from '@/actions/third-parties';
import { formatCOP } from '@/lib/utils/dian';

type Props = {
    type: VoucherType;
    onClose: () => void;
    onSuccess: () => void;
};

type Line = {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    iva_rate: number;
    retention_rate: number;
};

const typeLabels: Record<VoucherType, string> = {
    INGRESO: 'Recibo de Caja',
    EGRESO: 'Comprobante de Egreso',
    COMPRA: 'Factura de Compra',
    VENTA: 'Factura de Venta',
    NOTA_CONTABLE: 'Nota Contable'
};

export function VoucherForm({ type, onClose, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [thirdPartyId, setThirdPartyId] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState<Line[]>([
        { id: '1', description: '', quantity: 1, unit_price: 0, iva_rate: 19, retention_rate: 0 }
    ]);

    const [thirdParties, setThirdParties] = useState<any[]>([]);
    const [taxRates, setTaxRates] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [parties, rates] = await Promise.all([
                getThirdParties(),
                getTaxRates()
            ]);
            setThirdParties(parties || []);
            setTaxRates(rates || []);
        } catch (e) {
            console.error(e);
        }
    };

    const addLine = () => {
        setLines([...lines, { 
            id: Math.random().toString(), 
            description: '', 
            quantity: 1, 
            unit_price: 0, 
            iva_rate: 19, 
            retention_rate: 0 
        }]);
    };

    const removeLine = (index: number) => {
        if (lines.length > 1) {
            setLines(lines.filter((_, i) => i !== index));
        }
    };

    const updateLine = (index: number, field: keyof Line, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    // Calculate totals
    const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
    const iva = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price * line.iva_rate / 100), 0);
    const retention = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price * line.retention_rate / 100), 0);
    const total = subtotal + iva - retention;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!description.trim()) {
            setError('La descripción es obligatoria');
            return;
        }

        if (lines.some(l => !l.description.trim())) {
            setError('Todas las líneas deben tener descripción');
            return;
        }

        setLoading(true);
        try {
            await createVoucher(type, new Date(date), thirdPartyId, description, lines);
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const ivaRates = taxRates.filter(t => t.type === 'IVA');
    const retentionRates = taxRates.filter(t => t.type === 'RETEFUENTE');

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
            <div className="card" style={{ width: '100%', maxWidth: '900px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Nuevo {typeLabels[type]}</h2>

                {error && (
                    <div style={{ backgroundColor: 'hsl(var(--error)/0.1)', color: 'hsl(var(--error))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tercero</label>
                            <select
                                value={thirdPartyId || ''}
                                onChange={(e) => setThirdPartyId(e.target.value || null)}
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            >
                                <option value="">Seleccionar tercero...</option>
                                {thirdParties.map(tp => (
                                    <option key={tp.id} value={tp.id}>{tp.full_name} - {tp.document_number}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Descripción</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Concepto del comprobante"
                                required
                                style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                    </div>

                    {/* Lines */}
                    <div style={{ marginBottom: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid hsl(var(--border))', fontSize: '0.875rem' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Descripción</th>
                                    <th style={{ padding: '0.5rem', width: '80px' }}>Cant.</th>
                                    <th style={{ padding: '0.5rem', width: '120px' }}>Precio</th>
                                    <th style={{ padding: '0.5rem', width: '100px' }}>IVA %</th>
                                    <th style={{ padding: '0.5rem', width: '100px' }}>Ret. %</th>
                                    <th style={{ padding: '0.5rem', width: '120px' }}>Subtotal</th>
                                    <th style={{ padding: '0.5rem', width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, index) => (
                                    <tr key={line.id}>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                type="text"
                                                value={line.description}
                                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                placeholder="Descripción del ítem"
                                                style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                type="number"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                                style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <input
                                                type="number"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <select
                                                value={line.iva_rate}
                                                onChange={(e) => updateLine(index, 'iva_rate', parseFloat(e.target.value))}
                                                style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}
                                            >
                                                <option value={0}>0%</option>
                                                <option value={5}>5%</option>
                                                <option value={19}>19%</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <select
                                                value={line.retention_rate}
                                                onChange={(e) => updateLine(index, 'retention_rate', parseFloat(e.target.value))}
                                                style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)' }}
                                            >
                                                <option value={0}>0%</option>
                                                <option value={2.5}>2.5%</option>
                                                <option value={4}>4%</option>
                                                <option value={10}>10%</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                            {formatCOP(line.quantity * line.unit_price)}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => removeLine(index)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        onClick={addLine}
                        className="btn"
                        style={{ marginBottom: '1.5rem', border: '1px dashed hsl(var(--border))', width: '100%' }}
                    >
                        + Agregar Línea
                    </button>

                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                        <div style={{ width: '250px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                                <span>Subtotal:</span>
                                <span>{formatCOP(subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))' }}>
                                <span>IVA:</span>
                                <span>{formatCOP(iva)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid hsl(var(--border))', color: 'hsl(var(--error))' }}>
                                <span>Retención:</span>
                                <span>-{formatCOP(retention)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontWeight: 'bold', fontSize: '1.125rem' }}>
                                <span>Total:</span>
                                <span>{formatCOP(total)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? 'Guardando...' : 'Guardar Comprobante'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
