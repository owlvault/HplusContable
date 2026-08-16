'use client';

import { AlertTriangle, Briefcase, Filter, Send, ShieldCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { formatCompact, formatPercent, marginColorClass } from '@/lib/utils/format';
import type { SalesDashboard } from '@/actions/sales';

export function SalesStats({ dashboard }: { dashboard: SalesDashboard }) {
    const cards = [
        {
            title: 'Pipeline ponderado',
            value: formatCompact(dashboard.pipeline.weighted_amount),
            subtitle: `${formatCompact(dashboard.pipeline.total_amount)} sin ponderar`,
            icon: Filter,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            title: 'Propuestas vivas',
            value: formatCompact(dashboard.openProposals.amount),
            subtitle: `${dashboard.openProposals.count} enviadas · margen ${formatPercent(dashboard.openProposals.marginRate)}`,
            icon: Send,
            color: marginColorClass(dashboard.openProposals.marginRate),
            bgColor: 'bg-indigo-50',
        },
        {
            title: 'Ganado en el año',
            value: formatCompact(dashboard.wonThisYear.amount),
            subtitle: `${dashboard.wonThisYear.count} contratos · margen ${formatPercent(dashboard.wonThisYear.marginRate)}`,
            icon: TrendingUp,
            color: marginColorClass(dashboard.wonThisYear.marginRate),
            bgColor: 'bg-green-50',
        },
        {
            title: 'Backlog por facturar',
            value: formatCompact(dashboard.backlogAmount),
            subtitle: 'Hitos contratados pendientes',
            icon: Briefcase,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
    ];

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4" data-testid="sales-stats">
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

            {/* Cosas que requieren una decisión humana antes de confiar en los números */}
            {(dashboard.proposalsNeedingReview > 0 ||
                dashboard.proposalsAwaitingApproval > 0 ||
                dashboard.projectsAtRisk > 0) && (
                <div className="flex flex-wrap gap-3 mb-6">
                    {dashboard.proposalsNeedingReview > 0 && (
                        <Link
                            href="/ventas?revision=1"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm hover:bg-amber-100"
                        >
                            <AlertTriangle size={16} />
                            {dashboard.proposalsNeedingReview} propuesta(s) importada(s) por revisar
                        </Link>
                    )}
                    {dashboard.proposalsAwaitingApproval > 0 && (
                        <span className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
                            <ShieldCheck size={16} />
                            {dashboard.proposalsAwaitingApproval} esperan aprobación de precios
                        </span>
                    )}
                    {dashboard.projectsAtRisk > 0 && (
                        <span className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-sm">
                            <AlertTriangle size={16} />
                            {dashboard.projectsAtRisk} proyecto(s) por debajo del margen vendido
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
