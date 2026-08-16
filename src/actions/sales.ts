'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { logAuditEvent } from '@/actions/audit';
import {
    buildMarginWaterfall,
    calculateProposalTotals,
    planBillingMilestones,
    summarizePipeline,
} from '@/lib/utils/sales-calc';
import type {
    ImportBatch,
    Proposal,
    PipelineView,
    ProjectMarginTrackingView,
    ProposalAssumption,
    ProposalLine,
    ProposalMarginView,
    ProposalScenario,
    ProposalStatus,
} from '@/types/sales';

const MODULE = 'ventas';

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export interface ProposalFilters {
    status?: ProposalStatus;
    clientId?: string;
    needsReview?: boolean;
    search?: string;
}

export async function getProposals(filters: ProposalFilters = {}): Promise<ProposalMarginView[]> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    let query = supabase
        .from('v_sales_proposal_margin')
        .select('*')
        .order('issue_date', { ascending: false, nullsFirst: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.clientId) query = query.eq('third_party_id', filters.clientId);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new Error(`Error al obtener propuestas: ${error.message}`);

    let rows = (data ?? []) as ProposalMarginView[];

    // La vista de márgenes no expone needs_review; se filtra contra la tabla
    // para no duplicar columnas de control en una vista analítica.
    if (filters.needsReview) {
        const { data: flagged } = await supabase
            .from('sales_proposals')
            .select('id')
            .eq('needs_review', true);
        const ids = new Set((flagged ?? []).map((r) => r.id));
        rows = rows.filter((r) => ids.has(r.id));
    }

    return rows;
}

/** Propuesta con el tercero embebido, tal como la devuelve la consulta. */
export type ProposalRecord = Proposal & {
    third_party?: { id: string; full_name: string; document_number: string } | null;
};

export interface ProposalDetail {
    proposal: ProposalRecord;
    margin: ProposalMarginView | null;
    lines: ProposalLine[];
    assumptions: ProposalAssumption[];
    scenarios: ProposalScenario[];
    waterfall: ReturnType<typeof buildMarginWaterfall>;
    /** Versiones anteriores y posteriores del mismo código de propuesta. */
    versions: { id: string; version: number; status: string; gross_margin_rate: number }[];
}

export async function getProposal(id: string): Promise<ProposalDetail> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data: proposal, error } = await supabase
        .from('sales_proposals')
        .select('*, third_party:third_parties(id, full_name, document_number)')
        .eq('id', id)
        .single();

    if (error || !proposal) throw new Error('Propuesta no encontrada');

    const [linesResult, assumptionsResult, scenariosResult, marginResult, versionsResult] =
        await Promise.all([
            supabase.from('sales_proposal_lines').select('*').eq('proposal_id', id).order('line_number'),
            supabase.from('sales_proposal_assumptions').select('*').eq('proposal_id', id).order('category'),
            supabase.from('sales_proposal_scenarios').select('*').eq('proposal_id', id).order('is_base', { ascending: false }),
            supabase.from('v_sales_proposal_margin').select('*').eq('id', id).maybeSingle(),
            supabase
                .from('sales_proposals')
                .select('id, version, status, gross_margin_rate')
                .eq('code', proposal.code)
                .order('version', { ascending: false }),
        ]);

    const lines = (linesResult.data ?? []) as ProposalLine[];

    return {
        proposal: proposal as ProposalRecord,
        margin: (marginResult.data as ProposalMarginView) ?? null,
        lines,
        assumptions: (assumptionsResult.data ?? []) as ProposalAssumption[],
        scenarios: (scenariosResult.data ?? []) as ProposalScenario[],
        waterfall: buildMarginWaterfall(calculateProposalTotals(lines)),
        versions: versionsResult.data ?? [],
    };
}

export async function getPipeline(): Promise<PipelineView[]> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('v_sales_pipeline')
        .select('*')
        .not('stage', 'in', '("GANADA","PERDIDA","CANCELADA")')
        .order('expected_close_date', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`Error al obtener el pipeline: ${error.message}`);
    return (data ?? []) as PipelineView[];
}

export async function getMarginByRole() {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('v_sales_margin_by_role')
        .select('*')
        .order('net_revenue', { ascending: false });

    if (error) throw new Error(`Error al obtener el margen por rol: ${error.message}`);
    return data ?? [];
}

