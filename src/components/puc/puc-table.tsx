'use client';

import { useState } from 'react';
import { AccountForm } from '@/components/puc/account-form';

type Account = {
    code: string;
    name: string;
    type: string;
    nature: string;
    level: number;
};

type Props = {
    accounts: Account[];
};

export function PucTable({ accounts }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [parentAccount, setParentAccount] = useState<{ code: string; name: string } | null>(null);
    const [filter, setFilter] = useState('');

    const filteredAccounts = accounts.filter(acc => 
        acc.code.includes(filter) || acc.name.toLowerCase().includes(filter.toLowerCase())
    );

    const handleAddSubAccount = (account: Account) => {
        setParentAccount({ code: account.code, name: account.name });
        setShowForm(true);
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Buscar por código o nombre..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{
                        padding: '0.625rem 1rem',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-md)',
                        width: '300px'
                    }}
                />
                <button 
                    onClick={() => { setParentAccount(null); setShowForm(true); }} 
                    className="btn btn-primary"
                    data-testid="new-account-button"
                >
                    Nueva Cuenta
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--surface-hover))', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>Código</th>
                            <th style={{ padding: '1rem' }}>Nombre</th>
                            <th style={{ padding: '1rem' }}>Tipo</th>
                            <th style={{ padding: '1rem' }}>Naturaleza</th>
                            <th style={{ padding: '1rem', width: '100px' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                    No hay cuentas registradas.
                                </td>
                            </tr>
                        ) : (
                            filteredAccounts.map((acc) => (
                                <tr key={acc.code} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ 
                                        padding: '1rem', 
                                        fontWeight: acc.level < 4 ? 'bold' : 'normal',
                                        paddingLeft: `${acc.level * 0.5 + 1}rem`
                                    }}>
                                        {acc.code}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{acc.name}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{acc.type}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            backgroundColor: acc.nature === 'DEBITO' ? 'hsl(var(--accent)/0.15)' : 'hsl(var(--gold)/0.15)',
                                            color: acc.nature === 'DEBITO' ? 'hsl(var(--accent))' : 'hsl(45 80% 35%)'
                                        }}>
                                            {acc.nature}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {acc.level < 6 && (
                                            <button
                                                onClick={() => handleAddSubAccount(acc)}
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: 'var(--radius-sm)',
                                                    backgroundColor: 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                                title="Agregar subcuenta"
                                            >
                                                + Sub
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <AccountForm 
                    onClose={() => { setShowForm(false); setParentAccount(null); }} 
                    parentAccount={parentAccount}
                />
            )}
        </>
    );
}
