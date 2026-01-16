
import { getAccounts } from '@/actions/puc';
import { PucTable } from '@/components/puc/puc-table';

export default async function PucPage() {
    const accounts = await getAccounts().catch(() => []);

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Plan Único de Cuentas</h1>
                <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.875rem' }}>
                    Gestiona las cuentas contables según el PUC colombiano
                </p>
            </div>

            <PucTable accounts={accounts || []} />
        </div>
    );
}
