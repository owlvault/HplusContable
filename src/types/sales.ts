// Tipos del Módulo de Ventas
// Espejo de sql/ventas_module.sql. Los nombres de campo coinciden con las
// columnas para que las consultas de Supabase mapeen sin traducción.

// ---------------------------------------------------------------------------
// Enumeraciones
// ---------------------------------------------------------------------------

export type SalesItemType =
    | 'ROL'
    | 'ENTREGABLE'
    | 'LICENCIA'
    | 'INFRA'
    | 'SOPORTE'
    | 'REEMBOLSABLE'
    | 'OTRO';

export type SalesUnit = 'HORA' | 'DIA' | 'SPRINT' | 'MES' | 'UNIDAD' | 'GLOBAL';

export type Seniority = 'TRAINEE' | 'JUNIOR' | 'SEMISENIOR' | 'SENIOR' | 'STAFF' | 'PRINCIPAL';

export type OpportunityStage =
    | 'PROSPECCION'
    | 'CALIFICACION'
    | 'PROPUESTA'
    | 'NEGOCIACION'
    | 'GANADA'
    | 'PERDIDA'
    | 'CANCELADA';

export type LossReason =
    | 'PRECIO'
    | 'ALCANCE'
    | 'TIEMPO'
    | 'COMPETIDOR'
    | 'PRESUPUESTO'
    | 'SIN_RESPUESTA'
    | 'INTERNO'
    | 'OTRO';

export type ProposalStatus =
    | 'BORRADOR'
    | 'ENVIADA'
    | 'EN_NEGOCIACION'
    | 'GANADA'
    | 'PERDIDA'
    | 'VENCIDA'
    | 'RETIRADA';

export type EngagementModel =
    | 'FIXED_PRICE'
    | 'TIME_AND_MATERIALS'
    | 'RETAINER'
    | 'SUBSCRIPTION'
    | 'OUTCOME_BASED'
    | 'MIXTO';

export type ContractStatus = 'BORRADOR' | 'ACTIVO' | 'SUSPENDIDO' | 'FINALIZADO' | 'CANCELADO';

export type MilestoneType = 'ANTICIPO' | 'ENTREGABLE' | 'PERIODICO' | 'AVANCE' | 'RETENCION' | 'FINAL';

export type MilestoneStatus = 'PENDIENTE' | 'LISTO_FACTURAR' | 'FACTURADO' | 'COBRADO' | 'CANCELADO';

export type ProjectStatus = 'PLANEADO' | 'EN_EJECUCION' | 'EN_PAUSA' | 'CERRADO' | 'CANCELADO';

export type CostSource = 'RATE_CARD' | 'MANUAL' | 'SUBCONTRATO' | 'IMPORTADO';

export type RevenueMethod = 'POC' | 'LINEAL' | 'HITO' | 'ENTREGA';

export type NonBillableReason =
    | 'RETRABAJO'
    | 'GARANTIA'
    | 'SOBRECOSTO_ALCANCE'
    | 'CAPACITACION'
    | 'PREVENTA'
    | 'INTERNO';

export type DocumentKind =
    | 'PROPUESTA'
    | 'MODELO_FINANCIERO'
    | 'SOW'
    | 'PRESENTACION'
    | 'ANEXO'
    | 'DESCONOCIDO';

export type ImportFileStatus = 'PENDIENTE' | 'PARSEADO' | 'IMPORTADO' | 'DUPLICADO' | 'IGNORADO' | 'ERROR';

// ---------------------------------------------------------------------------
// Catálogo y precios
// ---------------------------------------------------------------------------

export interface SalesItem {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    item_type: SalesItemType;
    unit: SalesUnit;
    role_family?: string | null;
    seniority?: Seniority | null;
    revenue_account_code?: string | null;
    cost_account_code?: string | null;
    default_tax_rate: number;
    default_retention_type?: string | null;
    is_passthrough: boolean;
    is_recurring: boolean;
    is_active: boolean;
}

