'use client';

import { TrendingUp, TrendingDown, Clock, CreditCard } from 'lucide-react';

interface InvoiceStatsProps {
    stats: {
        totalVentas: number;
        totalCompras: number;
        pendientesCobro: number;
        pendientesPago: number;
        countVentas: number;
        countCompras: number;
    } | null;
}

export function InvoiceStats({ stats }: InvoiceStatsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    if (!stats) {
        return null;
    }

    const cards = [
        {
            title: 'Total Ventas',
            value: formatCurrency(stats.totalVentas),
            subtitle: `${stats.countVentas} facturas`,
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            title: 'Total Compras',
            value: formatCurrency(stats.totalCompras),
            subtitle: `${stats.countCompras} facturas`,
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            title: 'Por Cobrar',
            value: formatCurrency(stats.pendientesCobro),
            subtitle: 'Pendiente de pago',
            icon: Clock,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
        {
            title: 'Por Pagar',
            value: formatCurrency(stats.pendientesPago),
            subtitle: 'Pendiente de pago',
            icon: CreditCard,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="invoice-stats">
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
