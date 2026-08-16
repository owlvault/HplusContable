// Motor de precios y márgenes del Módulo de Ventas.
//
// Replica exactamente la aritmética de las columnas GENERATED de
// sql/ventas_module.sql para que la previsualización en la UI y lo que
// finalmente persiste Postgres nunca difieran.

import type {
    CostRate,
    EngagementModel,
    PriceListItem,
    ProposalLine,
    SalesUnit,
} from '@/types/sales';

/** Redondeo a 2 decimales, igual que ROUND(x, 2) en Postgres. */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Redondeo a 4 decimales para precios y costos unitarios. */
export function round4(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function safeDiv(numerator: number, denominator: number, fallback = 0): number {
    return denominator === 0 || !Number.isFinite(denominator) ? fallback : numerator / denominator;
}

// ---------------------------------------------------------------------------
// 1. Construcción del costo hora
// ---------------------------------------------------------------------------

export interface HourlyCostInput {
    /** Salario base mensual del perfil. */
    base_monthly_salary: number;
    /**
     * Factor prestacional: salud, pensión, ARL, parafiscales, cesantías,
     * intereses, prima y vacaciones. En Colombia suele estar entre 1.45 y 1.55.
     */
    benefits_factor: number;
    /**
     * Horas realmente facturables al mes. No son 160: hay vacaciones,
     * capacitación, preventa y administración. Rango usual 140 - 160.
     */
    productive_hours_month: number;
    /** Licencias, equipo y herramientas por persona/mes. */
    tooling_cost_month?: number;
}

export interface HourlyCostBreakdown {
    loaded_monthly_cost: number;
    hourly_cost: number;
    /** Sobrecosto mensual que aportan las prestaciones sobre el salario base. */
    benefits_overhead: number;
}

/**
 * Convierte un salario mensual en costo hora cargado.
 *
 * Es la pieza que hace auditable el margen: sin ella, el "costo" de una
 * propuesta es un número que alguien escribió en una celda.
 */
export function calculateHourlyCost(input: HourlyCostInput): HourlyCostBreakdown {
    const tooling = input.tooling_cost_month ?? 0;
    const loaded = input.base_monthly_salary * input.benefits_factor + tooling;
    return {
        loaded_monthly_cost: round2(loaded),
        hourly_cost: round4(safeDiv(loaded, input.productive_hours_month)),
        benefits_overhead: round2(input.base_monthly_salary * (input.benefits_factor - 1)),
    };
}

/** Recalcula `hourly_cost` de una tarifa a partir de sus componentes. */
export function refreshCostRate(rate: CostRate): CostRate {
    if (rate.cost_type !== 'INTERNO') {
        // Subcontratos y reembolsables traen la tarifa dada; no se deriva.
        return rate;
    }
    return { ...rate, hourly_cost: calculateHourlyCost(rate).hourly_cost };
}

// ---------------------------------------------------------------------------
// 2. Conversión de unidades a horas equivalentes
// ---------------------------------------------------------------------------

export interface HoursConversionConfig {
    hours_per_day: number;
    hours_per_sprint: number;
    hours_per_month: number;
}

export const DEFAULT_HOURS_CONVERSION: HoursConversionConfig = {
    hours_per_day: 8,
    // Sprint de 2 semanas para una persona a dedicación completa.
    hours_per_sprint: 80,
    hours_per_month: 152,
};

/**
 * Horas equivalentes de una línea. Sin esto no se pueden comparar tarifas
 * entre una línea cotizada por hora y otra cotizada por sprint o global.
 * Las líneas GLOBAL no tienen conversión implícita: quien cotiza debe
 * declarar el esfuerzo, de lo contrario el margen por hora sería ficticio.
 */
export function toEquivalentHours(
    quantity: number,
    unit: SalesUnit,
    config: HoursConversionConfig = DEFAULT_HOURS_CONVERSION,
    explicitHours?: number
): number {
    if (explicitHours != null && explicitHours > 0) return round4(explicitHours);

    switch (unit) {
        case 'HORA':
            return round4(quantity);
        case 'DIA':
            return round4(quantity * config.hours_per_day);
        case 'SPRINT':
            return round4(quantity * config.hours_per_sprint);
        case 'MES':
            return round4(quantity * config.hours_per_month);
        case 'UNIDAD':
        case 'GLOBAL':
        default:
            return 0;
    }
}

// ---------------------------------------------------------------------------
// 3. Economía de una línea
// ---------------------------------------------------------------------------

export interface LineEconomics {
    list_amount: number;
    discount_amount: number;
    net_amount: number;
    direct_cost_amount: number;
    indirect_cost_amount: number;
    tax_amount: number;
    retention_amount: number;

    unit_gross_margin: number;
    unit_operating_margin: number;
    gross_margin_amount: number;
    operating_margin_amount: number;

    gross_margin_rate: number;
    operating_margin_rate: number;
    /** Precio / costo. En servicios se lee más rápido que el porcentaje. */
    markup_multiple: number;
    /** Cuánto del precio de lista sobrevivió a la negociación. */
    price_realization_rate: number;
}

type LineEconomicsInput = Pick<
    ProposalLine,
    | 'quantity'
    | 'unit_list_price'
    | 'unit_price'
    | 'unit_direct_cost'
    | 'unit_indirect_cost'
    | 'tax_rate'
    | 'retention_rate'
>;

/** Cascada precio → costo → margen de una sola línea. */
export function calculateLineEconomics(line: LineEconomicsInput): LineEconomics {
    const qty = line.quantity || 0;
    const listPrice = line.unit_list_price || 0;
    const price = line.unit_price || 0;
    const directCost = line.unit_direct_cost || 0;
    const indirectCost = line.unit_indirect_cost || 0;

    const listAmount = round2(qty * listPrice);
    const netAmount = round2(qty * price);
    const discountAmount = round2(qty * (listPrice - price));
    const directCostAmount = round2(qty * directCost);
    const indirectCostAmount = round2(qty * indirectCost);

    const unitGrossMargin = round4(price - directCost);
    const unitOperatingMargin = round4(price - directCost - indirectCost);

    return {
        list_amount: listAmount,
        discount_amount: discountAmount,
        net_amount: netAmount,
        direct_cost_amount: directCostAmount,
        indirect_cost_amount: indirectCostAmount,
        tax_amount: round2((qty * price * (line.tax_rate || 0)) / 100),
        retention_amount: round2((qty * price * (line.retention_rate || 0)) / 100),

        unit_gross_margin: unitGrossMargin,
        unit_operating_margin: unitOperatingMargin,
        gross_margin_amount: round2(qty * (price - directCost)),
        operating_margin_amount: round2(qty * (price - directCost - indirectCost)),

        gross_margin_rate: price > 0 ? round4(safeDiv(price - directCost, price) * 100) : 0,
        operating_margin_rate:
            price > 0 ? round4(safeDiv(price - directCost - indirectCost, price) * 100) : 0,
        markup_multiple: directCost > 0 ? round4(safeDiv(price, directCost)) : 0,
        price_realization_rate: listPrice > 0 ? round4(safeDiv(price, listPrice) * 100) : 100,
    };
}

/**
 * Deriva el precio unitario neto desde el precio de lista y el descuento.
 * Es la dirección natural cuando se cotiza desde una lista de precios.
 */
export function applyDiscount(unitListPrice: number, discountRate: number): number {
    return round4(unitListPrice * (1 - discountRate / 100));
}

/** Descuento implícito cuando el precio se negoció directamente en pesos. */
export function deriveDiscountRate(unitListPrice: number, unitPrice: number): number {
    if (unitListPrice <= 0) return 0;
    return round4((1 - unitPrice / unitListPrice) * 100);
}

/**
 * Precio necesario para alcanzar un margen objetivo. Herramienta de
 * negociación: responde "¿hasta dónde puedo bajar sin romper el 45%?".
 */
export function priceForTargetMargin(unitDirectCost: number, targetMarginRate: number): number {
    if (targetMarginRate >= 100) return Number.POSITIVE_INFINITY;
    return round4(safeDiv(unitDirectCost, 1 - targetMarginRate / 100));
}

// ---------------------------------------------------------------------------
// 4. Totales y KPIs de una propuesta
// ---------------------------------------------------------------------------

export interface ProposalTotals {
    total_list_amount: number;
    total_discount_amount: number;
    total_net_amount: number;
    /** Ingreso propio: excluye reembolsables facturados al costo. */
    total_net_amount_ex_passthrough: number;
    total_passthrough: number;
    total_direct_cost: number;
    total_indirect_cost: number;
    total_tax_amount: number;
    total_retention_amount: number;
    total_hours: number;

    gross_margin_amount: number;
    gross_margin_rate: number;
    /** Margen sobre ingreso propio: la lectura correcta de rentabilidad. */
    gross_margin_rate_ex_passthrough: number;
    operating_margin_amount: number;
    operating_margin_rate: number;

    price_realization_rate: number;
    revenue_per_hour: number;
    margin_per_hour: number;
    blended_hourly_cost: number;
    /** Total a cargo del cliente, impuestos incluidos. */
    total_with_tax: number;
}

export interface ProposalTotalsOptions {
    /** Las líneas opcionales no suman al caso base salvo que se pidan. */
    includeOptional?: boolean;
}

export function calculateProposalTotals(
    lines: ProposalLine[],
    options: ProposalTotalsOptions = {}
): ProposalTotals {
    const active = options.includeOptional ? lines : lines.filter((l) => !l.is_optional);

    const acc = {
        list: 0,
        discount: 0,
        net: 0,
        netEx: 0,
        passthrough: 0,
        direct: 0,
        indirect: 0,
        tax: 0,
        retention: 0,
        hours: 0,
        gross: 0,
        operating: 0,
    };

    for (const line of active) {
        const e = calculateLineEconomics(line);
        acc.list += e.list_amount;
        acc.discount += e.discount_amount;
        acc.net += e.net_amount;
        acc.direct += e.direct_cost_amount;
        acc.indirect += e.indirect_cost_amount;
        acc.tax += e.tax_amount;
        acc.retention += e.retention_amount;
        acc.hours += line.hours || 0;
        acc.gross += e.gross_margin_amount;
        acc.operating += e.operating_margin_amount;

        if (line.is_passthrough) {
            acc.passthrough += e.net_amount;
        } else {
            acc.netEx += e.net_amount;
        }
    }

    return {
        total_list_amount: round2(acc.list),
        total_discount_amount: round2(acc.discount),
        total_net_amount: round2(acc.net),
        total_net_amount_ex_passthrough: round2(acc.netEx),
        total_passthrough: round2(acc.passthrough),
        total_direct_cost: round2(acc.direct),
        total_indirect_cost: round2(acc.indirect),
        total_tax_amount: round2(acc.tax),
        total_retention_amount: round2(acc.retention),
        total_hours: round2(acc.hours),

        gross_margin_amount: round2(acc.gross),
        gross_margin_rate: round2(safeDiv(acc.gross, acc.net) * 100),
        gross_margin_rate_ex_passthrough: round2(safeDiv(acc.gross, acc.netEx) * 100),
        operating_margin_amount: round2(acc.operating),
        operating_margin_rate: round2(safeDiv(acc.operating, acc.net) * 100),

        price_realization_rate: acc.list > 0 ? round2(safeDiv(acc.net, acc.list) * 100) : 100,
        revenue_per_hour: round2(safeDiv(acc.net, acc.hours)),
        margin_per_hour: round2(safeDiv(acc.gross, acc.hours)),
        blended_hourly_cost: round2(safeDiv(acc.direct, acc.hours)),
        total_with_tax: round2(acc.net + acc.tax),
    };
}

// ---------------------------------------------------------------------------
// 5. Cascada de margen para presentación
// ---------------------------------------------------------------------------

export interface WaterfallStep {
    key: string;
    label: string;
    amount: number;
    /** Porcentaje sobre el ingreso neto; permite comparar propuestas. */
    percentOfNet: number;
    kind: 'base' | 'deduction' | 'subtotal';
}

/**
 * Descompone el precio hasta el margen operativo, paso a paso.
 * Cada deducción se muestra en negativo para leerla como una cascada.
 */
export function buildMarginWaterfall(totals: ProposalTotals): WaterfallStep[] {
    const net = totals.total_net_amount || 1;
    const pct = (v: number) => round2((v / net) * 100);

    return [
        {
            key: 'list',
            label: 'Valor a precio de lista',
            amount: totals.total_list_amount,
            percentOfNet: pct(totals.total_list_amount),
            kind: 'base',
        },
        {
            key: 'discount',
            label: 'Descuento comercial',
            amount: -totals.total_discount_amount,
            percentOfNet: pct(-totals.total_discount_amount),
            kind: 'deduction',
        },
        {
            key: 'net',
            label: 'Ingreso neto',
            amount: totals.total_net_amount,
            percentOfNet: 100,
            kind: 'subtotal',
        },
        {
            key: 'passthrough',
            label: 'Reembolsables facturados al costo',
            amount: -totals.total_passthrough,
            percentOfNet: pct(-totals.total_passthrough),
            kind: 'deduction',
        },
        {
            key: 'net_own',
            label: 'Ingreso propio',
            amount: totals.total_net_amount_ex_passthrough,
            percentOfNet: pct(totals.total_net_amount_ex_passthrough),
            kind: 'subtotal',
        },
        {
            key: 'direct_cost',
            label: 'Costo directo de entrega',
            amount: -(totals.total_direct_cost - totals.total_passthrough),
            percentOfNet: pct(-(totals.total_direct_cost - totals.total_passthrough)),
            kind: 'deduction',
        },
        {
            key: 'gross_margin',
            label: 'Margen bruto',
            amount: totals.gross_margin_amount,
            percentOfNet: pct(totals.gross_margin_amount),
            kind: 'subtotal',
        },
        {
            key: 'indirect_cost',
            label: 'Overhead de estructura asignado',
            amount: -totals.total_indirect_cost,
            percentOfNet: pct(-totals.total_indirect_cost),
            kind: 'deduction',
        },
        {
            key: 'operating_margin',
            label: 'Margen operativo del proyecto',
            amount: totals.operating_margin_amount,
            percentOfNet: pct(totals.operating_margin_amount),
            kind: 'subtotal',
        },
    ];
}

// ---------------------------------------------------------------------------
// 6. Gobierno de precios
// ---------------------------------------------------------------------------

export type GovernanceSeverity = 'INFO' | 'ADVERTENCIA' | 'BLOQUEO';

export interface GovernanceFinding {
    line_number: number;
    rule: string;
    severity: GovernanceSeverity;
    message: string;
}

export interface GovernancePolicy {
    /** Margen bruto mínimo aceptable a nivel de propuesta. */
    min_gross_margin_rate: number;
    /** Margen bruto mínimo por línea antes de advertir. */
    min_line_margin_rate: number;
}

export const DEFAULT_GOVERNANCE_POLICY: GovernancePolicy = {
    min_gross_margin_rate: 40,
    min_line_margin_rate: 25,
};

/**
 * Evalúa una propuesta contra la lista de precios y la política de márgenes.
 *
 * Un hallazgo BLOQUEO marca la propuesta como `requires_approval`: es el
 * mecanismo que impide que un descuento se firme sin que nadie lo mire.
 */
export function evaluatePricingGovernance(
    lines: ProposalLine[],
    priceListItems: Map<string, PriceListItem>,
    policy: GovernancePolicy = DEFAULT_GOVERNANCE_POLICY
): { findings: GovernanceFinding[]; requiresApproval: boolean } {
    const findings: GovernanceFinding[] = [];

    for (const line of lines) {
        if (line.is_passthrough) continue; // un reembolsable no tiene margen que juzgar

        const economics = calculateLineEconomics(line);
        const listItem = line.item_id ? priceListItems.get(line.item_id) : undefined;

        if (listItem) {
            if (listItem.floor_price != null && line.unit_price < listItem.floor_price) {
                findings.push({
                    line_number: line.line_number,
                    rule: 'PRECIO_BAJO_PISO',
                    severity: 'BLOQUEO',
                    message: `Precio ${line.unit_price} por debajo del piso ${listItem.floor_price}.`,
                });
            }
            if (line.discount_rate > listItem.max_discount_rate) {
                findings.push({
                    line_number: line.line_number,
                    rule: 'DESCUENTO_EXCEDIDO',
                    severity: 'BLOQUEO',
                    message: `Descuento ${line.discount_rate}% supera el máximo ${listItem.max_discount_rate}%.`,
                });
            }
        }

        if (line.unit_direct_cost > 0 && line.unit_price < line.unit_direct_cost) {
            findings.push({
                line_number: line.line_number,
                rule: 'PRECIO_BAJO_COSTO',
                severity: 'BLOQUEO',
                message: 'El precio unitario está por debajo del costo directo: la línea pierde dinero.',
            });
        } else if (economics.gross_margin_rate < policy.min_line_margin_rate) {
            findings.push({
                line_number: line.line_number,
                rule: 'MARGEN_LINEA_BAJO',
                severity: 'ADVERTENCIA',
                message: `Margen de línea ${economics.gross_margin_rate.toFixed(1)}% bajo el mínimo ${policy.min_line_margin_rate}%.`,
            });
        }

        if (line.unit_direct_cost === 0 && !line.is_passthrough && line.unit_price > 0) {
            findings.push({
                line_number: line.line_number,
                rule: 'SIN_COSTO',
                severity: 'ADVERTENCIA',
                message: 'Línea sin costo unitario: el margen reportado será irreal.',
            });
        }
    }

    const totals = calculateProposalTotals(lines);
    if (totals.total_net_amount > 0 && totals.gross_margin_rate < policy.min_gross_margin_rate) {
        findings.push({
            line_number: 0,
            rule: 'MARGEN_PROPUESTA_BAJO',
            severity: 'BLOQUEO',
            message: `Margen bruto de la propuesta ${totals.gross_margin_rate.toFixed(1)}% bajo el mínimo ${policy.min_gross_margin_rate}%.`,
        });
    }

    return {
        findings,
        requiresApproval: findings.some((f) => f.severity === 'BLOQUEO'),
    };
}

// ---------------------------------------------------------------------------
// 7. Seguimiento en ejecución
// ---------------------------------------------------------------------------

export interface CompletionForecastInput {
    percent_complete: number;
    actual_direct_cost: number;
    budget_direct_cost: number;
    budget_revenue: number;
    baseline_margin: number;
}

export interface CompletionForecast {
    /** Costo estimado a terminación. */
    eac: number;
    /** Costo pendiente por incurrir. */
    etc: number;
    forecast_margin: number;
    forecast_margin_rate: number;
    /** Deterioro frente a lo prometido al vender. Negativo es malo. */
    margin_variance: number;
    /** Índice de desempeño de costo. Bajo 1.0 significa sobrecosto. */
    cost_performance_index: number;
}

/**
 * Proyecta el resultado del proyecto extrapolando el desempeño real.
 *
 * Es la señal temprana: un proyecto al 40% que ya consumió el 60% del
 * presupuesto no se recupera solo, y esperar al cierre para verlo es tarde.
 */
export function forecastAtCompletion(input: CompletionForecastInput): CompletionForecast {
    const progress = input.percent_complete / 100;

    const eac =
        progress > 0 ? round2(safeDiv(input.actual_direct_cost, progress)) : input.budget_direct_cost;
    const earnedValue = input.budget_direct_cost * progress;
    const forecastMargin = round2(input.budget_revenue - eac);

    return {
        eac,
        etc: round2(Math.max(eac - input.actual_direct_cost, 0)),
        forecast_margin: forecastMargin,
        forecast_margin_rate: round2(safeDiv(forecastMargin, input.budget_revenue) * 100),
        margin_variance: round2(forecastMargin - input.baseline_margin),
        cost_performance_index:
            input.actual_direct_cost > 0 ? round4(safeDiv(earnedValue, input.actual_direct_cost)) : 1,
    };
}

export interface LeakageInput {
    quoted_hours: number;
    worked_hours: number;
    non_billable_hours: number;
    quoted_revenue: number;
    invoiced_revenue: number;
    blended_hourly_cost: number;
}

export interface LeakageBreakdown {
    /** Horas trabajadas por encima de lo cotizado. */
    scope_overrun_hours: number;
    scope_overrun_cost: number;
    non_billable_cost: number;
    revenue_shortfall: number;
    total_leakage: number;
}

/**
 * Fuga de margen: dónde se perdió el dinero entre lo cotizado y lo real.
 * Separa sobrecosto de alcance, horas no facturables e ingreso no realizado.
 */
export function calculateMarginLeakage(input: LeakageInput): LeakageBreakdown {
    const overrunHours = Math.max(input.worked_hours - input.quoted_hours, 0);
    const overrunCost = round2(overrunHours * input.blended_hourly_cost);
    const nonBillableCost = round2(input.non_billable_hours * input.blended_hourly_cost);
    const revenueShortfall = round2(Math.max(input.quoted_revenue - input.invoiced_revenue, 0));

    return {
        scope_overrun_hours: round2(overrunHours),
        scope_overrun_cost: overrunCost,
        non_billable_cost: nonBillableCost,
        revenue_shortfall: revenueShortfall,
        total_leakage: round2(overrunCost + nonBillableCost + revenueShortfall),
    };
}

// ---------------------------------------------------------------------------
// 8. Pipeline
// ---------------------------------------------------------------------------

export interface PipelineEntry {
    stage: string;
    probability: number;
    expected_amount: number;
    expected_margin: number;
}

export interface PipelineSummary {
    total_amount: number;
    weighted_amount: number;
    weighted_margin: number;
    /** Veces que el pipeline ponderado cubre la meta del período. */
    coverage_ratio: number;
    by_stage: Record<string, { count: number; amount: number; weighted: number }>;
}

export function summarizePipeline(entries: PipelineEntry[], periodTarget = 0): PipelineSummary {
    const byStage: PipelineSummary['by_stage'] = {};
    let total = 0;
    let weighted = 0;
    let weightedMargin = 0;

    for (const e of entries) {
        const w = (e.expected_amount * e.probability) / 100;
        total += e.expected_amount;
        weighted += w;
        weightedMargin += (e.expected_margin * e.probability) / 100;

        const bucket = (byStage[e.stage] ??= { count: 0, amount: 0, weighted: 0 });
        bucket.count += 1;
        bucket.amount = round2(bucket.amount + e.expected_amount);
        bucket.weighted = round2(bucket.weighted + w);
    }

    return {
        total_amount: round2(total),
        weighted_amount: round2(weighted),
        weighted_margin: round2(weightedMargin),
        coverage_ratio: periodTarget > 0 ? round2(safeDiv(weighted, periodTarget)) : 0,
        by_stage: byStage,
    };
}

// ---------------------------------------------------------------------------
// 9. Reconocimiento de ingreso
// ---------------------------------------------------------------------------

export interface RevenueRecognitionInput {
    contract_value: number;
    total_budget_cost: number;
    cost_incurred_to_date: number;
    revenue_recognized_to_date: number;
    invoiced_to_date: number;
    method: 'POC' | 'LINEAL' | 'HITO';
    /** Para LINEAL: fracción del plazo transcurrida (0-1). */
    elapsed_fraction?: number;
    /** Para HITO: valor de los hitos aceptados en el período. */
    milestone_value?: number;
}

export interface RevenueRecognitionResult {
    percent_complete: number;
    revenue_to_recognize: number;
    cumulative_revenue: number;
    /** Positivo: obra en curso (activo). Negativo: ingreso diferido (pasivo). */
    wip_balance: number;
    is_deferred_revenue: boolean;
}

/**
 * Calcula el ingreso a devengar en el período y el saldo de obra en curso.
 *
 * Es el puente contable de Ventas: facturar no es devengar, y la diferencia
 * es exactamente lo que Contabilidad debe registrar como activo o pasivo.
 */
export function calculateRevenueRecognition(
    input: RevenueRecognitionInput
): RevenueRecognitionResult {
    let progress: number;

    switch (input.method) {
        case 'POC':
            // Avance por costo incurrido sobre costo total estimado.
            progress = Math.min(safeDiv(input.cost_incurred_to_date, input.total_budget_cost), 1);
            break;
        case 'LINEAL':
            progress = Math.min(input.elapsed_fraction ?? 0, 1);
            break;
        case 'HITO':
            progress = Math.min(
                safeDiv(
                    input.revenue_recognized_to_date + (input.milestone_value ?? 0),
                    input.contract_value
                ),
                1
            );
            break;
    }

    const cumulative = round2(input.contract_value * progress);

    return {
        percent_complete: round2(progress * 100),
        revenue_to_recognize: round2(cumulative - input.revenue_recognized_to_date),
        cumulative_revenue: cumulative,
        wip_balance: round2(cumulative - input.invoiced_to_date),
        is_deferred_revenue: cumulative < input.invoiced_to_date,
    };
}

// ---------------------------------------------------------------------------
// 10. Hitos de facturación
// ---------------------------------------------------------------------------

export interface MilestonePlanInput {
    contract_value: number;
    start_date: string;
    duration_months: number;
    advance_payment_rate: number;
    engagement_model: EngagementModel;
    /** Retención en garantía liberada al cierre. */
    retention_rate?: number;
}

export interface PlannedMilestone {
    milestone_number: number;
    name: string;
    milestone_type: 'ANTICIPO' | 'ENTREGABLE' | 'PERIODICO' | 'AVANCE' | 'RETENCION' | 'FINAL';
    planned_date: string;
    percent_of_contract: number;
    amount: number;
}

function addMonths(iso: string, months: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    // Evita que el 31 se desborde al mes siguiente.
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d.toISOString().slice(0, 10);
}

/**
 * Propone un calendario de facturación coherente con la modalidad.
 * Es el insumo directo del pronóstico de caja de Tesorería.
 */
export function planBillingMilestones(input: MilestonePlanInput): PlannedMilestone[] {
    const milestones: PlannedMilestone[] = [];
    const months = Math.max(1, Math.round(input.duration_months));
    const retentionRate = input.retention_rate ?? 0;
    let n = 1;

    if (input.advance_payment_rate > 0) {
        milestones.push({
            milestone_number: n++,
            name: 'Anticipo',
            milestone_type: 'ANTICIPO',
            planned_date: input.start_date,
            percent_of_contract: input.advance_payment_rate,
            amount: round2((input.contract_value * input.advance_payment_rate) / 100),
        });
    }

    const remaining = 100 - input.advance_payment_rate - retentionRate;

    // Recurrentes y T&M se facturan por período; precio fijo, por avance.
    const isPeriodic =
        input.engagement_model === 'SUBSCRIPTION' ||
        input.engagement_model === 'RETAINER' ||
        input.engagement_model === 'TIME_AND_MATERIALS';

    const share = round4(remaining / months);
    for (let m = 1; m <= months; m++) {
        // El último período absorbe el redondeo para que la suma cierre exacta.
        const percent = m === months ? round4(remaining - share * (months - 1)) : share;
        milestones.push({
            milestone_number: n++,
            name: isPeriodic ? `Período ${m}` : `Avance mes ${m}`,
            milestone_type: isPeriodic ? 'PERIODICO' : 'AVANCE',
            planned_date: addMonths(input.start_date, m),
            percent_of_contract: percent,
            amount: round2((input.contract_value * percent) / 100),
        });
    }

    if (retentionRate > 0) {
        milestones.push({
            milestone_number: n++,
            name: 'Liberación de retención en garantía',
            milestone_type: 'RETENCION',
            planned_date: addMonths(input.start_date, months + 1),
            percent_of_contract: retentionRate,
            amount: round2((input.contract_value * retentionRate) / 100),
        });
    }

    return milestones;
}