export interface PriceListItem {
    id: string;
    price_list_id: string;
    item_id: string;
    list_price: number;
    /** Piso de negociación. Por debajo, la propuesta escala a aprobación. */
    floor_price?: number | null;
    max_discount_rate: number;
}

/**
 * Tarifa de costo. Para personal interno el costo hora se construye desde el
 * salario; para subcontratos se captura directamente en `hourly_cost`.
 */
export interface CostRate {
    id: string;
    item_id?: string | null;
    role_family?: string | null;
    seniority?: Seniority | null;
    currency: string;
    cost_type: 'INTERNO' | 'SUBCONTRATO' | 'PASSTHROUGH';
    base_monthly_salary: number;
    /** Factor prestacional colombiano. Típico 1.45 - 1.55. */
    benefits_factor: number;
    /** Horas facturables reales al mes. Típico 140 - 160. */
    productive_hours_month: number;
    tooling_cost_month: number;
    hourly_cost: number;
    overhead_rate: number;
    valid_from: string;
    valid_to?: string | null;
    is_active: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline y propuestas
// ---------------------------------------------------------------------------

export interface Opportunity {
    id: string;
    code: string;
    name: string;
    third_party_id?: string | null;
    client_name?: string | null;
    stage: OpportunityStage;
    probability: number;
    currency: string;
    expected_amount: number;
    expected_margin: number;
    expected_close_date?: string | null;
    source?: string | null;
    owner_user_id?: string | null;
    first_contact_date?: string | null;
    closed_at?: string | null;
    loss_reason?: LossReason | null;
    loss_notes?: string | null;
}

/**
 * Línea de propuesta. Los campos marcados como derivados los calcula
 * Postgres con columnas GENERATED; el motor de `sales-calc` replica la misma
 * aritmética para poder previsualizar antes de guardar.
 */
export interface ProposalLine {
    id?: string;
    proposal_id?: string;
    line_number: number;
    item_id?: string | null;

    description: string;
    workstream?: string | null;
    phase?: string | null;
    deliverable?: string | null;
    sprint_number?: number | null;

    role_family?: string | null;
    seniority?: Seniority | null;

    quantity: number;
    unit: SalesUnit;
    /** Horas equivalentes: permite comparar líneas de unidades distintas. */
    hours: number;

    unit_list_price: number;
    discount_rate: number;
    unit_price: number;

    unit_direct_cost: number;
    unit_indirect_cost: number;
    cost_source: CostSource;
    cost_rate_id?: string | null;

    is_passthrough: boolean;
    is_optional: boolean;

    tax_rate: number;
    retention_rate: number;

    delivery_start_date?: string | null;
    delivery_end_date?: string | null;

    revenue_account_code?: string | null;
    cost_account_code?: string | null;

    // Derivados (read-only desde la base)
    list_amount?: number;
    discount_amount?: number;
    net_amount?: number;
    direct_cost_amount?: number;
    indirect_cost_amount?: number;
    tax_amount?: number;
    unit_gross_margin?: number;
    unit_operating_margin?: number;
    gross_margin_amount?: number;
    operating_margin_amount?: number;
    gross_margin_rate?: number;
    markup_multiple?: number;
    price_realization_rate?: number;

    notes?: string | null;
}

export interface ProposalAssumption {
    id?: string;
    proposal_id?: string;
    category: 'GENERAL' | 'COSTO' | 'PRECIO' | 'ALCANCE' | 'PLAZO' | 'RIESGO' | 'MACRO' | 'EQUIPO';
    key: string;
    label?: string | null;
    value_numeric?: number | null;
    value_text?: string | null;
    unit?: string | null;
    /** Celda o rango del modelo financiero de donde salió el dato. */
    source_reference?: string | null;
}

export interface ProposalScenario {
    id?: string;
    proposal_id?: string;
    name: string;
    is_base: boolean;
    probability?: number | null;
    revenue: number;
    direct_cost: number;
    indirect_cost: number;
    gross_margin: number;
    gross_margin_rate: number;
    total_hours: number;
    npv?: number | null;
    irr?: number | null;
    payback_months?: number | null;
    discount_rate?: number | null;
}

export interface Proposal {
    id: string;
    opportunity_id?: string | null;
    code: string;
    version: number;
    title: string;
    third_party_id?: string | null;
    client_name?: string | null;
    status: ProposalStatus;

