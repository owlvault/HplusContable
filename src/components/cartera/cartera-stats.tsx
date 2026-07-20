'use client';

import { TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';

interface CarteraStatsProps {
    stats: {
        totalReceivables: number;
        totalPayables: number;
        overdueReceivables: number;
        overduePayables: number;
        receivablesCount: number;
        payablesCount: number;
    };
}

export function CarteraStats({ stats }: CarteraStatsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const cards = [
        {
            title: 'Por Cobrar',
            value: formatCurrency(stats.totalReceivables),
            subtitle: `${stats.receivablesCount} documentos`,
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            title: 'Por Pagar',
            value: formatCurrency(stats.totalPayables),
            subtitle: `${stats.payablesCount} documentos`,
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            title: 'Vencido (Cobrar)',
            value: formatCurrency(stats.overdueReceivables),
            subtitle: 'Requiere atención',
            icon: AlertTriangle,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
        {
            title: 'Vencido (Pagar)',
            value: formatCurrency(stats.overduePayables),
            subtitle: 'Requiere atención',
            icon: Clock,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="cartera-stats">
            {cards.map((card) => (
                <div
                    key={card.title}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                >
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
