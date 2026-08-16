'use client';

import { formatCurrency, formatNumber, formatPercent, marginColorClass } from '@/lib/utils/format';
import { UNIT_LABELS } from '@/types/sales';
import type { ProposalLine, SalesUnit } from '@/types/sales';

/**
 * Detalle línea por línea con precio y margen unitario.
 *
 * Es el nivel al que se toman las decisiones comerciales reales: no se
 * negocia "la propuesta", se negocia la tarifa de un rol concreto.
 */
export function ProposalLinesTable({
    lines,
    currency = 'COP',
}: {
    lines: ProposalLine[];
    currency?: string;
}) {
    if (lines.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                Esta propuesta no tiene líneas.
            </div>
        );
    }

    const num = (v: unknown) => Number(v) || 0;

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Detalle de líneas</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                    Precio y margen unitario. El factor es cuántas veces el precio cubre el costo.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="text-left font-medium px-3 py-2">#</th>
                            <th className="text-left font-medium px-3 py-2">Concepto</th>
                            <th className="text-left font-medium px-3 py-2">Rol</th>
                            <th className="text-right font-medium px-3 py-2">Cant.</th>
                            <th className="text-right font-medium px-3 py-2">Horas</th>
                            <th className="text-right font-medium px-3 py-2">P. lista</th>
                            <th className="text-right font-medium px-3 py-2">Dcto</th>
                            <th className="text-right font-medium px-3 py-2">P. unitario</th>
                            <th className="text-right font-medium px-3 py-2">Costo unit.</th>
                            <th className="text-right font-medium px-3 py-2">Margen unit.</th>
                            <th className="text-right font-medium px-3 py-2">%</th>
                            <th className="text-right font-medium px-3 py-2">Factor</th>
                            <th className="text-right font-medium px-3 py-2">Neto</th>
                            <th className="text-right font-medium px-3 py-2">Margen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {lines.map((line) => (
                            <tr key={line.id ?? line.line_number} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400">{line.line_number}</td>
                                <td className="px-3 py-2">
                                    <div className="text-gray-900">{line.description}</div>
                                    <div className="flex gap-1 mt-0.5">
                                        {line.is_passthrough && (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                Reembolsable
                                            </span>
                                        )}
                                        {line.is_optional && (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                                Opcional
                                            </span>
                                        )}
                                        {line.workstream && (
                                            <span className="text-[11px] text-gray-400">{line.workstream}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-xs">
                                    {line.role_family ?? '—'}
                                    {line.seniority && <div className="text-gray-400">{line.seniority}</div>}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatNumber(num(line.quantity), 0)}
                                    <div className="text-[11px] text-gray-400">
                                        {UNIT_LABELS[line.unit as SalesUnit] ?? line.unit}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                    {formatNumber(num(line.hours))}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                    {formatCurrency(num(line.unit_list_price), currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {num(line.discount_rate) > 0 ? (
                                        <span className="text-red-600">{formatPercent(num(line.discount_rate))}</span>
                                    ) : (
                                        <span className="text-gray-300">—</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                    {formatCurrency(num(line.unit_price), currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                    {num(line.unit_direct_cost) > 0 ? (
                                        formatCurrency(num(line.unit_direct_cost), currency)
                                    ) : (
                                        <span className="text-amber-600" title="Sin costo: el margen no es confiable">
                                            sin costo
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatCurrency(num(line.unit_gross_margin), currency)}
                                </td>
                                <td
                                    className={`px-3 py-2 text-right tabular-nums font-medium ${marginColorClass(num(line.gross_margin_rate))}`}
                                >
                                    {formatPercent(num(line.gross_margin_rate))}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                    {num(line.markup_multiple) > 0 ? `${num(line.markup_multiple).toFixed(2)}x` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatCurrency(num(line.net_amount), currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {formatCurrency(num(line.gross_margin_amount), currency)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
