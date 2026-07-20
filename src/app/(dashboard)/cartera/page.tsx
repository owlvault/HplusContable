import { Suspense } from 'react';
import { getCarteraStats, getReceivables, getPayables, getOverdueAlerts } from '@/actions/cartera';
import { CarteraStats } from '@/components/cartera/cartera-stats';
import { AgingTable } from '@/components/cartera/aging-table';
import { DocumentsTable } from '@/components/cartera/documents-table';
import { AlertsPanel } from '@/components/cartera/alerts-panel';

export default async function CarteraPage() {
    const [stats, receivables, payables, alerts] = await Promise.all([
        getCarteraStats().catch(() => ({
            totalReceivables: 0,
            totalPayables: 0,
            overdueReceivables: 0,
            overduePayables: 0,
            receivablesCount: 0,
            payablesCount: 0,
            agingReceivables: [],
            agingPayables: [],
        })),
        getReceivables().catch(() => []),
        getPayables().catch(() => []),
        getOverdueAlerts().catch(() => []),
    ]);

    return (
        <div data-testid="cartera-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Cartera</h1>
                <p className="text-gray-500 mt-1">
                    Gestiona tus cuentas por cobrar y por pagar
                </p>
            </div>

            <CarteraStats stats={stats} />

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="mb-6">
                    <AlertsPanel alerts={alerts} />
                </div>
            )}

            {/* Aging Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <AgingTable
                        title="Antigüedad de Cartera - Por Cobrar"
                        data={stats.agingReceivables}
                        type="receivable"
                    />
                </Suspense>

                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <AgingTable
                        title="Antigüedad de Cartera - Por Pagar"
                        data={stats.agingPayables}
                        type="payable"
                    />
                </Suspense>
            </div>

            {/* Documents Tables */}
            <div className="space-y-6">
                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <DocumentsTable
                        documents={receivables}
                        type="receivable"
                        title="Cuentas por Cobrar"
                    />
                </Suspense>

                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <DocumentsTable
                        documents={payables}
                        type="payable"
                        title="Cuentas por Pagar"
                    />
                </Suspense>
            </div>
        </div>
    );
}
