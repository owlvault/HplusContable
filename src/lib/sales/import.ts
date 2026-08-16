import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateProposalTotals, evaluatePricingGovernance } from '@/lib/utils/sales-calc';
import type {
    ImportFilePayload,
    ParsedProposalLine,
    ProposalLine,
} from '@/types/sales';

export interface ImportOptions {
    /** Confianza mínima para no marcar la propuesta como pendiente de revisión. */
    minConfidence?: number;
    /** Reemplaza una propuesta ya importada si el archivo cambió. */
    overwrite?: boolean;
    userId?: string | null;
}

export interface ImportFileResult {
    file_name: string;
    relative_path: string;
    status: 'IMPORTADO' | 'DUPLICADO' | 'IGNORADO' | 'ERROR';
    proposal_id?: string;
    proposal_code?: string;
    needs_review?: boolean;
    message?: string;
}

export interface ImportSummary {
    batch_id: string;
    imported: number;
    skipped: number;
    failed: number;
    results: ImportFileResult[];
    errors: { file_name: string; message: string }[];
}

const DEFAULT_MIN_CONFIDENCE = 60;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}

/** Extrae el número mayor de una versión detectada ("v2.1" -> 2). */
function versionNumber(detected?: string | null): number | null {
    if (!detected) return null;
    const m = String(detected).match(/(\d+)/);
    return m ? Number(m[1]) : null;
}

/**
 * Completa una línea parseada con los valores por defecto del ERP.
 * El parser deja nulos los campos que no encontró; aquí se decide qué
 * significa cada ausencia, en un solo lugar.
 */
function toProposalLine(parsed: ParsedProposalLine): ProposalLine {
    const unitPrice = parsed.unit_price ?? 0;
    const listPrice = parsed.unit_list_price ?? unitPrice;

    return {
        line_number: parsed.line_number,
        description: parsed.description,
        workstream: parsed.workstream ?? null,
        phase: parsed.phase ?? null,
        deliverable: parsed.deliverable ?? null,
        role_family: parsed.role_family ?? null,
        seniority: parsed.seniority ?? null,
        quantity: parsed.quantity ?? 0,
        unit: parsed.unit ?? 'HORA',
        hours: parsed.hours ?? (parsed.unit === 'HORA' ? (parsed.quantity ?? 0) : 0),
        unit_list_price: listPrice,
        discount_rate: parsed.discount_rate ?? 0,
        unit_price: unitPrice,
        unit_direct_cost: parsed.unit_direct_cost ?? 0,
        unit_indirect_cost: parsed.unit_indirect_cost ?? 0,
        // Todo lo que entra por archivo se marca como tal: distingue el costo
        // que vino de un modelo del que se tomó de la tarifa vigente.
        cost_source: 'IMPORTADO',
        is_passthrough: parsed.is_passthrough ?? false,
        is_optional: false,
        tax_rate: parsed.tax_rate ?? 19,
        retention_rate: 0,
    };
}

/**
 * Busca el tercero que corresponde a la carpeta del cliente.
 * No crea terceros: dar de alta un cliente es una decisión contable que
 * necesita NIT y régimen, no el nombre de una carpeta.
 */
async function resolveClient(
    supabase: SupabaseClient,
    clientFolder: string,
    clientName?: string | null
): Promise<string | null> {
    const candidates = [clientFolder, clientName].filter(Boolean) as string[];

    for (const candidate of candidates) {
        const { data: byFolder } = await supabase
            .from('third_parties')
            .select('id')
            .eq('commercial_folder', candidate)
            .limit(1);
        if (byFolder?.length) return byFolder[0].id;

        // Coincidencia por nombre: "Bancolombia" contra "Bancolombia S.A.".
        const { data: byName } = await supabase
            .from('third_parties')
            .select('id')
            .ilike('full_name', `${candidate.split(/\s+/).slice(0, 2).join(' ')}%`)
            .eq('is_client', true)
            .limit(2);
        if (byName?.length === 1) return byName[0].id;
    }

    return null;
}

