// =====================================================================
// Motor de retenciones (lógica pura, sin acceso a datos).
// Calcula retención en la fuente, reteIVA y reteICA respetando bases
// mínimas expresadas en UVT. Parametrizable desde tax_concepts.
// =====================================================================

export interface TaxConcept {
    code: string;
    name: string;
    type: 'RETEFUENTE' | 'RETEIVA' | 'RETEICA';
    applies_to: 'COMPRA' | 'VENTA';
    rate: number;       // porcentaje (ej. 2.5)
    base_uvt: number;   // base mínima en UVT (0 = sin base mínima)
    account_code: string | null;
}

export interface WithholdingResult {
    concept_code: string;
    type: TaxConcept['type'];
    base: number;       // base gravable sobre la que se aplicó
    rate: number;
    amount: number;     // valor retenido (redondeado a peso)
    account_code: string | null;
    applied: boolean;   // false si no alcanzó la base mínima
    reason?: string;
}

/** Convierte un valor en UVT a pesos. */
export function uvtToCop(uvt: number, uvtValue: number): number {
    return Math.round(uvt * uvtValue);
}

/**
 * Calcula la retención en la fuente / reteICA sobre una base gravable.
 * Se aplica solo si la base alcanza el mínimo en UVT del concepto.
 * ReteICA usa tarifa "por mil": rate se interpreta como porcentaje ya normalizado
 * (ej. 0.966 %). Si prefieres pasar "por mil", convierte antes (x/10).
 */
export function computeRetention(
    base: number,
    concept: TaxConcept,
    uvtValue: number
): WithholdingResult {
    const minBase = uvtToCop(concept.base_uvt, uvtValue);
    if (base < minBase) {
        return {
            concept_code: concept.code,
            type: concept.type,
            base,
            rate: concept.rate,
            amount: 0,
            account_code: concept.account_code,
            applied: false,
            reason: `Base ${base} < base mínima ${minBase} (${concept.base_uvt} UVT)`,
        };
    }
    const amount = Math.round(base * (concept.rate / 100));
    return {
        concept_code: concept.code,
        type: concept.type,
        base,
        rate: concept.rate,
        amount,
        account_code: concept.account_code,
        applied: true,
    };
}

/**
 * ReteIVA: se calcula como un porcentaje del IVA facturado (no de la base),
 * típicamente 15 % del IVA. No maneja base mínima en UVT sobre el IVA.
 */
export function computeReteIva(
    ivaAmount: number,
    concept: TaxConcept
): WithholdingResult {
    const amount = Math.round(ivaAmount * (concept.rate / 100));
    return {
        concept_code: concept.code,
        type: 'RETEIVA',
        base: ivaAmount,
        rate: concept.rate,
        amount,
        account_code: concept.account_code,
        applied: amount > 0,
    };
}

export interface WithholdingInputs {
    /** Base gravable (subtotal - descuentos) para retefuente e ICA. */
    taxableBase: number;
    /** IVA facturado, para reteIVA. */
    ivaAmount: number;
    uvtValue: number;
    /** Conceptos a aplicar según el régimen del tercero y de la empresa. */
    retefuenteConcept?: TaxConcept;
    reteIvaConcept?: TaxConcept;
    reteIcaConcept?: TaxConcept;
}

export interface WithholdingSummary {
    results: WithholdingResult[];
    totalRetefuente: number;
    totalReteIva: number;
    totalReteIca: number;
    totalWithheld: number;
}

/**
 * Orquesta el cálculo de las tres retenciones para un documento (factura/compra).
 * Devuelve el detalle por concepto y los totales por tipo.
 */
export function calculateWithholdings(inputs: WithholdingInputs): WithholdingSummary {
    const results: WithholdingResult[] = [];

    if (inputs.retefuenteConcept) {
        results.push(computeRetention(inputs.taxableBase, inputs.retefuenteConcept, inputs.uvtValue));
    }
    if (inputs.reteIvaConcept) {
        results.push(computeReteIva(inputs.ivaAmount, inputs.reteIvaConcept));
    }
    if (inputs.reteIcaConcept) {
        results.push(computeRetention(inputs.taxableBase, inputs.reteIcaConcept, inputs.uvtValue));
    }

    const sumByType = (t: TaxConcept['type']) =>
        results.filter(r => r.type === t).reduce((s, r) => s + r.amount, 0);

    const totalRetefuente = sumByType('RETEFUENTE');
    const totalReteIva = sumByType('RETEIVA');
    const totalReteIca = sumByType('RETEICA');

    return {
        results,
        totalRetefuente,
        totalReteIva,
        totalReteIca,
        totalWithheld: totalRetefuente + totalReteIva + totalReteIca,
    };
}
