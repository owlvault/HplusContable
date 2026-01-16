
import { getThirdParties } from '@/actions/third-parties';
import { TercerosTable } from '@/components/terceros/terceros-table';

export default async function TercerosPage() {
    const parties = await getThirdParties().catch(() => []);

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Gestión de Terceros</h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Administra clientes, proveedores y empleados
                </p>
            </div>

            <TercerosTable parties={parties || []} />
        </div>
    );
}
