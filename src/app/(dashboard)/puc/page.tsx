
import { getAccounts } from '@/actions/puc';

export default async function PucPage() {
    const accounts = await getAccounts().catch(() => []); // Fail safe if DB not connected

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem' }}>Plan Único de Cuentas</h1>
                <button className="btn btn-primary">Nueva Cuenta</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--surface-hover))', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1rem' }}>Código</th>
                            <th style={{ padding: '1rem' }}>Nombre</th>
                            <th style={{ padding: '1rem' }}>Tipo</th>
                            <th style={{ padding: '1rem' }}>Naturaleza</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                    No hay cuentas registradas. (Recuerda ejecutar el seed)
                                </td>
                            </tr>
                        ) : (
                            accounts.map((acc: any) => (
                                <tr key={acc.code} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                                    <td style={{ padding: '1rem', fontWeight: acc.level < 4 ? 'bold' : 'normal' }}>{acc.code}</td>
                                    <td style={{ padding: '1rem' }}>{acc.name}</td>
                                    <td style={{ padding: '1rem' }}>{acc.type}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            backgroundColor: acc.nature === 'DEBITO' ? 'hsl(var(--accent-light)/0.2)' : 'hsl(var(--gold)/0.2)',
                                            color: acc.nature === 'DEBITO' ? 'hsl(var(--accent))' : 'hsl(var(--gold))'
                                        }}>
                                            {acc.nature}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
