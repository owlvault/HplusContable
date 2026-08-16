import { describe, it, expect } from 'vitest';
import {
    applyDiscount,
    buildMarginWaterfall,
    calculateHourlyCost,
    calculateLineEconomics,
    calculateMarginLeakage,
    calculateProposalTotals,
    calculateRevenueRecognition,
    deriveDiscountRate,
    evaluatePricingGovernance,
    forecastAtCompletion,
    planBillingMilestones,
    priceForTargetMargin,
    summarizePipeline,
    toEquivalentHours,
} from './sales-calc';
import type { PriceListItem, ProposalLine } from '@/types/sales';

function line(overrides: Partial<ProposalLine>): ProposalLine {
    return {
        line_number: 1,
        description: 'Línea',
        quantity: 1,
        unit: 'HORA',
        hours: 1,
        unit_list_price: 0,
        discount_rate: 0,
        unit_price: 0,
        unit_direct_cost: 0,
        unit_indirect_cost: 0,
        cost_source: 'RATE_CARD',
        is_passthrough: false,
        is_optional: false,
        tax_rate: 19,
        retention_rate: 0,
        ...overrides,
    };
}

// Réplica del caso usado para validar el esquema en Postgres. Si estos
// números divergen, la app y la base dejaron de coincidir.
const DEMO_LINES: ProposalLine[] = [
    line({ line_number: 1, description: 'Tech Lead', quantity: 320, hours: 320, unit_list_price: 180000, discount_rate: 0, unit_price: 180000, unit_direct_cost: 62000, unit_indirect_cost: 12000 }),
    line({ line_number: 2, description: 'Dev Senior', quantity: 1200, hours: 1200, unit_list_price: 140000, discount_rate: 15, unit_price: 119000, unit_direct_cost: 55000, unit_indirect_cost: 11000 }),
    line({ line_number: 3, description: 'Dev Junior', quantity: 800, hours: 800, unit_list_price: 80000, discount_rate: 30, unit_price: 56000, unit_direct_cost: 38000, unit_indirect_cost: 7600 }),
    line({ line_number: 4, description: 'Cloud', quantity: 12, hours: 0, unit_list_price: 2500000, discount_rate: 0, unit_price: 2500000, unit_direct_cost: 2500000, unit_indirect_cost: 0, is_passthrough: true }),
];

describe('calculateHourlyCost', () => {
    it('carga el salario con el factor prestacional y las herramientas', () => {
        const r = calculateHourlyCost({
            base_monthly_salary: 8_000_000,
            benefits_factor: 1.5,
            productive_hours_month: 152,
            tooling_cost_month: 400_000,
        });
        expect(r.loaded_monthly_cost).toBe(12_400_000);
        expect(r.hourly_cost).toBeCloseTo(81578.9474, 3);
        expect(r.benefits_overhead).toBe(4_000_000);
    });

    it('sube el costo hora cuando hay menos horas productivas', () => {
        const base = { base_monthly_salary: 10_000_000, benefits_factor: 1.5 };
        const optimista = calculateHourlyCost({ ...base, productive_hours_month: 160 });
        const realista = calculateHourlyCost({ ...base, productive_hours_month: 130 });
        expect(realista.hourly_cost).toBeGreaterThan(optimista.hourly_cost);
    });

    it('no divide por cero si no hay horas productivas', () => {
        const r = calculateHourlyCost({
            base_monthly_salary: 5_000_000,
            benefits_factor: 1.5,
            productive_hours_month: 0,
        });
        expect(r.hourly_cost).toBe(0);
    });
});

describe('toEquivalentHours', () => {
    it('convierte cada unidad a horas equivalentes', () => {
        expect(toEquivalentHours(10, 'HORA')).toBe(10);
        expect(toEquivalentHours(10, 'DIA')).toBe(80);
        expect(toEquivalentHours(3, 'SPRINT')).toBe(240);
        expect(toEquivalentHours(2, 'MES')).toBe(304);
    });

    it('no inventa horas para lineas globales o por unidad', () => {
        expect(toEquivalentHours(1, 'GLOBAL')).toBe(0);
        expect(toEquivalentHours(5, 'UNIDAD')).toBe(0);
    });

    it('respeta las horas declaradas explicitamente', () => {
        expect(toEquivalentHours(1, 'GLOBAL', undefined, 640)).toBe(640);
    });
});

