'use client';

import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import {
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    marginBadgeClass,
} from '@/lib/utils/format';
import { PROPOSAL_STATUS_COLORS, PROPOSAL_STATUS_LABELS } from '@/types/sales';
import type { ProposalMarginView, ProposalStatus } from '@/types/sales';

export interface ProposalRow extends ProposalMarginView {
    needs_review?: boolean;
    requires_approval?: boolean;
    approved_at?: string | null;
}

export function ProposalsTable({ proposals }: { proposals: ProposalRow[] }) {
    if (proposals.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No hay propuestas todavía.</p>
                <p className="text-sm text-gray-400 mt-1">
                    Ejecuta el sincronizador sobre la carpeta Comercial para cargarlas.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="text-left font-medium px-4 py-3">Propuesta</th>
                            <th className="text-left font-medium px-4 py-3">Cliente</th>
                            <th className="text-left font-medium px-4 py-3">Estado</th>
                            <th className="text-right font-medium px-4 py-3">Ingreso neto</th>
                            <th className="text-right font-medium px-4 py-3">Costo directo</th>
                            <th className="text-right font-medium px-4 py-3">Margen</th>
                            <th className="text-right font-medium px-4 py-3">Horas</th>
                            <th className="text-right font-medium px-4 py-3">$/hora</th>
                            <th className="text-right font-medium px-4 py-3">Realización</th>
                            <th className="text-left font-medium px-4 py-3">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {proposals.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/ventas/propuestas/${p.id}`}
                                        className="font-medium text-blue-600 hover:underline"
                                    >
                                        {p.code} <span className="text-gray-400">v{p.version}</span>
                                    </Link>
                                    <div className="text-xs text-gray-500 truncate max-w-xs">{p.title}</div>
                                    <div className="flex gap-1 mt-1">
                                        {p.needs_review && (
                                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                <AlertTriangle size={11} /> Revisar
                                            </span>
                                        )}
                                        {p.requires_approval && !p.approved_at && (
                                            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                                <ShieldAlert size={11} /> Aprobación
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{p.client_name ?? '—'}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${PROPOSAL_STATUS_COLORS[p.status as ProposalStatus] ?? 'bg-gray-100 text-gray-700'}`}
                                    >
                                        {PROPOSAL_STATUS_LABELS[p.status as ProposalStatus] ?? p.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {formatCurrency(p.net_revenue, p.currency)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {formatCurrency(p.direct_cost, p.currency)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span
                                        className={`inline-block px-2 py-1 rounded border text-xs font-medium tabular-nums ${marginBadgeClass(p.gross_margin_rate)}`}
                                    >
                                        {formatPercent(p.gross_margin_rate)}
                                    </span>
                                    <div className="text-xs text-gray-500 tabular-nums mt-1">
                                        {formatCurrency(p.gross_margin, p.currency)}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {formatNumber(p.total_hours)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {formatCurrency(p.revenue_per_hour, p.currency)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                                    {formatPercent(p.price_realization_rate)}
                                </td>
                                <td className="px-4 py-3 text-gray-500">{formatDate(p.issue_date)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
