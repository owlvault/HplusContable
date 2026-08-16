'use client';

import {
    formatCurrency,
    formatNumber,
    formatPercent,
    marginColorClass,
} from '@/lib/utils/format';
import type { ProjectMarginTrackingView } from '@/types/sales';

/**
 * Plan contra real por proyecto.
 *
 * La columna que importa es la desviación: cuánto margen se ha perdido (o
 * ganado) frente a lo que se prometió al firmar. Se ordena con lo peor
 * arriba porque eso es lo que hay que atender.
 */
export function ProjectTrackingTable({ projects }: { projects: ProjectMarginTrackingView[] }) {
    if (projects.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                Todavía no hay proyectos en ejecución. Se crean al ganar una propuesta.
            </div>
        );
    }

    const num = (v: unknown) => Number(v) || 0;

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="text-left font-medium px-4 py-3">Proyecto</th>
                            <th className="text-left font-medium px-4 py-3">Cliente</th>
                            <th className="text-right font-medium px-4 py-3">Avance</th>
                            <th className="text-right font-medium px-4 py-3">Horas usadas</th>
                            <th className="text-right font-medium px-4 py-3">No facturables</th>
                            <th className="text-right font-medium px-4 py-3">Costo real</th>
                            <th className="text-right font-medium px-4 py-3">Costo a terminar</th>
                            <th className="text-right font-medium px-4 py-3">Margen vendido</th>
                            <th className="text-right font-medium px-4 py-3">Margen esperado</th>
                            <th className="text-right font-medium px-4 py-3">Desviación</th>
                            <th className="text-right font-medium px-4 py-3">Por facturar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {projects.map((p) => {
                            const variance = num(p.margin_variance);
                            const consumption = num(p.hours_consumption_rate);
                            const progress = num(p.percent_complete);
                            // Consumir horas más rápido que el avance es la señal
                            // temprana de que el margen se va a deteriorar.
                            const burningFast = consumption > progress + 10;

                            return (
                                <tr key={p.project_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{p.code}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[16rem]">{p.name}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{p.client_name ?? '—'}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{formatPercent(progress, 0)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        <span className={burningFast ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                            {formatNumber(num(p.hours_worked))}
                                        </span>
                                        <div className="text-[11px] text-gray-400">
                                            {formatPercent(consumption, 0)} del plan
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                        {formatNumber(num(p.non_billable_hours))}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                        {formatCurrency(num(p.actual_direct_cost), p.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                        {formatCurrency(num(p.estimated_cost_at_completion), p.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                        {formatCurrency(num(p.baseline_margin), p.currency)}
                                    </td>
                                    <td
                                        className={`px-4 py-3 text-right tabular-nums font-medium ${marginColorClass(
                                            num(p.budget_revenue) > 0
                                                ? (num(p.forecast_margin) / num(p.budget_revenue)) * 100
                                                : 0
                                        )}`}
                                    >
                                        {formatCurrency(num(p.forecast_margin), p.currency)}
                                    </td>
                                    <td
                                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                                            variance < 0 ? 'text-red-600' : 'text-green-600'
                                        }`}
                                    >
                                        {variance > 0 ? '+' : ''}
                                        {formatCurrency(variance, p.currency)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                        {formatCurrency(num(p.ready_to_invoice_amount) + num(p.backlog_amount), p.currency)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