describe('calculateLineEconomics', () => {
    it('reproduce los valores calculados por Postgres', () => {
        const e = calculateLineEconomics(DEMO_LINES[1]);
        expect(e.list_amount).toBe(168_000_000);
        expect(e.discount_amount).toBe(25_200_000);
        expect(e.net_amount).toBe(142_800_000);
        expect(e.gross_margin_amount).toBe(76_800_000);
        expect(e.unit_gross_margin).toBe(64_000);
        expect(e.gross_margin_rate).toBeCloseTo(53.7815, 3);
        expect(e.markup_multiple).toBeCloseTo(2.1636, 3);
        expect(e.price_realization_rate).toBe(85);
    });

    it('deja en cero el margen de un reembolsable facturado al costo', () => {
        const e = calculateLineEconomics(DEMO_LINES[3]);
        expect(e.net_amount).toBe(30_000_000);
        expect(e.gross_margin_amount).toBe(0);
        expect(e.gross_margin_rate).toBe(0);
    });

    it('reporta margen negativo cuando el precio queda bajo el costo', () => {
        const e = calculateLineEconomics(
            line({ quantity: 100, unit_list_price: 50_000, unit_price: 30_000, unit_direct_cost: 40_000 })
        );
        expect(e.gross_margin_amount).toBe(-1_000_000);
        expect(e.gross_margin_rate).toBeLessThan(0);
    });

    it('no divide por cero cuando el precio es cero', () => {
        const e = calculateLineEconomics(line({ quantity: 10, unit_price: 0, unit_direct_cost: 5000 }));
        expect(e.gross_margin_rate).toBe(0);
        expect(e.price_realization_rate).toBe(100);
        expect(Number.isFinite(e.markup_multiple)).toBe(true);
    });
});

describe('descuentos y precio objetivo', () => {
    it('aplica y deriva el descuento de forma simetrica', () => {
        expect(applyDiscount(140_000, 15)).toBe(119_000);
        expect(deriveDiscountRate(140_000, 119_000)).toBe(15);
    });

    it('calcula el precio necesario para un margen objetivo', () => {
        const precio = priceForTargetMargin(55_000, 45);
        expect(precio).toBeCloseTo(100_000, 0);
        const e = calculateLineEconomics(
            line({ quantity: 1, unit_list_price: precio, unit_price: precio, unit_direct_cost: 55_000 })
        );
        expect(e.gross_margin_rate).toBeCloseTo(45, 2);
    });
});

describe('calculateProposalTotals', () => {
    const totals = calculateProposalTotals(DEMO_LINES);

    it('coincide con la vista v_sales_proposal_margin', () => {
        expect(totals.total_list_amount).toBe(319_600_000);
        expect(totals.total_discount_amount).toBe(44_400_000);
        expect(totals.total_net_amount).toBe(275_200_000);
        expect(totals.total_direct_cost).toBe(146_240_000);
        expect(totals.gross_margin_amount).toBe(128_960_000);
        expect(totals.gross_margin_rate).toBe(46.86);
        expect(totals.operating_margin_rate).toBe(38.46);
        expect(totals.price_realization_rate).toBe(86.11);
        expect(totals.total_hours).toBe(2320);
    });

    it('separa el ingreso propio del reembolsable', () => {
        expect(totals.total_passthrough).toBe(30_000_000);
        expect(totals.total_net_amount_ex_passthrough).toBe(245_200_000);
        // Excluir el reembolsable sube el margen: facturar cloud al costo
        // infla el ingreso sin aportar rentabilidad.
        expect(totals.gross_margin_rate_ex_passthrough).toBeGreaterThan(totals.gross_margin_rate);
        expect(totals.gross_margin_rate_ex_passthrough).toBe(52.59);
    });

    it('excluye las lineas opcionales del caso base', () => {
        const conOpcional = [...DEMO_LINES, line({ line_number: 5, quantity: 100, unit_list_price: 100_000, unit_price: 100_000, unit_direct_cost: 40_000, hours: 100, is_optional: true })];
        expect(calculateProposalTotals(conOpcional).total_net_amount).toBe(totals.total_net_amount);
        expect(calculateProposalTotals(conOpcional, { includeOptional: true }).total_net_amount).toBe(285_200_000);
    });

    it('devuelve ceros para una propuesta vacia sin romperse', () => {
        const t = calculateProposalTotals([]);
        expect(t.total_net_amount).toBe(0);
        expect(t.gross_margin_rate).toBe(0);
        expect(t.revenue_per_hour).toBe(0);
        expect(t.price_realization_rate).toBe(100);
    });

    it('calcula tarifa e ingreso por hora vendida', () => {
        expect(totals.revenue_per_hour).toBe(118_620.69);
        expect(totals.blended_hourly_cost).toBe(63_034.48);
        expect(totals.total_with_tax).toBe(totals.total_net_amount + totals.total_tax_amount);
    });
});

