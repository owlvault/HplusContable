import { describe, it, expect } from 'vitest';
import { calculateWithholdings, TaxConcept } from '../../src/lib/utils/tax-engine';

describe('Matriz Adversarial: Régimen Simple de Tributación y Exoneraciones Fiscales (T-05)', () => {
    const uvt2026 = 52800;

    const retefuenteGeneral: TaxConcept = {
        code: 'RET-COM-2.5',
        name: 'Retención en la fuente por compras generales',
        type: 'RETEFUENTE',
        applies_to: 'COMPRA',
        rate: 2.5,
        base_uvt: 27, // 27 UVT
        account_code: '236540',
    };

    const reteIcaBogota: TaxConcept = {
        code: 'RETEICA-11.04',
        name: 'ReteICA Bogotá Comercial',
        type: 'RETEICA',
        applies_to: 'COMPRA',
        rate: 1.104, // 11.04 por mil
        base_uvt: 27,
        account_code: '236801',
    };

    it('debe exonerar Retefuente y ReteICA si el proveedor pertenece al Régimen Simple (Art. 911 E.T.)', () => {
        const taxableBase = 5000000; // $5.000.000 COP (> 27 UVT)
        const ivaAmount = 950000;

        const summary = calculateWithholdings({
            taxableBase,
            ivaAmount,
            uvtValue: uvt2026,
            sellerRegime: 'REGIMEN_SIMPLE', // Proveedor RST
            buyerRegime: 'RESPONSABLE_IVA',
            retefuenteConcept: retefuenteGeneral,
            reteIcaConcept: reteIcaBogota,
        });

        expect(summary.totalRetefuente).toBe(0);
        expect(summary.totalReteIca).toBe(0);
        expect(summary.totalWithheld).toBe(0);

        // Validar que las razones expliquen el motivo legal
        const retefuenteResult = summary.results.find((r) => r.type === 'RETEFUENTE');
        expect(retefuenteResult?.applied).toBe(false);
        expect(retefuenteResult?.reason).toContain('Art. 911 E.T.');
    });

    it('debe aplicar Retefuente y ReteICA normalmente a proveedores ordinarios Responsables de IVA', () => {
        const taxableBase = 5000000;
        const ivaAmount = 950000;

        const summary = calculateWithholdings({
            taxableBase,
            ivaAmount,
            uvtValue: uvt2026,
            sellerRegime: 'RESPONSABLE_IVA', // Proveedor Ordinario
            buyerRegime: 'RESPONSABLE_IVA',
            retefuenteConcept: retefuenteGeneral,
            reteIcaConcept: reteIcaBogota,
        });

        // 2.5% de $5.000.000 = $125.000
        expect(summary.totalRetefuente).toBe(125000);
        // 1.104% de $5.000.000 = $55.200
        expect(summary.totalReteIca).toBe(55200);
        expect(summary.totalWithheld).toBe(180200);
    });

    it('debe exonerar Retefuente si el proveedor es AUTORRETENEDOR', () => {
        const taxableBase = 5000000;
        const summary = calculateWithholdings({
            taxableBase,
            ivaAmount: 950000,
            uvtValue: uvt2026,
            sellerRegime: 'AUTORRETENEDOR',
            buyerRegime: 'RESPONSABLE_IVA',
            retefuenteConcept: retefuenteGeneral,
        });

        expect(summary.totalRetefuente).toBe(0);
        expect(summary.results[0].reason).toContain('Autorretenedor');
    });
});
