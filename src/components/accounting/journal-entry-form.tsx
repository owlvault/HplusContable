'use client';

import { useState } from 'react';
import { AsyncSelect } from '@/components/ui/async-select';
import { getAccounts } from '@/actions/puc';
import { getThirdParties } from '@/actions/third-parties';
import { createJournalEntry } from '@/actions/accounting';
import { useRouter } from 'next/navigation';

type Line = {
    id: string;
    account: { label: string; value: string } | null;
    thirdParty: { label: string; value: string } | null;
    debit: number;
    credit: number;
};

export function JournalEntryForm() {
    const router = useRouter();
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lines, setLines] = useState<Line[]>([
        { id: '1', account: null, thirdParty: null, debit: 0, credit: 0 },
        { id: '2', account: null, thirdParty: null, debit: 0, credit: 0 },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const difference = totalDebit - totalCredit;

    const handleAddLine = () => {
        setLines([...lines, { id: Math.random().toString(), account: null, thirdParty: null, debit: 0, credit: 0 }]);
    };

    const handleRemoveLine = (index: number) => {
        if (lines.length <= 2) return;
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof Line, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleSubmit = async (isApproved: boolean) => {
        setError('');

        if (!description) {
            setError('La descripción es obligatoria');
            return;
        }

        if (isApproved && Math.abs(difference) > 0.01) {
            setError('El asiento está descuadrado. No se puede aprobar.');
            return;
        }

        // Prepare data
        const formattedLines = lines.map(line => {
            if (!line.account) throw new Error('Todas las líneas deben tener cuenta');
            return {
                account_code: line.account.value,
                third_party_id: line.thirdParty?.value || null,
                debit: line.debit || 0,
                credit: line.credit || 0
            };
        });

        try {
            setIsSubmitting(true);
            await createJournalEntry(new Date(date), description, formattedLines, isApproved);
            router.push('/asientos');
            router.refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card">
            {error && (
                <div style={{ backgroundColor: 'hsl(var(--error)/0.1)', color: 'hsl(var(--error))', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {/* HEADER */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Fecha</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Descripción</label>
                    <input
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Concepto del asiento..."
                        style={{ width: '100%', padding: '0.625rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)' }}
                    />
                </div>
            </div>

            {/* LINES TABLE */}
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid hsl(var(--border))', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem', width: '30%' }}>Cuenta</th>
                            <th style={{ padding: '0.5rem', width: '25%' }}>Tercero</th>
                            <th style={{ padding: '0.5rem', width: '15%' }}>Débito</th>
                            <th style={{ padding: '0.5rem', width: '15%' }}>Crédito</th>
                            <th style={{ padding: '0.5rem', width: '5%' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, index) => (
                            <tr key={line.id}>
                                <td style={{ padding: '0.5rem' }}>
                                    <AsyncSelect
                                        loadOptions={async (search) => {
                                            const data = await getAccounts(search);
                                            return data || [];
                                        }}
                                        mapOption={(item) => ({ label: `${item.code} - ${item.name}`, value: item.code, subLabel: item.nature })}
                                        onChange={(val) => updateLine(index, 'account', val)}
                                        value={line.account}
                                        placeholder="Buscar cuenta..."
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <AsyncSelect
                                        loadOptions={async (search) => {
                                            const data = await getThirdParties(search);
                                            return data || [];
                                        }}
                                        mapOption={(item) => ({ label: item.full_name, value: item.id, subLabel: item.document_number })}
                                        onChange={(val) => updateLine(index, 'thirdParty', val)}
                                        value={line.thirdParty}
                                        placeholder="Opcional..."
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input
                                        type="number"
                                        value={line.debit}
                                        onChange={e => updateLine(index, 'debit', parseFloat(e.target.value))}
                                        onFocus={e => e.target.select()}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                    <input
                                        type="number"
                                        value={line.credit}
                                        onChange={e => updateLine(index, 'credit', parseFloat(e.target.value))}
                                        onFocus={e => e.target.select()}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}
                                    />
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <button
                                        onClick={() => handleRemoveLine(index)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-secondary))' }}
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ borderTop: '2px solid hsl(var(--border))', fontWeight: 'bold' }}>
                            <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right' }}>Totales</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'hsl(var(--text-main))' }}>
                                {new Intl.NumberFormat('es-CO').format(totalDebit)}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: 'hsl(var(--text-main))' }}>
                                {new Intl.NumberFormat('es-CO').format(totalCredit)}
                            </td>
                            <td></td>
                        </tr>
                        {Math.abs(difference) > 0.01 && (
                            <tr>
                                <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right', color: 'hsl(var(--error))', fontWeight: 'bold' }}>Diferencia</td>
                                <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: 'hsl(var(--error)/0.1)', color: 'hsl(var(--error))', borderRadius: 'var(--radius-sm)' }}>
                                    {new Intl.NumberFormat('es-CO').format(difference)}
                                </td>
                            </tr>
                        )}
                    </tfoot>
                </table>
            </div>

            <button
                onClick={handleAddLine}
                className="btn"
                style={{ marginBottom: '2rem', border: '1px dashed hsl(var(--border))', width: '100%' }}
            >
                + Agregar Línea
            </button>

            {/* ACTIONS */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                    className="btn"
                    style={{ backgroundColor: 'transparent', border: '1px solid hsl(var(--border))' }}
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                >
                    Guardar Borrador
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting || Math.abs(difference) > 0.01}
                    style={{ opacity: Math.abs(difference) > 0.01 ? 0.5 : 1 }}
                >
                    {isSubmitting ? 'Guardando...' : 'Aprobar y Guardar'}
                </button>
            </div>
        </div>
    );
}
