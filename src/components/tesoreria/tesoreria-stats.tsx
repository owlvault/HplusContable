'use client';

import { Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface TesoreriaStatsProps {
    stats: {
        totalBalance: number;
        totalDeposits: number;
        totalWithdrawals: number;
        accountsCount: number;
        pendingReconciliation: number;
    };
}

export function TesoreriaStats({ stats }: TesoreriaStatsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const cards = [
        {
            title: 'Saldo Total',
            value: formatCurrency(stats.totalBalance),
            subtitle: `${stats.accountsCount} cuentas activas`,
            icon: Wallet,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            title: 'Ingresos (Mes)',
            value: formatCurrency(stats.totalDeposits),
            subtitle: 'Depósitos del mes',
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            title: 'Egresos (Mes)',
            value: formatCurrency(stats.totalWithdrawals),
            subtitle: 'Retiros del mes',
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            title: 'Por Conciliar',
            value: stats.pendingReconciliation.toString(),
            subtitle: 'Movimientos pendientes',
            icon: RefreshCw,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="tesoreria-stats">
            {cards.map((card) => (
                <div key={card.title} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">{card.title}</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                            <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
                        </div>
                        <div className={`p-3 rounded-full ${card.bgColor}`}>
                            <card.icon className={card.color} size={24} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
