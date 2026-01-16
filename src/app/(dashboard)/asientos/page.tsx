
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AsientosPage() {
    const supabase = await createClient();
    const { data: entries } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem' }}>Asientos Contables</h1>
                <Link href="/asientos/nuevo" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    Nuevo Asiento
                </Link>
            </div>

            <div className="card">
                {entries?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-secondary))' }}>
                        No hay asientos registrados aún.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                <th style={{ padding: '1rem' }}>#</th>
                                <th style={{ padding: '1rem' }}>Fecha</th>
                                <th style={{ padding: '1rem' }}>Descripción</th>
                                <th style={{ padding: '1rem' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries?.map(entry => (
                                <tr key={entry.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '1rem' }}>{entry.sequence_number}</td>
                                    <td style={{ padding: '1rem' }}>{new Date(entry.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '1rem' }}>{entry.description}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            backgroundColor: entry.state === 'APROBADO' ? 'hsl(var(--accent)/0.2)' : 'hsl(var(--text-secondary)/0.1)',
                                            color: entry.state === 'APROBADO' ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))'
                                        }}>
                                            {entry.state}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