    issue_date?: string | null;
    valid_until?: string | null;
    currency: string;
    fx_rate: number;
    engagement_model: EngagementModel;

    payment_terms_days: number;
    advance_payment_rate: number;
    indexation_clause?: 'NINGUNA' | 'IPC' | 'IPP' | 'SMLV' | 'FIJO' | null;
    warranty_months: number;
    contingency_rate: number;

    estimated_start_date?: string | null;
    estimated_end_date?: string | null;
    estimated_duration_months?: number | null;

    total_list_amount: number;
    total_discount_amount: number;
    total_net_amount: number;
    total_direct_cost: number;
    total_indirect_cost: number;
    total_passthrough: number;
    total_tax_amount: number;
    total_hours: number;
    gross_margin_amount: number;
    gross_margin_rate: number;
    operating_margin_amount: number;
    operating_margin_rate: number;
    revenue_per_hour: number;

    requires_approval: boolean;
    approved_by?: string | null;
    approved_at?: string | null;
    approval_notes?: string | null;

    source_file_path?: string | null;
    source_file_name?: string | null;
    source_file_hash?: string | null;
    source_model_path?: string | null;
    source_model_hash?: string | null;
    imported_at?: string | null;
    import_batch_id?: string | null;
    needs_review: boolean;
    review_notes?: string | null;

