import { describe, it, expect } from 'vitest';
import {
    uvtToCop,
    computeRetention,
    computeReteIva,
    calculateWithholdings,
    type TaxConcept,
} from './tax-engine';

const UVT_2024 = 47065;

const compras: TaxConcept = {
    code: 'RF_COMPRAS', name: 'Compras', type: 'RETEFUENTE', applies_to: 'COMPRA',
    rate: 2.5, base_uvt: 27, account_code: '236540',
};
const honorarios: TaxConcept = {
    code: 'RF_HONOR', name: 'Honorarios', type: 'RETEFUENTE', applies_to: 'COMPRA',
    rate: 11, base_uvt: 0, account_code: '236515',
};
const reteiva: TaxConcept = {
    code: 'RIVA_GEN', name: 'ReteIVA', type: 'RETEIVA', applies_to: 'COMPRA',
    rate: 15, base_uvt: 0, account_code: '236700',
};
const reteica: TaxConcept = {
    code: 'RICA_GEN', name: 'ReteICA', type: 'RETEICA', applies_to: 'COMPRA',
    rate: 0.966, base_uvt: 0, account_code: '236805',
};

describe('tax-engine', () => {
    it('uvtToCop convierte UVT a pesos', () => {
        expect(uvtToCop(27, UVT_2024)).toBe(1270755);
    });

    describe('computeRetention — base mínima en UVT', () => {
        it('NO retiene si la base no alcanza el mínimo (27 UVT en compras)', () => {
            const base = 1_000_000; // < 27 UVT (1.270.755)
            const r = computeRetention(base, compras, UVT_2024);
            expect(r.applied).toBe(false);
            expect(r.amount).toBe(0);
        });

        it('retiene 2.5% cuando supera la base mínima', () => {
            const base = 2_000_000;
            const r = computeRetention(base, compras, UVT_2024);
            expect(r.applied).toBe(true);
            expect(r.amount).toBe(50_000); // 2.000.000 * 2.5%
        });

        it('honorarios sin base mínima retiene siempre 11%', () => {
            const r = computeRetention(500_000, honorarios, UVT_2024);
            expect(r.applied).toBe(true);
            expect(r.amount).toBe(55_000);
        });

        it('redondea a peso', () => {
            const r = computeRetention(1_333_333, compras, UVT_2024);
            expect(r.amount).toBe(Math.round(1_333_333 * 0.025));
        });
    });

    describe('computeReteIva — porcentaje del IVA', () => {
        it('retiene 15% del IVA facturado', () => {
            const iva = 190_000; // IVA 19% de 1.000.000
            const r = computeReteIva(iva, reteiva);
            expect(r.amount).toBe(28_500);
        });
    });

    describe('calculateWithholdings — orquestación', () => {
        it('suma las tres retenciones por tipo', () => {
            const summary = calculateWithholdings({
                taxableBase: 2_000_000,
                ivaAmount: 380_000,
                uvtValue: UVT_2024,
                retefuenteConcept: compras,
                reteIvaConcept: reteiva,
                reteIcaConcept: reteica,
            });
            expect(summary.totalRetefuente).toBe(50_000);       // 2.5%
            expect(summary.totalReteIva).toBe(57_000);          // 15% de 380.000
            expect(summary.totalReteIca).toBe(Math.round(2_000_000 * 0.00966));
            expect(summary.totalWithheld).toBe(
                summary.totalRetefuente + summary.totalReteIva + summary.totalReteIca
            );
        });

        it('omite retefuente si no alcanza base mínima pero aplica reteIVA', () => {
            const summary = calculateWithholdings({
                taxableBase: 500_000,
                ivaAmount: 95_000,
                uvtValue: UVT_2024,
                retefuenteConcept: compras,  // no aplica (< 27 UVT)
                reteIvaConcept: reteiva,
            });
            expect(summary.totalRetefuente).toBe(0);
            expect(summary.totalReteIva).toBe(14_250);
        });
    });
});
