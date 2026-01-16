'use client';

import { useState } from 'react';
import { ThirdPartyForm } from '@/components/terceros/third-party-form';

type ThirdParty = {
    id: string;
    document_type: string;
    document_number: string;
    dv: number | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    is_client: boolean;
    is_provider: boolean;
    is_employee: boolean;
};

type Props = {
    parties: ThirdParty[];
};

export function TercerosTable({ parties }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'client' | 'provider' | 'employee'>('all');

    const filteredParties = parties.filter(p => {
        const matchesSearch = p.full_name.toLowerCase().includes(filter.toLowerCase()) ||
            p.document_number.includes(filter);
        
        const matchesType = typeFilter === 'all' ||
            (typeFilter === 'client' && p.is_client) ||
            (typeFilter === 'provider' && p.is_provider) ||
            (typeFilter === 'employee' && p.is_employee);

        return matchesSearch && matchesType;
    });

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Buscar por nombre o documento..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '0.625rem 1rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)',
                            width: '250px'
                        }}
                    />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        style={{
                            padding: '0.625rem',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <option value="all">Todos</option>
                        <option value="client">Clientes</option>
                        <option value="provider">Proveedores</option>
                        <option value="employee">Empleados</option>
                    </select>
                </div>
                <button 
                    onClick={() => setShowForm(true)} 
                    className="btn btn-primary"
                    data-testid="new-third-party-button"
                >
                    Nuevo Tercero
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--surface-hover))', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>Documento</th>
                            <th style={{ padding: '1rem' }}>Nombre</th>
                            <th style={{ padding: '1rem' }}>Contacto</th>
                            <th style={{ padding: '1rem' }}>Ciudad</th>
                            <th style={{ padding: '1rem' }}>Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredParties.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                    No hay terceros registrados.
                                </td>
                            </tr>
                        ) : (
                            filteredParties.map((party) => (
                                <tr key={party.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
                                            {party.document_type}
                                        </span>
                                        <br />
                                        {party.document_number}
                                        {party.dv !== null && <span style={{ color: 'hsl(var(--text-secondary))' }}>-{party.dv}</span>}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{party.full_name}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                        {party.email && <div>{party.email}</div>}
                                        {party.phone && <div style={{ color: 'hsl(var(--text-secondary))' }}>{party.phone}</div>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{party.city || '-'}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                            {party.is_client && (
                                                <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.625rem', backgroundColor: 'hsl(var(--accent)/0.15)', color: 'hsl(var(--accent))' }}>
                                                    Cliente
                                                </span>
                                            )}
                                            {party.is_provider && (
                                                <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.625rem', backgroundColor: 'hsl(var(--gold)/0.15)', color: 'hsl(45 80% 35%)' }}>
                                                    Proveedor
                                                </span>
                                            )}
                                            {party.is_employee && (
                                                <span style={{ padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.625rem', backgroundColor: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}>
                                                    Empleado
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && <ThirdPartyForm onClose={() => setShowForm(false)} />}
        </>
    );
}