/** Reutiliza la oportunidad de esa carpeta o crea una nueva en etapa PROPUESTA. */
async function resolveOpportunity(
    supabase: SupabaseClient,
    params: {
        clientFolder: string;
        clientName: string;
        thirdPartyId: string | null;
        title: string;
        expectedAmount: number;
        expectedMargin: number;
        currency: string;
    }
): Promise<string | null> {
    const code = `OPP-${slugify(params.clientFolder)}-${slugify(params.title)}`.slice(0, 30);

    const { data: existing } = await supabase
        .from('sales_opportunities')
        .select('id')
        .eq('code', code)
        .limit(1);
    if (existing?.length) return existing[0].id;

    const { data, error } = await supabase
        .from('sales_opportunities')
        .insert({
            code,
            name: params.title,
            third_party_id: params.thirdPartyId,
            client_name: params.clientName,
            stage: 'PROPUESTA',
            // Probabilidad neutra: la ajusta el comercial, no el importador.
            probability: 50,
            currency: params.currency,
            expected_amount: params.expectedAmount,
            expected_margin: params.expectedMargin,
        })
        .select('id')
        .single();

    if (error) {
        console.error('No se pudo crear la oportunidad:', error.message);
        return null;
    }
    return data.id;
}

// ---------------------------------------------------------------------------
// Ingesta
// ---------------------------------------------------------------------------

/** Abre un lote de importación o continúa uno existente. */
export async function openImportBatch(
    supabase: SupabaseClient,
    params: { source: string; rootPath: string; machineName?: string; userId?: string | null }
): Promise<string> {
    const { data, error } = await supabase
        .from('sales_import_batches')
        .insert({
            source: params.source,
            root_path: params.rootPath,
            machine_name: params.machineName ?? null,
            status: 'EN_PROCESO',
            created_by: params.userId ?? null,
        })
        .select('id')
        .single();

    if (error) throw new Error(`No se pudo abrir el lote de importación: ${error.message}`);
    return data.id;
}

/**
 * Suma los resultados de un lote parcial a los contadores del batch.
 *
 * El CLI envía por trozos, así que los contadores se acumulan en vez de
 * sobrescribirse: de lo contrario el batch solo reflejaría el último trozo.
 */
export async function accumulateBatchCounters(
    supabase: SupabaseClient,
    batchId: string,
    delta: { imported: number; skipped: number; failed: number; scanned: number }
): Promise<void> {
    const { data: current } = await supabase
        .from('sales_import_batches')
        .select('files_scanned, files_imported, files_skipped, files_failed')
        .eq('id', batchId)
        .single();

    await supabase
        .from('sales_import_batches')
        .update({
            files_scanned: (current?.files_scanned ?? 0) + delta.scanned,
            files_imported: (current?.files_imported ?? 0) + delta.imported,
            files_skipped: (current?.files_skipped ?? 0) + delta.skipped,
            files_failed: (current?.files_failed ?? 0) + delta.failed,
        })
        .eq('id', batchId);
}

export async function closeImportBatch(
    supabase: SupabaseClient,
    batchId: string,
    errorSummary?: string | null
): Promise<void> {
    const { data: batch } = await supabase
        .from('sales_import_batches')
        .select('files_failed')
        .eq('id', batchId)
        .single();

    await supabase
        .from('sales_import_batches')
        .update({
            status: (batch?.files_failed ?? 0) > 0 ? 'CON_ERRORES' : 'COMPLETADO',
            finished_at: new Date().toISOString(),
            error_summary: errorSummary ?? null,
        })
        .eq('id', batchId);
}

/**
 * Procesa un lote de archivos del manifiesto.
 *
 * Idempotente por `file_hash`: reejecutar el sincronizador sobre la misma
 * carpeta no duplica propuestas. Un archivo que cambió produce un hash
 * nuevo y, por tanto, una versión nueva de la propuesta.
 */