describe('buildMarginWaterfall', () => {
    const steps = buildMarginWaterfall(calculateProposalTotals(DEMO_LINES));

    it('encadena lista - descuento = neto', () => {
        const get = (k: string) => steps.find((s) => s.key === k)!;
        expect(get('list').amount + get('discount').amount).toBe(get('net').amount);
    });

    it('llega desde el ingreso propio al margen operativo', () => {
        const get = (k: string) => steps.find((s) => s.key === k)!;
        expect(round(get('net_own').amount + get('direct_cost').amount)).toBe(get('gross_margin').amount);
        expect(round(get('gross_margin').amount + get('indirect_cost').amount)).toBe(
            get('operating_margin').amount
        );
    });

    it('muestra las deducciones en negativo', () => {
        for (const s of steps.filter((x) => x.kind === 'deduction')) {
            expect(s.amount).toBeLessThanOrEqual(0);
        }
    });
});

function round(n: number) {
    return Math.round(n * 100) / 100;
}

describe('evaluatePricingGovernance', () => {
    const priceList = new Map<string, PriceListItem>([
        ['item-dev', { id: 'p1', price_list_id: 'l1', item_id: 'item-dev', list_price: 140_000, floor_price: 110_000, max_discount_rate: 20 }],
    ]);

    it('bloquea un precio por debajo del piso de la lista', () => {
        const r = evaluatePricingGovernance(
            [line({ item_id: 'item-dev', quantity: 100, hours: 100, unit_list_price: 140_000, discount_rate: 25, unit_price: 105_000, unit_direct_cost: 55_000 })],
            priceList
        );
        expect(r.requiresApproval).toBe(true);
        expect(r.findings.map((f) => f.rule)).toContain('PRECIO_BAJO_PISO');
        expect(r.findings.map((f) => f.rule)).toContain('DESCUENTO_EXCEDIDO');
    });

    it('bloquea una linea vendida por debajo del costo', () => {
        const r = evaluatePricingGovernance(
            [line({ quantity: 10, hours: 10, unit_list_price: 60_000, unit_price: 40_000, unit_direct_cost: 55_000 })],
            new Map()
        );
        expect(r.findings.some((f) => f.rule === 'PRECIO_BAJO_COSTO' && f.severity === 'BLOQUEO')).toBe(true);
    });

    it('advierte cuando una linea no tiene costo cargado', () => {
        const r = evaluatePricingGovernance(
            [line({ quantity: 10, hours: 10, unit_list_price: 100_000, unit_price: 100_000, unit_direct_cost: 0 })],
            new Map()
        );
        expect(r.findings.some((f) => f.rule === 'SIN_COSTO')).toBe(true);
    });

    it('ignora los reembolsables al juzgar margen', () => {
        const r = evaluatePricingGovernance([DEMO_LINES[3]], new Map());
        expect(r.findings.filter((f) => f.line_number === 4)).toHaveLength(0);
    });

    it('aprueba una propuesta sana sin escalamiento', () => {
        const r = evaluatePricingGovernance(
            [line({ quantity: 100, hours: 100, unit_list_price: 150_000, unit_price: 150_000, unit_direct_cost: 60_000 })],
            new Map()
        );
        expect(r.requiresApproval).toBe(false);
    });
});

describe('forecastAtCompletion', () => {
    it('detecta el sobrecosto de un proyecto que consume mas rapido de lo que avanza', () => {
        const f = forecastAtCompletion({
            percent_complete: 40,
            actual_direct_cost: 66_430_000,
            budget_direct_cost: 146_240_000,
            budget_revenue: 275_200_000,
            baseline_margin: 128_960_000,
        });
        expect(f.eac).toBe(166_075_000);
        expect(f.forecast_margin).toBe(109_125_000);
        expect(f.margin_variance).toBe(-19_835_000); // se deteriora frente a lo vendido
        expect(f.cost_performance_index).toBeLessThan(1);
    });

    it('cae al presupuesto cuando el avance aun es cero', () => {
        const f = forecastAtCompletion({
            percent_complete: 0,
            actual_direct_cost: 0,
            budget_direct_cost: 100,
            budget_revenue: 200,
            baseline_margin: 100,
        });
        expect(f.eac).toBe(100);
        expect(f.margin_variance).toBe(0);
    });
});

