import Link from 'next/link';
import { Upload, Sparkles, FileText, Layers, FolderKanban } from 'lucide-react';
import {
    getPipeline,
    getProjectTracking,
    getProposals,
    getSalesDashboard,
} from '@/actions/sales';
import { getGuidedFlowData } from '@/actions/salesFlow';
import { SalesStats } from '@/components/ventas/sales-stats';
import { ProposalsTable } from '@/components/ventas/proposals-table';
import { PipelineTable } from '@/components/ventas/pipeline-table';
import { ProjectTrackingTable } from '@/components/ventas/project-tracking-table';
import { SalesFlowHub } from '@/components/guided-flow/sales-flow-hub';

const EMPTY_DASHBOARD = {
    pipeline: { total_amount: 0, weighted_amount: 0, weighted_margin: 0, coverage_ratio: 0, by_stage: {} },
    wonThisYear: { count: 0, amount: 0, margin: 0, marginRate: 0 },
    proposalsNeedingReview: 0,
    proposalsAwaitingApproval: 0,
    openProposals: { count: 0, amount: 0, marginRate: 0 },
    projectsAtRisk: 0,
    backlogAmount: 0,
};

const TABS = [
    { id: 'flujo', label: '🚀 Flujo Guiado (Venta ➔ Factura ➔ Cobro)', icon: Sparkles },
    { id: 'propuestas', label: 'Propuestas y Cotizaciones', icon: FileText },
    { id: 'pipeline', label: 'Pipeline Comercial', icon: Layers },
    { id: 'proyectos', label: 'Seguimiento de Proyectos', icon: FolderKanban },
] as const;

export default async function VentasPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; revision?: string }>;
}) {
    const params = await searchParams;
    const activeTab = TABS.some((t) => t.id === params.tab) ? params.tab! : 'flujo';
    const onlyReview = params.revision === '1';

    const [guidedData, dashboard, proposals, pipeline, projects] = await Promise.all([
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
        getSalesDashboard().catch(() => EMPTY_DASHBOARD),
        getProposals({ needsReview: onlyReview || undefined }).catch(() => []),
        getPipeline().catch(() => []),
        getProjectTracking().catch(() => []),
    ]);

    return (
        <div data-testid="ventas-page" className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap gap-2">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isCurrent = activeTab === tab.id;

                        return (
                            <Link
                                key={tab.id}
                                href={`/ventas?tab=${tab.id}`}
                                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
                                    isCurrent
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>

                <Link
                    href="/ventas/importar"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                    <Upload size={14} />
                    Importar Excel Comercial
                </Link>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'flujo' && <SalesFlowHub initialData={guidedData} />}

            {activeTab === 'propuestas' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <SalesStats dashboard={dashboard} />
                    {onlyReview && (
                        <div className="mb-3 flex items-center justify-between text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5">
                            <span>Mostrando solo propuestas importadas pendientes de revisión.</span>
                            <Link href="/ventas?tab=propuestas" className="underline font-bold">
                                Ver todas
                            </Link>
                        </div>
                    )}
                    <ProposalsTable proposals={proposals} />
                </div>
            )}

            {activeTab === 'pipeline' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <SalesStats dashboard={dashboard} />
                    <PipelineTable opportunities={pipeline} byStage={dashboard.pipeline.by_stage} />
                </div>
            )}

            {activeTab === 'proyectos' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <ProjectTrackingTable projects={projects} />
                </div>
            )}
        </div>
    );
}
