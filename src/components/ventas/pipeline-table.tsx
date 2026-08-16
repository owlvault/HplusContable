'use client';

import { formatCompact, formatCurrency, formatDate, formatPercent } from '@/lib/utils/format';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/sales';
import type { OpportunityStage, PipelineView } from '@/types/sales';

const STAGE_COLORS: Record<string, string> = {
    PROSPECCION: 'bg-gray-100 text-gray-700',
    CALIFICACION: 'bg-blue-100 text-blue-700',
    PROPUESTA: 'bg-indigo-100 text-indigo-700',
    NEGOCIACION: 'bg-amber-100 text-amber-700',
};

export function PipelineTable({
    opportunities,
    byStage,
}: {
    opportunities: PipelineView[];
    byStage: Record<string, { count: number; amount: number; weighted: number }>;
}) {
    const funnel = STAGE_ORDER.filter((s) => s !== 'GANADA');

    return (
        <div className="space-y-4">
            {/* Embudo: valor bruto y ponderado en cada etapa */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {funnel.map((stage) => {
                    const bucket = byStage[stage] ?? { count: 0, amount: 0, weighted: 0 };
                    return (
                        <div key={stage} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100'}`}>
                                    {STAGE_LABELS[stage as OpportunityStage]}
                                </span>
                                <span className="text-xs text-gray-400">{bucket.count}</span>
                            </div>
                            <p className="text-lg font-bold text-gray-900 mt-2 tabular-nums">
                                {formatCompact(bucket.weighted)}
                            </p>
                            <p className="text-xs text-gray-400 tabular-nums">
                                {formatCompact(bucket.amount)} sin ponderar
                            </p>
                        </div>
                    );
                })}
            </div>

            {opportunities.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                    No hay oportunidades abiertas.
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left font-medium px-4 py-3">Oportunidad</th>
                                    <th className="text-left font-medium px-4 py-3">Cliente</th>
                                    <th className="text-left font-medium px-4 py-3">Etapa</th>
                                    <th className="text-right font-medium px-4 py-3">Prob.</th>
                                    <th className="text-right font-medium px-4 py-3">Valor</th>
                                    <th className="text-right font-medium px-4 py-3">Ponderado</th>
                                    <th className="text-right font-medium px-4 py-3">Margen prop.</th>
                                    <th className="text-left font-medium px-4 py-3">Cierre</th>
                                    <th className="text-right font-medium px-4 py-3">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {opportunities.map((o) => (
                                    <tr key={o.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="text-gray-900">{o.name}</div>
                                            <div className="text-xs text-gray-400">
                                                {o.code}
                                                {o.latest_proposal_code &&
                                                    ` · ${o.latest_proposal_code} v${o.latest_proposal_version}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{o.client_name ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-full ${STAGE_COLORS[o.stage] ?? 'bg-gray-100'}`}>
                                                {STAGE_LABELS[o.stage] ?? o.stage}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{formatPercent(o.probability, 0)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                            {formatCurrency(o.expected_amount, o.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                                            {formatCurrency(o.weighted_amount, o.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                            {o.latest_proposal_margin_rate != null
                                                ? formatPercent(o.latest_proposal_margin_rate)
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{formatDate(o.expected_close_date)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {o.days_to_close == null ? (
                                                <span className="text-gray-300">—</span>
                                            ) : o.days_to_close < 0 ? (
                                                <span className="text-red-600">{o.days_to_close}</span>
                                            ) : (
                                                <span className="text-gray-600">{o.days_to_close}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
