
import { getFinancialMetrics } from '@/actions/dashboard';
import { FinancialChart } from '@/components/dashboard/financial-chart';
import { DigiCFO } from '@/components/dashboard/digi-cfo';
import { formatCOP } from '@/lib/utils/dian';

export default async function DashboardPage() {
    const metrics = await getFinancialMetrics().catch(() => ({ income: 0, expenses: 0, profit: 0, history: [] }));

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem' }}>Resumen Financiero</h1>

            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card">
                    <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>Ingresos Totales</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'hsl(var(--accent))' }}>{formatCOP(metrics.income)}</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>Gastos Totales</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'hsl(var(--error))' }}>{formatCOP(metrics.expenses)}</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }}>Utilidad Neta</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: metrics.profit >= 0 ? 'hsl(var(--accent))' : 'hsl(var(--error))' }}>
                        {formatCOP(metrics.profit)}
                    </div>
                </div>
            </div>

            {/* MAIN GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>

                {/* CHART SECTION */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>Flujo de Caja Mensual</h3>
                    {metrics.history.length > 0 ? (
                        <FinancialChart data={metrics.history} />
                    ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))' }}>
                            No hay datos suficientes para graficar.
                        </div>
                    )}
                </div>

                {/* AI SECTION */}
                <DigiCFO />

            </div>
        </div>
    );
}