describe('calculateMarginLeakage', () => {
    it('separa sobrecosto de alcance, horas no facturables e ingreso no realizado', () => {
        const l = calculateMarginLeakage({
            quoted_hours: 1000,
            worked_hours: 1200,
            non_billable_hours: 150,
            quoted_revenue: 100_000_000,
            invoiced_revenue: 92_000_000,
            blended_hourly_cost: 55_000,
        });
        expect(l.scope_overrun_hours).toBe(200);
        expect(l.scope_overrun_cost).toBe(11_000_000);
        expect(l.non_billable_cost).toBe(8_250_000);
        expect(l.revenue_shortfall).toBe(8_000_000);
        expect(l.total_leakage).toBe(27_250_000);
    });

    it('no reporta fuga cuando se ejecuto bajo lo cotizado', () => {
        const l = calculateMarginLeakage({
            quoted_hours: 1000,
            worked_hours: 900,
            non_billable_hours: 0,
            quoted_revenue: 100,
            invoiced_revenue: 120,
            blended_hourly_cost: 50_000,
        });
        expect(l.total_leakage).toBe(0);
    });
});

describe('summarizePipeline', () => {
    it('pondera por probabilidad y calcula cobertura de meta', () => {
        const s = summarizePipeline(
            [
                { stage: 'PROPUESTA', probability: 60, expected_amount: 480_000_000, expected_margin: 200_000_000 },
                { stage: 'NEGOCIACION', probability: 80, expected_amount: 200_000_000, expected_margin: 90_000_000 },
                { stage: 'PROSPECCION', probability: 10, expected_amount: 1_000_000_000, expected_margin: 400_000_000 },
            ],
            500_000_000
        );
        expect(s.total_amount).toBe(1_680_000_000);
        expect(s.weighted_amount).toBe(548_000_000);
        expect(s.weighted_margin).toBe(232_000_000);
        expect(s.coverage_ratio).toBe(1.1);
        expect(s.by_stage.PROPUESTA.weighted).toBe(288_000_000);
    });
});

describe('calculateRevenueRecognition', () => {
    it('devenga por avance de costo y expone obra en curso', () => {
        const r = calculateRevenueRecognition({
            contract_value: 275_200_000,
            total_budget_cost: 146_240_000,
            cost_incurred_to_date: 66_430_000,
            revenue_recognized_to_date: 0,
            invoiced_to_date: 82_560_000,
            method: 'POC',
        });
        expect(r.percent_complete).toBeCloseTo(45.42, 1);
        expect(r.cumulative_revenue).toBeGreaterThan(r.revenue_to_recognize - 1);
        expect(r.wip_balance).toBeGreaterThan(0); // devengado por encima de lo facturado
        expect(r.is_deferred_revenue).toBe(false);
    });

    it('marca ingreso diferido cuando se factura por delante del avance', () => {
        const r = calculateRevenueRecognition({
            contract_value: 100_000_000,
            total_budget_cost: 60_000_000,
            cost_incurred_to_date: 6_000_000,
            revenue_recognized_to_date: 0,
            invoiced_to_date: 30_000_000,
            method: 'POC',
        });
        expect(r.percent_complete).toBe(10);
        expect(r.wip_balance).toBe(-20_000_000);
        expect(r.is_deferred_revenue).toBe(true);
    });

    it('no devenga por encima del valor del contrato', () => {
        const r = calculateRevenueRecognition({
            contract_value: 100,
            total_budget_cost: 50,
            cost_incurred_to_date: 90, // sobrecosto severo
            revenue_recognized_to_date: 0,
            invoiced_to_date: 0,
            method: 'POC',
        });
        expect(r.percent_complete).toBe(100);
        expect(r.cumulative_revenue).toBe(100);
    });
});

describe('planBillingMilestones', () => {
    it('reparte anticipo, avances y retencion sumando exactamente 100%', () => {
        const ms = planBillingMilestones({
            contract_value: 300_000_000,
            start_date: '2026-09-01',
            duration_months: 6,
            advance_payment_rate: 30,
            engagement_model: 'FIXED_PRICE',
            retention_rate: 10,
        });
        const total = ms.reduce((s, m) => s + m.percent_of_contract, 0);
        expect(round(total)).toBe(100);
        expect(ms[0].milestone_type).toBe('ANTICIPO');
        expect(ms[ms.length - 1].milestone_type).toBe('RETENCION');
        expect(round(ms.reduce((s, m) => s + m.amount, 0))).toBeCloseTo(300_000_000, 0);
    });

    it('usa hitos periodicos para suscripciones', () => {
        const ms = planBillingMilestones({
            contract_value: 120_000_000,
            start_date: '2026-01-31',
            duration_months: 12,
            advance_payment_rate: 0,
            engagement_model: 'SUBSCRIPTION',
        });
        expect(ms).toHaveLength(12);
        expect(ms.every((m) => m.milestone_type === 'PERIODICO')).toBe(true);
        // El 31 de enero no debe desbordarse a marzo al sumar un mes.
        expect(ms[0].planned_date).toBe('2026-02-28');
    });
});
