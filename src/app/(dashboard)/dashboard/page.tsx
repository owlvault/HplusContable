import Link from 'next/link';
import { getFinancialMetrics } from '@/actions/dashboard';
import { getGuidedFlowData } from '@/actions/salesFlow';
import { FinancialChart } from '@/components/dashboard/financial-chart';
import { DigiCFO } from '@/components/dashboard/digi-cfo';
import { AlertsWidget } from '@/components/dashboard/alerts-widget';
import { formatCOP } from '@/lib/utils/dian';
import {
    Sparkles,
    FileText,
    Zap,
    DollarSign,
    ArrowRight,
    TrendingUp,
    CheckCircle2,
    Clock,
    Plus,
} from 'lucide-react';

export default async function DashboardPage() {
    const [metrics, guidedData] = await Promise.all([
        getFinancialMetrics().catch(() => ({ income: 0, expenses: 0, profit: 0, history: [] })),
        getGuidedFlowData().catch(() => ({
            pipelineItems: [],
            stats: {
                pendingBillingCount: 0,
                pendingBillingAmount: 0,
                pendingPaymentCount: 0,
                pendingPaymentAmount: 0,
                collectedThisMonthCount: 0,
                collectedThisMonthAmount: 0,
            },
            clients: [],
            bankAccounts: [],
            actionCards: [],
        })),
    ]);

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            {/* Guided Flow Master Hero */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                            CFO Autónomo • Flujo Comercial Asistido
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Tu Empresa al Día: Venta ➔ Factura ➔ Cobro
                        </h1>
                        <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Diseñado para que cualquier miembro de tu equipo opere sin conocimientos contables. El sistema calcula impuestos, emite a la DIAN y concilia la contabilidad en segundo plano.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/ventas?tab=flujo"
                            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs md:text-sm rounded-2xl shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Plus className="w-4 h-4" />
                            + Nueva Venta Guiada
                        </Link>
                    </div>
                </div>

                {/* 3 Step Interactive Process Cards */}
                <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Step 1 */}
                    <Link
                        href="/ventas?tab=flujo"
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-blue-300">Paso 1: Comercial</div>
                                <div className="text-sm font-bold text-white">Ventas y Cotizaciones</div>
                                <div className="text-xs text-slate-400">
                                    {guidedData.stats.pendingBillingCount} borradores activos
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition" />
                    </Link>

                    {/* Step 2 */}
                    <Link
                        href="/facturas"
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-amber-300">Paso 2: Fiscal</div>
                                <div className="text-sm font-bold text-white">Facturación DIAN</div>
                                <div className="text-xs text-slate-400">Emisión en 1 Clic</div>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition" />
                    </Link>

                    {/* Step 3 */}
                    <Link
                        href="/cartera"
                        className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-emerald-300">Paso 3: Tesorería</div>
                                <div className="text-sm font-bold text-white">Cobro & Cartera</div>
                                <div className="text-xs text-slate-400">
                                    {formatCOP(guidedData.stats.pendingPaymentAmount)} por cobrar
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition" />
                    </Link>
                </div>
            </div>

            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Ingresos Totales (Mes)
                        </span>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {formatCOP(metrics.income)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                            Facturación acumulada en el período
                        </span>
                    </div>
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Gastos & Costos
                        </span>
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                            {formatCOP(metrics.expenses)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                            Compras y nómina procesada
                        </span>
                    </div>
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>

                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Utilidad Operacional
                        </span>
                        <div
                            className={`text-2xl font-black mt-1 ${
                                metrics.profit >= 0
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            }`}
                        >
                            {formatCOP(metrics.profit)}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                            Resultado neto en libros NIIF
                        </span>
                    </div>
                    <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Main Operational & Financial Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Cash Flow Chart */}
                <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Flujo de Caja y Proyección Mensual
                            </h3>
                            <p className="text-xs text-slate-500">
                                Evolución comparativa de ingresos vs egresos en tiempo real
                            </p>
                        </div>
                    </div>
                    {metrics.history.length > 0 ? (
                        <FinancialChart data={metrics.history} />
                    ) : (
                        <div className="h-72 flex items-center justify-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            No hay suficientes transacciones registradas para graficar este mes.
                        </div>
                    )}
                </div>

                {/* AI CFO Assistant Widget */}
                <div className="space-y-6">
                    <DigiCFO />
                    <AlertsWidget />
                </div>
            </div>
        </div>
    );
}