export async function importFiles(
    supabase: SupabaseClient,
    batchId: string,
    files: ImportFilePayload[],
    options: ImportOptions = {}
): Promise<Omit<ImportSummary, 'batch_id'>> {
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const results: ImportFileResult[] = [];
    const errors: { file_name: string; message: string }[] = [];

    for (const file of files) {
        try {
            const result = await importOneFile(supabase, batchId, file, minConfidence, options);
            results.push(result);
            if (result.status === 'ERROR') {
                errors.push({ file_name: file.file_name, message: result.message ?? 'Error desconocido' });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.push({
                file_name: file.file_name,
                relative_path: file.relative_path,
                status: 'ERROR',
                message,
            });
            errors.push({ file_name: file.file_name, message });
        }
    }

    return {
        imported: results.filter((r) => r.status === 'IMPORTADO').length,
        skipped: results.filter((r) => r.status === 'DUPLICADO' || r.status === 'IGNORADO').length,
        failed: results.filter((r) => r.status === 'ERROR').length,
        results,
        errors,
    };
}

async function importOneFile(
    supabase: SupabaseClient,
    batchId: string,
    file: ImportFilePayload,
    minConfidence: number,
    options: ImportOptions
): Promise<ImportFileResult> {
    const base = { file_name: file.file_name, relative_path: file.relative_path };

    // 1. Idempotencia por hash de contenido.
    const { data: existing } = await supabase
        .from('sales_import_files')
        .select('id, proposal_id, status')
        .eq('file_hash', file.file_hash)
        .limit(1);

    if (existing?.length && !options.overwrite) {
        return {
            ...base,
            status: 'DUPLICADO',
            proposal_id: existing[0].proposal_id ?? undefined,
            message: 'Ya fue importado en un lote anterior.',
        };
    }

    const thirdPartyId = await resolveClient(
        supabase,
        file.detected_client_folder,
        file.proposal?.client_name
    );

    // 2. Los documentos sin líneas (docx, pdf, pptx) se registran para
    //    trazabilidad, pero no generan propuesta.
    if (!file.proposal || file.proposal.lines.length === 0) {
        await supabase.from('sales_import_files').upsert(
            {
                batch_id: batchId,
                relative_path: file.relative_path,
                file_name: file.file_name,
                file_extension: file.file_extension,
                file_size_bytes: file.file_size_bytes,
                file_modified_at: file.file_modified_at,
                file_hash: file.file_hash,
                detected_client_folder: file.detected_client_folder,
                detected_client_id: thirdPartyId,
                document_kind: file.document_kind,
                detected_version: file.detected_version ?? null,
                detected_date: file.detected_date ?? null,
                status: 'IGNORADO',
                parsed_payload: null,
                parse_confidence: file.parse_confidence ?? 0,
                error_message: file.warnings?.join(' | ') ?? null,
            },
            { onConflict: 'file_hash' }
        );

        return { ...base, status: 'IGNORADO', message: 'Documento registrado sin líneas.' };
    }

    // 3. Cálculo de la economía de la propuesta.
    const lines = file.proposal.lines.map(toProposalLine);
    const totals = calculateProposalTotals(lines);
    const governance = evaluatePricingGovernance(lines, new Map());

    const confidence = file.parse_confidence ?? 0;
    const needsReview = confidence < minConfidence || totals.total_direct_cost === 0;

    const reviewNotes = [
        confidence < minConfidence ? `Confianza de extracción ${confidence}%.` : null,
        totals.total_direct_cost === 0 ? 'Sin costos: el margen no es calculable.' : null,
        ...(file.warnings ?? []),
    ].filter(Boolean).join(' | ') || null;

    const clientName = file.proposal.client_name || file.detected_client_folder;
    const code = `PRO-${slugify(file.detected_client_folder)}-${slugify(file.proposal.title)}`.slice(0, 40);

    // 4. Versión: la del nombre del archivo, o la siguiente disponible.
    let version = versionNumber(file.detected_version);
    if (version == null) {
        const { data: previous } = await supabase
            .from('sales_proposals')
            .select('version')
            .eq('code', code)
            .order('version', { ascending: false })
            .limit(1);
        version = previous?.length ? previous[0].version + 1 : 1;
    }

    const opportunityId = await resolveOpportunity(supabase, {
        clientFolder: file.detected_client_folder,
        clientName,
        thirdPartyId,
        title: file.proposal.title,
        expectedAmount: totals.total_net_amount,
        expectedMargin: totals.gross_margin_amount,
        currency: file.proposal.currency,
    });

    const proposalRow = {
        opportunity_id: opportunityId,
        code,
        version,
        title: file.proposal.title,
        third_party_id: thirdPartyId,
        client_name: clientName,
        status: 'BORRADOR' as const,
        issue_date: file.proposal.issue_date ?? file.detected_date ?? null,
        valid_until: file.proposal.valid_until ?? null,
        currency: file.proposal.currency,
        fx_rate: file.proposal.fx_rate ?? 1,
        engagement_model: file.proposal.engagement_model ?? 'FIXED_PRICE',
        payment_terms_days: file.proposal.payment_terms_days ?? 30,
        advance_payment_rate: file.proposal.advance_payment_rate ?? 0,
        contingency_rate: file.proposal.contingency_rate ?? 0,
        estimated_start_date: file.proposal.estimated_start_date ?? null,
        estimated_end_date: file.proposal.estimated_end_date ?? null,

        total_list_amount: totals.total_list_amount,
        total_discount_amount: totals.total_discount_amount,
        total_net_amount: totals.total_net_amount,
        total_direct_cost: totals.total_direct_cost,
        total_indirect_cost: totals.total_indirect_cost,
        total_passthrough: totals.total_passthrough,
        total_tax_amount: totals.total_tax_amount,
        total_hours: totals.total_hours,
        gross_margin_amount: totals.gross_margin_amount,
        gross_margin_rate: totals.gross_margin_rate,
        operating_margin_amount: totals.operating_margin_amount,
        operating_margin_rate: totals.operating_margin_rate,
        revenue_per_hour: totals.revenue_per_hour,

        requires_approval: governance.requiresApproval,
        source_file_path: file.relative_path,
        source_file_name: file.file_name,
        source_file_hash: file.file_hash,
        source_model_path: file.relative_path,
        source_model_hash: file.file_hash,
        imported_at: new Date().toISOString(),
        import_batch_id: batchId,
        needs_review: needsReview,
        review_notes: reviewNotes,
    };

    const { data: proposal, error: proposalError } = await supabase
        .from('sales_proposals')
        .upsert(proposalRow, { onConflict: 'code,version' })
        .select('id')
        .single();

    if (proposalError) {
        return { ...base, status: 'ERROR', message: `Propuesta: ${proposalError.message}` };
    }

    // 5. Las líneas se reemplazan por completo: una reimportación refleja
    //    el archivo tal como está hoy, no una mezcla con lo anterior.
    await supabase.from('sales_proposal_lines').delete().eq('proposal_id', proposal.id);

    const { error: linesError } = await supabase
        .from('sales_proposal_lines')
        .insert(lines.map((line) => ({ ...line, proposal_id: proposal.id })));

    if (linesError) {
        return { ...base, status: 'ERROR', message: `Líneas: ${linesError.message}` };
    }

    if (file.proposal.assumptions?.length) {
        await supabase.from('sales_proposal_assumptions').delete().eq('proposal_id', proposal.id);
        await supabase
            .from('sales_proposal_assumptions')
            .insert(file.proposal.assumptions.map((a) => ({ ...a, proposal_id: proposal.id })));
    }

    if (file.proposal.scenarios?.length) {
        await supabase.from('sales_proposal_scenarios').delete().eq('proposal_id', proposal.id);
        await supabase
            .from('sales_proposal_scenarios')
            .insert(file.proposal.scenarios.map((s) => ({ ...s, proposal_id: proposal.id })));
    }

    await supabase.from('sales_import_files').upsert(
        {
            batch_id: batchId,
            relative_path: file.relative_path,
            file_name: file.file_name,
            file_extension: file.file_extension,
            file_size_bytes: file.file_size_bytes,
            file_modified_at: file.file_modified_at,
            file_hash: file.file_hash,
            detected_client_folder: file.detected_client_folder,
            detected_client_id: thirdPartyId,
            document_kind: file.document_kind,
            detected_version: file.detected_version ?? null,
            detected_date: file.detected_date ?? null,
            status: 'IMPORTADO',
            parsed_payload: file.proposal as unknown as Record<string, unknown>,
            parse_confidence: confidence,
            proposal_id: proposal.id,
            error_message: file.warnings?.length ? file.warnings.join(' | ') : null,
        },
        { onConflict: 'file_hash' }
    );

    return {
        ...base,
        status: 'IMPORTADO',
        proposal_id: proposal.id,
        proposal_code: `${code} v${version}`,
        needs_review: needsReview,
    };
}