    notes?: string | null;
    owner_user_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProposalWithDetails extends Proposal {
    lines: ProposalLine[];
    assumptions?: ProposalAssumption[];
    scenarios?: ProposalScenario[];
    third_party?: { id: string; full_name: string; document_number: string } | null;
}

// ---------------------------------------------------------------------------
// Contratos y ejecución
// ---------------------------------------------------------------------------

export interface Contract {
    id: string;
    code: string;
    name: string;
    third_party_id: string;
    opportunity_id?: string | null;
    proposal_id?: string | null;
    project_id?: string | null;
    status: ContractStatus;
    engagement_model: EngagementModel;
    currency: string;
    fx_rate: number;
    contract_value: number;
    change_orders_value: number;
    signed_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    payment_terms_days: number;
    auto_renew: boolean;
    renewal_notice_days?: number | null;
    arr_amount: number;
}

export interface BillingMilestone {
    id: string;
    contract_id: string;
    project_id?: string | null;
    milestone_number: number;
    name: string;
    description?: string | null;
    milestone_type: MilestoneType;
    planned_date: string;
    actual_date?: string | null;
    percent_of_contract: number;
    amount: number;
    tax_amount: number;
    currency: string;
    status: MilestoneStatus;
    acceptance_required: boolean;
    accepted_at?: string | null;
    invoice_id?: string | null;
    invoiced_at?: string | null;
    collected_at?: string | null;
}

export interface Project {
    id: string;
    code: string;
    name: string;
    third_party_id?: string | null;
    cost_center_id?: string | null;
    contract_id?: string | null;
    manager_user_id?: string | null;
    status: ProjectStatus;
    start_date?: string | null;
    end_date?: string | null;
    currency: string;
    baseline_revenue: number;
    baseline_direct_cost: number;
    baseline_hours: number;
    baseline_margin: number;
    budget_revenue: number;
    budget_direct_cost: number;
    budget_hours: number;
    percent_complete: number;
}

export interface TimeEntry {
    id?: string;
    project_id: string;
    contract_line_id?: string | null;
    employee_id?: string | null;
    third_party_id?: string | null;
    work_date: string;
    hours: number;
    is_billable: boolean;
    non_billable_reason?: NonBillableReason | null;
    role_family?: string | null;
    seniority?: Seniority | null;
    hourly_cost: number;
    cost_amount?: number;
    description?: string | null;
}

// ---------------------------------------------------------------------------
// Vistas de seguimiento
// ---------------------------------------------------------------------------

export interface ProposalMarginView {
    id: string;
    code: string;
    version: number;
    title: string;
    status: ProposalStatus;
    currency: string;
    fx_rate: number;
    engagement_model: EngagementModel;
    client_name: string | null;
    third_party_id: string | null;
    issue_date: string | null;
    list_amount: number;
    discount_amount: number;
    net_revenue: number;
    passthrough_revenue: number;
    net_revenue_ex_passthrough: number;
    direct_cost: number;
    indirect_cost: number;
    gross_margin: number;
    operating_margin: number;
    total_hours: number;
    gross_margin_rate: number;
    gross_margin_rate_ex_passthrough: number;
    operating_margin_rate: number;
    price_realization_rate: number;
    revenue_per_hour: number;
    margin_per_hour: number;
    net_revenue_cop: number;
    gross_margin_cop: number;
}

export interface ProjectMarginTrackingView {
    project_id: string;
    code: string;
    name: string;
    status: ProjectStatus;
    client_name: string | null;
    currency: string;
    percent_complete: number;
    baseline_revenue: number;
    baseline_direct_cost: number;
    baseline_margin: number;
    baseline_hours: number;
    budget_revenue: number;
    budget_direct_cost: number;
    budget_hours: number;
    hours_worked: number;
    billable_hours: number;
    non_billable_hours: number;
    actual_direct_cost: number;
    invoiced_amount: number;
    collected_amount: number;
    ready_to_invoice_amount: number;
    backlog_amount: number;
    estimated_cost_at_completion: number;
    forecast_margin: number;
    margin_variance: number;
    hours_consumption_rate: number;
    effective_hourly_rate: number;
}

export interface PipelineView {
    id: string;
    code: string;
    name: string;
    stage: OpportunityStage;
    probability: number;
    currency: string;
    client_name: string | null;
    expected_close_date: string | null;
    owner_user_id: string | null;
    expected_amount: number;
    weighted_amount: number;
    weighted_margin: number;
    latest_proposal_code: string | null;
    latest_proposal_version: number | null;
    latest_proposal_margin_rate: number | null;
    days_to_close: number | null;
    days_in_pipeline: number | null;
}

// ---------------------------------------------------------------------------
// Importación desde la carpeta Comercial
// ---------------------------------------------------------------------------

/** Payload que produce el CLI local y consume /api/sales/import. */
export interface ImportPayload {
    source: 'ONEDRIVE_CLI' | 'UPLOAD_WEB' | 'MANUAL' | 'API';
    root_path: string;
    machine_name?: string;
    files: ImportFilePayload[];
}

export interface ImportFilePayload {
    relative_path: string;
    file_name: string;
    file_extension: string;
    file_size_bytes: number;
    file_modified_at: string;
    /** SHA-256 del contenido: clave de idempotencia del lote. */
    file_hash: string;
    detected_client_folder: string;
    document_kind: DocumentKind;
    detected_version?: string | null;
    detected_date?: string | null;
    /** 0-100. Por debajo del umbral la propuesta entra marcada para revisión. */
    parse_confidence: number;
    proposal?: ParsedProposal | null;
    warnings?: string[];
}

/** Propuesta normalizada extraída de un modelo financiero. */
export interface ParsedProposal {
    title: string;
    client_name: string;
    currency: string;
    fx_rate?: number;
    engagement_model?: EngagementModel;
    issue_date?: string | null;
    valid_until?: string | null;
    payment_terms_days?: number;
    advance_payment_rate?: number;
    contingency_rate?: number;
    estimated_start_date?: string | null;
    estimated_end_date?: string | null;
    lines: ParsedProposalLine[];
    assumptions?: ProposalAssumption[];
    scenarios?: Omit<ProposalScenario, 'id' | 'proposal_id'>[];
}

export interface ParsedProposalLine {
    line_number: number;
    description: string;
    workstream?: string | null;
    phase?: string | null;
    deliverable?: string | null;
    role_family?: string | null;
    seniority?: Seniority | null;
    quantity: number;
    unit: SalesUnit;
    hours?: number;
    unit_list_price?: number;
    discount_rate?: number;
    unit_price: number;
    unit_direct_cost?: number;
    unit_indirect_cost?: number;
    is_passthrough?: boolean;
    tax_rate?: number;
}

export interface ImportBatch {
    id: string;
    source: string;
    root_path: string | null;
    machine_name: string | null;
    status: 'EN_PROCESO' | 'COMPLETADO' | 'CON_ERRORES' | 'CANCELADO';
    files_scanned: number;
    files_imported: number;
    files_skipped: number;
    files_failed: number;
    started_at: string;
    finished_at: string | null;
    error_summary: string | null;
}

// ---------------------------------------------------------------------------
// Etiquetas y colores para la UI
// ---------------------------------------------------------------------------

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
    BORRADOR: 'Borrador',
    ENVIADA: 'Enviada',
    EN_NEGOCIACION: 'En negociación',
    GANADA: 'Ganada',
    PERDIDA: 'Perdida',
    VENCIDA: 'Vencida',
    RETIRADA: 'Retirada',
};

export const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
    BORRADOR: 'bg-gray-100 text-gray-800',
    ENVIADA: 'bg-blue-100 text-blue-800',
    EN_NEGOCIACION: 'bg-amber-100 text-amber-800',
    GANADA: 'bg-green-100 text-green-800',
    PERDIDA: 'bg-red-100 text-red-800',
    VENCIDA: 'bg-orange-100 text-orange-800',
    RETIRADA: 'bg-gray-100 text-gray-500',
};

