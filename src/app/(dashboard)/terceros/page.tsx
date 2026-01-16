
import { getThirdParties } from '@/actions/third-parties';

export default async function TercerosPage() {
    const parties = await getThirdParties().catch(() => []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem' }}>Gestión de Terceros</h1>
                <button className="btn btn-primary">Nuevo Tercero</button>
            </div>

            <div className="card">
                {parties.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>No hay terceros registrados.</p>
                ) : (
                    <ul>
                        {parties.map((p: any) => (
                            <li key={p.id}>{p.full_name}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
