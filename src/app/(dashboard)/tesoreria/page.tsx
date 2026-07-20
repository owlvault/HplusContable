import { Suspense } from 'react';
import { getCashFlowStats, getBankAccounts, getBankMovements } from '@/actions/tesoreria';
import { TesoreriaStats } from '@/components/tesoreria/tesoreria-stats';
import { BankAccountsList } from '@/components/tesoreria/bank-accounts-list';
import { MovementsTable } from '@/components/tesoreria/movements-table';

export default async function TesoreriaPage() {
    const [stats, accounts, movements] = await Promise.all([
        getCashFlowStats().catch(() => ({
            totalBalance: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            accountsCount: 0,
            pendingReconciliation: 0,
        })),
        getBankAccounts().catch(() => []),
        getBankMovements().catch(() => []),
    ]);

    return (
        <div data-testid="tesoreria-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Tesorería</h1>
                <p className="text-gray-500 mt-1">
                    Gestiona tus cuentas bancarias y flujo de caja
                </p>
            </div>

            <TesoreriaStats stats={stats} />

            <div className="space-y-6">
                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <BankAccountsList accounts={accounts} />
                </Suspense>

                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <MovementsTable movements={movements} accounts={accounts} />
                </Suspense>
            </div>
        </div>
    );
}