export const STAGE_LABELS: Record<OpportunityStage, string> = {
    PROSPECCION: 'Prospección',
    CALIFICACION: 'Calificación',
    PROPUESTA: 'Propuesta',
    NEGOCIACION: 'Negociación',
    GANADA: 'Ganada',
    PERDIDA: 'Perdida',
    CANCELADA: 'Cancelada',
};

/** Orden del embudo. Determina el eje de los reportes de conversión. */
export const STAGE_ORDER: OpportunityStage[] = [
    'PROSPECCION',
    'CALIFICACION',
    'PROPUESTA',
    'NEGOCIACION',
    'GANADA',
];

export const ENGAGEMENT_MODEL_LABELS: Record<EngagementModel, string> = {
    FIXED_PRICE: 'Precio fijo',
    TIME_AND_MATERIALS: 'Tiempo y materiales',
    RETAINER: 'Retainer / bolsa de horas',
    SUBSCRIPTION: 'Suscripción',
    OUTCOME_BASED: 'Por resultado',
    MIXTO: 'Mixto',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
    PENDIENTE: 'Pendiente',
    LISTO_FACTURAR: 'Listo para facturar',
    FACTURADO: 'Facturado',
    COBRADO: 'Cobrado',
    CANCELADO: 'Cancelado',
};

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
    PRECIO: 'Precio',
    ALCANCE: 'Alcance',
    TIEMPO: 'Tiempo de entrega',
    COMPETIDOR: 'Competidor',
    PRESUPUESTO: 'Sin presupuesto',
    SIN_RESPUESTA: 'Sin respuesta',
    INTERNO: 'Decisión interna',
    OTRO: 'Otro',
};

export const UNIT_LABELS: Record<SalesUnit, string> = {
    HORA: 'Hora',
    DIA: 'Día',
    SPRINT: 'Sprint',
    MES: 'Mes',
    UNIDAD: 'Unidad',
    GLOBAL: 'Global',
};