export async function getProjectTracking(): Promise<ProjectMarginTrackingView[]> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('v_project_margin_tracking')
        .select('*')
        .order('margin_variance', { ascending: true }); // los peores primero

    if (error) throw new Error(`Error al obtener el seguimiento de proyectos: ${error.message}`);
    return (data ?? []) as ProjectMarginTrackingView[];
}

export async function getBacklog() {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('v_sales_backlog')
        .select('*')
        .order('planned_date', { ascending: true });

    if (error) throw new Error(`Error al obtener el backlog: ${error.message}`);
    return data ?? [];
}

export async function getImportBatches(limit = 20): Promise<ImportBatch[]> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('sales_import_batches')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Error al obtener los lotes de importación: ${error.message}`);
    return (data ?? []) as ImportBatch[];
}

export async function getImportFiles(batchId: string) {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('sales_import_files')
        .select('id, file_name, relative_path, document_kind, detected_client_folder, detected_version, status, parse_confidence, proposal_id, error_message')
        .eq('batch_id', batchId)
        .order('detected_client_folder');

    if (error) throw new Error(`Error al obtener los archivos del lote: ${error.message}`);
    return data ?? [];
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

export interface SalesDashboard {
    pipeline: ReturnType<typeof summarizePipeline>;
    wonThisYear: { count: number; amount: number; margin: number; marginRate: number };
    proposalsNeedingReview: number;
    proposalsAwaitingApproval: number;
    /** Margen bruto promedio ponderado de lo enviado y aún vivo. */
    openProposals: { count: number; amount: number; marginRate: number };
    projectsAtRisk: number;
    backlogAmount: number;
}

export async function getSalesDashboard(target = 0): Promise<SalesDashboard> {
    await enforcePermission(MODULE, 'read');
    const supabase = await createClient();

    const yearStart = `${new Date().getUTCFullYear()}-01-01`;

    const [pipelineResult, proposalsResult, reviewResult, approvalResult, trackingResult, backlogResult] =
        await Promise.all([
            supabase
                .from('sales_opportunities')
                .select('stage, probability, expected_amount, expected_margin')
                .not('stage', 'in', '("GANADA","PERDIDA","CANCELADA")'),
            supabase
                .from('v_sales_proposal_margin')
                .select('status, net_revenue, gross_margin, gross_margin_rate, issue_date'),
            supabase.from('sales_proposals').select('id', { count: 'exact', head: true }).eq('needs_review', true),
            supabase
                .from('sales_proposals')
                .select('id', { count: 'exact', head: true })
                .eq('requires_approval', true)
                .is('approved_at', null),
            supabase.from('v_project_margin_tracking').select('margin_variance'),
            supabase.from('v_sales_backlog').select('amount'),
        ]);

    const proposals = proposalsResult.data ?? [];
    const won = proposals.filter((p) => p.status === 'GANADA' && (p.issue_date ?? '') >= yearStart);
    const open = proposals.filter((p) => p.status === 'ENVIADA' || p.status === 'EN_NEGOCIACION');

    const wonAmount = sum(won.map((p) => Number(p.net_revenue) || 0));
    const wonMargin = sum(won.map((p) => Number(p.gross_margin) || 0));
    const openAmount = sum(open.map((p) => Number(p.net_revenue) || 0));
    const openMargin = sum(open.map((p) => Number(p.gross_margin) || 0));

    return {
        pipeline: summarizePipeline(
            (pipelineResult.data ?? []).map((o) => ({
                stage: o.stage,
                probability: Number(o.probability) || 0,
                expected_amount: Number(o.expected_amount) || 0,
                expected_margin: Number(o.expected_margin) || 0,
            })),
            target
        ),
        wonThisYear: {
            count: won.length,
            amount: wonAmount,
            margin: wonMargin,
            marginRate: wonAmount > 0 ? round2((wonMargin / wonAmount) * 100) : 0,
        },
        proposalsNeedingReview: reviewResult.count ?? 0,
        proposalsAwaitingApproval: approvalResult.count ?? 0,
        openProposals: {
            count: open.length,
            amount: openAmount,
            marginRate: openAmount > 0 ? round2((openMargin / openAmount) * 100) : 0,
        },
        // Un proyecto está en riesgo cuando ya se espera ganar menos de lo
        // que se prometió al vender.
        projectsAtRisk: (trackingResult.data ?? []).filter((p) => Number(p.margin_variance) < 0).length,
        backlogAmount: sum((backlogResult.data ?? []).map((b) => Number(b.amount) || 0)),
    };
}

function sum(values: number[]): number {
    return round2(values.reduce((a, b) => a + b, 0));
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------

export async function updateProposalStatus(id: string, status: ProposalStatus) {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const { data: before } = await supabase
        .from('sales_proposals')
        .select('status, code, version')
        .eq('id', id)
        .single();

    const { error } = await supabase
        .from('sales_proposals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);

    await logAuditEvent(
        'sales_proposals',
        id,
        'UPDATE',
        before,
        { status },
        `Propuesta ${before?.code} v${before?.version}: ${before?.status} -> ${status}`
    );

    revalidatePath('/ventas');
    revalidatePath(`/ventas/propuestas/${id}`);
    return { success: true };
}

/** Aprueba una propuesta que quedó marcada por el gobierno de precios. */
export async function approveProposal(id: string, notes?: string) {
    const userId = await enforcePermission(MODULE, 'approve');
    const supabase = await createClient();

    const { error } = await supabase
        .from('sales_proposals')
        .update({
            approved_by: userId,
            approved_at: new Date().toISOString(),
            approval_notes: notes ?? null,
        })
        .eq('id', id)
        .is('approved_at', null);

    if (error) throw new Error(`No se pudo aprobar la propuesta: ${error.message}`);

    await logAuditEvent('sales_proposals', id, 'APPROVE', null, { notes }, 'Aprobación de precios');

    revalidatePath(`/ventas/propuestas/${id}`);
    return { success: true };
}

/** Levanta la marca de revisión tras validar los datos importados. */
export async function clearReviewFlag(id: string) {
    await enforcePermission(MODULE, 'write');
    const supabase = await createClient();

    const { error } = await supabase
        .from('sales_proposals')
        .update({ needs_review: false, review_notes: null })
        .eq('id', id);

    if (error) throw new Error(`No se pudo actualizar la propuesta: ${error.message}`);

    await logAuditEvent('sales_proposals', id, 'UPDATE', null, null, 'Revisión de importación completada');
    revalidatePath(`/ventas/propuestas/${id}`);
    return { success: true };
}

export interface WinProposalInput {
    proposalId: string;
    projectCode: string;
    startDate: string;
    durationMonths: number;
    retentionRate?: number;
}

/**
 * Convierte una propuesta ganada en contrato, proyecto y plan de facturación.
 *
 * Es la bisagra transversal del ERP: a partir de aquí el mismo número que se
 * vendió alimenta Facturación, Cartera, Tesorería y Contabilidad, y la
 * propuesta queda congelada como línea base para medir el margen real.
 */
export async function winProposal(input: WinProposalInput) {
    const userId = await enforcePermission(MODULE, 'approve');
    const supabase = await createClient();

    const { data: proposal, error: proposalError } = await supabase
        .from('sales_proposals')
        .select('*')
        .eq('id', input.proposalId)
        .single();

    if (proposalError || !proposal) throw new Error('Propuesta no encontrada');
    if (proposal.status === 'GANADA') throw new Error('La propuesta ya fue marcada como ganada.');
    if (!proposal.third_party_id) {
        throw new Error(
            'La propuesta no tiene un tercero asociado. Crea el cliente en Terceros y vincúlalo antes de ganarla.'
        );
    }
    if (proposal.requires_approval && !proposal.approved_at) {
        throw new Error('La propuesta requiere aprobación de precios antes de poder ganarse.');
    }

    const { data: lines } = await supabase
        .from('sales_proposal_lines')
        .select('*')
        .eq('proposal_id', input.proposalId)
        .order('line_number');

    const proposalLines = (lines ?? []) as ProposalLine[];
    if (proposalLines.length === 0) throw new Error('La propuesta no tiene líneas.');

    const totals = calculateProposalTotals(proposalLines);

    // 1. Proyecto: la dimensión que a partir de ahora etiqueta asientos,
    //    facturas, nómina y movimientos bancarios.
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
            code: input.projectCode,
            name: proposal.title,
            third_party_id: proposal.third_party_id,
            manager_user_id: userId,
            status: 'PLANEADO',
            start_date: input.startDate,
            currency: proposal.currency,
            baseline_revenue: totals.total_net_amount,
            baseline_direct_cost: totals.total_direct_cost,
            baseline_hours: totals.total_hours,
            baseline_margin: totals.gross_margin_amount,
            budget_revenue: totals.total_net_amount,
            budget_direct_cost: totals.total_direct_cost,
            budget_hours: totals.total_hours,
        })
        .select('id')
        .single();

    if (projectError) throw new Error(`No se pudo crear el proyecto: ${projectError.message}`);

    // 2. Contrato
    const { data: contract, error: contractError } = await supabase
        .from('sales_contracts')
        .insert({
            code: `CTR-${input.projectCode}`,
            name: proposal.title,
            third_party_id: proposal.third_party_id,
            opportunity_id: proposal.opportunity_id,
            proposal_id: proposal.id,
            project_id: project.id,
            status: 'ACTIVO',
            engagement_model: proposal.engagement_model,
            currency: proposal.currency,
            fx_rate: proposal.fx_rate,
            contract_value: totals.total_net_amount,
            signed_date: new Date().toISOString().slice(0, 10),
            start_date: input.startDate,
            payment_terms_days: proposal.payment_terms_days,
            created_by: userId,
        })
        .select('id')
        .single();

    if (contractError) {
        await supabase.from('projects').delete().eq('id', project.id);
        throw new Error(`No se pudo crear el contrato: ${contractError.message}`);
    }

    await supabase.from('projects').update({ contract_id: contract.id }).eq('id', project.id);

    // 3. Líneas congeladas: la línea base de margen, inmune a cambios
    //    posteriores en la propuesta.
    const { error: contractLinesError } = await supabase.from('sales_contract_lines').insert(
        proposalLines.map((line) => ({
            contract_id: contract.id,
            proposal_line_id: line.id,
            line_number: line.line_number,
            item_id: line.item_id,
            description: line.description,
            workstream: line.workstream,
            deliverable: line.deliverable,
            role_family: line.role_family,
            seniority: line.seniority,
            quantity: line.quantity,
            unit: line.unit,
            hours: line.hours,
            unit_price: line.unit_price,
            unit_direct_cost: line.unit_direct_cost,
            unit_indirect_cost: line.unit_indirect_cost,
            is_passthrough: line.is_passthrough,
            tax_rate: line.tax_rate,
            revenue_account_code: line.revenue_account_code,
            cost_account_code: line.cost_account_code,
        }))
    );

    if (contractLinesError) {
        throw new Error(`No se pudieron congelar las líneas: ${contractLinesError.message}`);
    }

    // 4. Hitos de facturación: futuras facturas y caja proyectada.
    const milestones = planBillingMilestones({
        contract_value: totals.total_net_amount,
        start_date: input.startDate,
        duration_months: input.durationMonths,
        advance_payment_rate: Number(proposal.advance_payment_rate) || 0,
        engagement_model: proposal.engagement_model,
        retention_rate: input.retentionRate ?? 0,
    });

    const { error: milestonesError } = await supabase.from('sales_billing_milestones').insert(
        milestones.map((m) => ({
            contract_id: contract.id,
            project_id: project.id,
            milestone_number: m.milestone_number,
            name: m.name,
            milestone_type: m.milestone_type,
            planned_date: m.planned_date,
            percent_of_contract: m.percent_of_contract,
            amount: m.amount,
            tax_amount: round2((m.amount * 19) / 100),
            currency: proposal.currency,
            status: 'PENDIENTE',
        }))
    );

    if (milestonesError) {
        throw new Error(`No se pudo crear el plan de facturación: ${milestonesError.message}`);
    }

    // 5. Cerrar el ciclo comercial
    await supabase
        .from('sales_proposals')
        .update({ status: 'GANADA', updated_at: new Date().toISOString() })
        .eq('id', proposal.id);

    if (proposal.opportunity_id) {
        await supabase
            .from('sales_opportunities')
            .update({
                stage: 'GANADA',
                probability: 100,
                closed_at: new Date().toISOString().slice(0, 10),
            })
            .eq('id', proposal.opportunity_id);
    }

    // Las demás versiones de la misma propuesta quedan retiradas para que
    // no sigan contando en el pipeline ni en los promedios de margen.
    await supabase
        .from('sales_proposals')
        .update({ status: 'RETIRADA' })
        .eq('code', proposal.code)
        .neq('id', proposal.id)
        .in('status', ['BORRADOR', 'ENVIADA', 'EN_NEGOCIACION']);

    await logAuditEvent(
        'sales_proposals',
        proposal.id,
        'APPROVE',
        null,
        { contract_id: contract.id, project_id: project.id },
        `Propuesta ganada: contrato CTR-${input.projectCode}, proyecto ${input.projectCode}, ${milestones.length} hitos`
    );

    revalidatePath('/ventas');
    revalidatePath(`/ventas/propuestas/${proposal.id}`);

    return {
        success: true,
        contract_id: contract.id,
        project_id: project.id,
        milestones: milestones.length,
    };
}
