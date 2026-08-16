import Link from 'next/link';
import { Upload } from 'lucide-react';
import {
    getPipeline,
    getProjectTracking,
    getProposals,
    getSalesDashboard,
} from '@/actions/sales';
import { SalesStats } from '@/components/ventas/sales-stats';
import { ProposalsTable } from '@/components/ventas/proposals-table';
import { PipelineTable } from '@/components/ventas/pipeline-table';
import { ProjectTrackingTable } from '@/components/ventas/project-tracking-table';

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
    { id: 'propuestas', label: 'Propuestas' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'proyectos', label: 'Seguimiento de proyectos' },
] as const;

export default async function VentasPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; revision?: string }>;
}) {
    const params = await searchParams;
    const activeTab = TABS.some((t) => t.id === params.tab) ? params.tab! : 'propuestas';
    const onlyReview = params.revision === '1';

    // Las consultas fallan por separado: que falte una vista recién creada no
    // debe dejar la página entera en blanco.
    const [dashboard, proposals, pipeline, projects] = await Promise.all([
        getSalesDashboard().catch(() => EMPTY_DASHBOARD),
        getProposals({ needsReview: onlyReview || undefined }).catch(() => []),
        getPipeline().catch(() => []),
        getProjectTracking().catch(() => []),
    ]);

    return (
        <div data-testid="ventas-page">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
                    <p className="text-gray-500 mt-1">
                        Propuestas, precios de venta y márgenes unitarios con seguimiento hasta la ejecución
                    </p>
                </div>
                <Link
                    href="/ventas/importar"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                    <Upload size={16} />
                    Importar carpeta Comercial
                </Link>
            </div>

            <SalesStats dashboard={dashboard} />

            <div className="flex gap-1 border-b border-gray-200 mb-4">
                {TABS.map((tab) => (
                    <Link
                        key={tab.id}
                        href={`/ventas?tab=${tab.id}`}
                        className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            {activeTab === 'propuestas' && (
                <>
                    {onlyReview && (
                        <div className="mb-3 flex items-center justify-between text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
                            <span>Mostrando solo propuestas importadas pendientes de revisión.</span>
                            <Link href="/ventas?tab=propuestas" className="underline">
                                Ver todas
                            </Link>
                        </div>
                    )}
                    <ProposalsTable proposals={proposals} />
                </>
            )}

            {activeTab === 'pipeline' && (
                <PipelineTable opportunities={pipeline} byStage={dashboard.pipeline.by_stage} />
            )}

            {activeTab === 'proyectos' && <ProjectTrackingTable projects={projects} />}
        </div>
    );
}
