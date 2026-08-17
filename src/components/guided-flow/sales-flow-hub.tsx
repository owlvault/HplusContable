'use client';

import React, { useState } from 'react';
import {
    Sparkles,
    Plus,
    FileText,
    Zap,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    Search,
    ChevronRight,
    Building,
    Check,
    HelpCircle,
    RefreshCw,
    TrendingUp,
} from 'lucide-react';
import { GuidedFlowSummary, GuidedPipelineItem, quickEmitInvoice } from '@/actions/salesFlow';
import { GuidedSaleWizardModal } from './guided-sale-wizard-modal';
import { QuickPaymentModal } from './quick-payment-modal';
import { useRouter } from 'next/navigation';

interface SalesFlowHubProps {
    initialData: GuidedFlowSummary;
}

export function SalesFlowHub({ initialData }: SalesFlowHubProps) {
    const router = useRouter();
    const [data, setData] = useState<GuidedFlowSummary>(initialData);
    const [selectedTab, setSelectedTab] = useState<'ALL' | 'POR_FACTURAR' | 'POR_COBRAR' | 'COMPLETADAS'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Modals
    const [isSaleWizardOpen, setIsSaleWizardOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);

    const formatCOP = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(val);
    };

    // Filter items
    const filteredItems = data.pipelineItems.filter((item) => {
        const matchesSearch =
            item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.clientDoc.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (selectedTab === 'POR_FACTURAR') return item.stage === 'LISTA_PARA_FACTURAR' || item.stage === 'VENTA_BORRADOR';
        if (selectedTab === 'POR_COBRAR') return item.stage === 'FACTURADA_PENDIENTE_PAGO';
        if (selectedTab === 'COMPLETADAS') return item.stage === 'PAGADA';
        return true;
    });

    const handleEmitInvoice = async (invoiceId: string) => {
        setActionLoadingId(invoiceId);
        try {
            await quickEmitInvoice(invoiceId);
            router.refresh();
        } catch (err: any) {
            alert(err.message || 'Error al emitir factura');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleOpenPayment = (item: GuidedPipelineItem) => {
        setSelectedInvoiceForPayment({
            id: item.invoiceId || item.id,
            code: item.code,
            clientName: item.clientName,
            total: item.total,
            balance: item.balance,
        });
        setIsPaymentModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Master Header Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                            Flujo Comercial Guiado & Autónomo
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Centro de Operaciones: Venta ➔ Factura ➔ Cobro
                        </h1>
                        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                            Gestiona todo el ciclo comercial sin códigos contables ni complicaciones técnicas. El ERP calcula impuestos, transmite a la DIAN y asienta la partida doble automáticamente.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsSaleWizardOpen(true)}
                            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Plus className="w-4 h-4" />
                            + Nueva Venta Guiada
                        </button>
                    </div>
                </div>

                {/* 3-Step Interactive Process Roadmap */}
                <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stage 1 */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider text-blue-300 font-bold">Paso 1</div>
                            <div className="text-sm font-bold text-white">Venta Comercial</div>
                            <div className="text-xs text-slate-400">Cliente, productos y precios</div>
                        </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">Paso 2 (1 Clic)</div>
                            <div className="text-sm font-bold text-white">Factura DIAN</div>
                            <div className="text-xs text-slate-400">Validación y emisión fiscal</div>
                        </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">Paso 3 (1 Clic)</div>
                            <div className="text-sm font-bold text-white">Cobro & Asiento</div>
                            <div className="text-xs text-slate-400">Recibo de caja y bancos</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Por Facturar a la DIAN
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                            {formatCOP(data.stats.pendingBillingAmount)}
                        </div>
                        <span className="text-xs text-amber-600 font-medium mt-0.5 block">
                            {data.stats.pendingBillingCount} ventas pendientes de emisión
                        </span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl">
                        <Zap className="w-6 h-6" />
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Por Cobrar (Cartera)
                        </span>
                        <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                            {formatCOP(data.stats.pendingPaymentAmount)}
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5 block">
                            {data.stats.pendingPaymentCount} facturas con saldo abierto
                        </span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Cobrado y Liquidado
                        </span>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {formatCOP(data.stats.collectedThisMonthAmount)}
                        </div>
                        <span className="text-xs text-emerald-600 font-medium mt-0.5 block">
                            {data.stats.collectedThisMonthCount} cobros asentados
                        </span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* In-Context Action Cards */}
            {data.actionCards.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Acciones y Asistencias Inteligentes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.actionCards.map((card) => (
                            <div
                                key={card.id}
                                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-start justify-between gap-4"
                            >
                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                        {card.badgeText}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{card.title}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (card.type === 'CFO_TIP') setIsSaleWizardOpen(true);
                                        else if (card.type === 'OVERDUE_INVOICE' && card.targetId) {
                                            const item = data.pipelineItems.find((i) => i.id === card.targetId);
                                            if (item) handleOpenPayment(item);
                                        }
                                    }}
                                    className="flex-shrink-0 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition"
                                >
                                    {card.actionLabel}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pipeline Table & Filter Tabs */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                {/* Tabs & Search Bar */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl">
                        {[
                            { id: 'ALL', label: 'Todas las Operaciones' },
                            { id: 'POR_FACTURAR', label: 'Por Facturar DIAN' },
                            { id: 'POR_COBRAR', label: 'Por Cobrar' },
                            { id: 'COMPLETADAS', label: 'Completadas / Pagadas' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelectedTab(tab.id as any)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                    selectedTab === tab.id
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar cliente o factura..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-5 py-3.5">Código / Documento</th>
                                <th className="px-5 py-3.5">Cliente</th>
                                <th className="px-5 py-3.5">Fecha</th>
                                <th className="px-5 py-3.5 text-right">Total Venta</th>
                                <th className="px-5 py-3.5 text-right">Saldo Pendiente</th>
                                <th className="px-5 py-3.5 text-center">Estado del Ciclo</th>
                                <th className="px-5 py-3.5 text-right">Siguiente Acción Asistida</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                                        No hay operaciones registradas en este estado. Haz clic en{' '}
                                        <strong className="text-blue-600">+ Nueva Venta Guiada</strong> para iniciar.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => {
                                    const isLoading = actionLoadingId === item.id;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                                        >
                                            <td className="px-5 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <span>{item.code}</span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {item.clientName}
                                                </div>
                                                <div className="text-[11px] text-slate-400">{item.clientDoc}</div>
                                            </td>

                                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                                                <div>{item.date}</div>
                                                {item.dueDate && item.balance > 0 && (
                                                    <div className="text-[11px] text-amber-600 font-medium">
                                                        Vence: {item.dueDate}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-right font-extrabold text-slate-900 dark:text-white">
                                                {formatCOP(item.total)}
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                {item.balance > 0 ? (
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                                        {formatCOP(item.balance)}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                                        <Check className="w-3.5 h-3.5" /> Pagada
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-center">
                                                {item.stage === 'LISTA_PARA_FACTURAR' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                        <Zap className="w-3 h-3 text-amber-600" />
                                                        Borrador (Por Emitir)
                                                    </span>
                                                )}
                                                {item.stage === 'FACTURADA_PENDIENTE_PAGO' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                                        <Clock className="w-3 h-3 text-blue-600" />
                                                        Facturada (Por Cobrar)
                                                    </span>
                                                )}
                                                {item.stage === 'PAGADA' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Ciclo Cerrado (Pagada)
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                {item.stage === 'LISTA_PARA_FACTURAR' && (
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => handleEmitInvoice(item.id)}
                                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                                                    >
                                                        {isLoading ? (
                                                            <span>Emitiendo...</span>
                                                        ) : (
                                                            <>
                                                                <Zap className="w-3.5 h-3.5" />
                                                                Emitir a la DIAN
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                {item.stage === 'FACTURADA_PENDIENTE_PAGO' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenPayment(item)}
                                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                                                    >
                                                        <DollarSign className="w-3.5 h-3.5" />
                                                        Registrar Cobro
                                                    </button>
                                                )}

                                                {item.stage === 'PAGADA' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/facturas/${item.id}`)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition"
                                                    >
                                                        Ver Factura
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <GuidedSaleWizardModal
                isOpen={isSaleWizardOpen}
                onClose={() => setIsSaleWizardOpen(false)}
                onSuccess={() => {
                    router.refresh();
                }}
                clients={data.clients}
                bankAccounts={data.bankAccounts}
            />

            <QuickPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => {
                    setIsPaymentModalOpen(false);
                    setSelectedInvoiceForPayment(null);
                }}
                onSuccess={() => {
                    router.refresh();
                }}
                invoice={selectedInvoiceForPayment}
                bankAccounts={data.bankAccounts}
            />
        </div>
    );
}
