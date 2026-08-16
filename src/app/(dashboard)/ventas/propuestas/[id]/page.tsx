import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { getProposal } from '@/actions/sales';
import { MarginWaterfall } from '@/components/ventas/margin-waterfall';
import { ProposalLinesTable } from '@/components/ventas/proposal-lines-table';
import {
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    marginBadgeClass,
} from '@/lib/utils/format';
import {
    ENGAGEMENT_MODEL_LABELS,
    PROPOSAL_STATUS_COLORS,
    PROPOSAL_STATUS_LABELS,
} from '@/types/sales';
import type { EngagementModel, ProposalStatus } from '@/types/sales';

export default async function PropuestaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let detail;
    try {
        detail = await getProposal(id);
    } catch {
        notFound();
    }

    const { proposal: p, margin, lines, assumptions, scenarios, waterfall, versions } = detail;
    const currency = p.currency ?? 'COP';

    const kpis = [
        { label: 'Ingreso neto', value: formatCurrency(margin?.net_revenue ?? p.total_net_amount, currency) },
        { label: 'Costo directo', value: formatCurrency(margin?.direct_cost ?? p.total_direct_cost, currency) },
        { label: 'Margen bruto', value: formatCurrency(margin?.gross_margin ?? p.gross_margin_amount, currency) },
        { label: 'Horas', value: formatNumber(margin?.total_hours ?? p.total_hours) },
        { label: 'Ingreso por hora', value: formatCurrency(margin?.revenue_per_hour ?? p.revenue_per_hour, currency) },
        { label: 'Margen por hora', value: formatCurrency(margin?.margin_per_hour ?? 0, currency) },
    ];

    return (
        <div data-testid="propuesta-detalle">
            <Link href="/ventas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
                <ArrowLeft size={16} /> Volver a Ventas
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900">{p.title}</h1>
                        <span
                            className={`text-xs px-2 py-1 rounded-full ${PROPOSAL_STATUS_COLORS[p.status as ProposalStatus] ?? 'bg-gray-100'}`}
                        >
                            {PROPOSAL_STATUS_LABELS[p.status as ProposalStatus] ?? p.status}
                        </span>
                        <span
                            className={`text-xs px-2 py-1 rounded border font-medium ${marginBadgeClass(margin?.gross_margin_rate ?? p.gross_margin_rate)}`}
                        >
                            Margen {formatPercent(margin?.gross_margin_rate ?? p.gross_margin_rate)}
                        </span>
                    </div>
                    <p className="text-gray-500 mt-1">
                        {p.code} v{p.version} · {p.client_name ?? p.third_party?.full_name ?? 'Cliente sin identificar'} ·{' '}
                        {ENGAGEMENT_MODEL_LABELS[p.engagement_model as EngagementModel] ?? p.engagement_model}
                    </p>
                </div>

                {versions.length > 1 && (
                    <div className="flex items-center gap-1 text-sm">
                        <span className="text-gray-400 mr-1">Versiones:</span>
                        {versions.map((v) => (
                            <Link
                                key={v.id}
                                href={`/ventas/propuestas/${v.id}`}
                                className={`px-2 py-1 rounded border ${
                                    v.id === id
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                                title={`Margen ${formatPercent(v.gross_margin_rate)}`}
                            >
                                v{v.version}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Avisos que condicionan cuánto confiar en estos números */}
            {(p.needs_review || (p.requires_approval && !p.approved_at)) && (
                <div className="space-y-2 mb-6">
                    {p.needs_review && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                            <div>
                                <strong>Importada con datos por confirmar.</strong>
                                <div className="mt-0.5">{p.review_notes ?? 'Revisa las líneas contra el modelo original.'}</div>
                            </div>
                        </div>
                    )}
                    {p.requires_approval && !p.approved_at && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-900 rounded-lg px-4 py-3 text-sm">
                            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                            <div>
                                <strong>Requiere aprobación de precios.</strong>
                                <div className="mt-0.5">
                                    Alguna línea baja del piso de la lista o el margen queda por debajo del mínimo.
                                    No puede marcarse como ganada sin aprobación.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-3">
                        <p className="text-xs text-gray-500">{kpi.label}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2">
                    <MarginWaterfall steps={waterfall} currency={currency} />
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Condiciones comerciales</h3>
                    <dl className="space-y-2 text-sm">
                        <Row label="Emitida" value={formatDate(p.issue_date)} />
                        <Row label="Vigente hasta" value={formatDate(p.valid_until)} />
                        <Row label="Moneda" value={`${currency}${Number(p.fx_rate) !== 1 ? ` · TRM ${formatNumber(p.fx_rate, 2)}` : ''}`} />
                        <Row label="Plazo de pago" value={`${p.payment_terms_days} días`} />
                        <Row label="Anticipo" value={formatPercent(p.advance_payment_rate)} />
                        <Row label="Contingencia" value={formatPercent(p.contingency_rate)} />
                        <Row label="Indexación" value={p.indexation_clause ?? 'Ninguna'} />
                        <Row label="Garantía" value={`${p.warranty_months ?? 0} meses`} />
                        <Row label="Inicio estimado" value={formatDate(p.estimated_start_date)} />
                    </dl>

                    {p.source_file_name && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Origen</p>
                            <p className="flex items-start gap-1.5 text-xs text-gray-600 break-all">
                                <FileSpreadsheet size={14} className="mt-0.5 shrink-0 text-gray-400" />
                                {p.source_file_path}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6">
                <ProposalLinesTable lines={lines} currency={currency} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scenarios.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">Escenarios del modelo</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left font-medium px-4 py-2">Escenario</th>
                                    <th className="text-right font-medium px-4 py-2">Ingreso</th>
                                    <th className="text-right font-medium px-4 py-2">Margen</th>
                                    <th className="text-right font-medium px-4 py-2">%</th>
                                    <th className="text-right font-medium px-4 py-2">TIR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {scenarios.map((s) => (
                                    <tr key={s.name}>
                                        <td className="px-4 py-2">
                                            {s.name}
                                            {s.is_base && (
                                                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                                    base
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(s.revenue, currency)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(s.gross_margin, currency)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{formatPercent(s.gross_margin_rate)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">
                                            {s.irr != null ? formatPercent(Number(s.irr) * 100) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {assumptions.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">Supuestos del modelo financiero</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Con la celda de origen, para poder auditar el precio.</p>
                        </div>
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-gray-100">
                                {assumptions.map((a) => (
                                    <tr key={a.key}>
                                        <td className="px-4 py-2">
                                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mr-2">
                                                {a.category}
                                            </span>
                                            {a.key.replace(/_/g, ' ')}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                                            {a.value_numeric != null ? formatNumber(a.value_numeric, 2) : a.value_text}
                                            {a.unit ? ` ${a.unit}` : ''}
                                        </td>
                                        <td className="px-4 py-2 text-right text-xs text-gray-400">{a.source_reference}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-gray-900 text-right">{value}</dd>
        </div>
    );
}
