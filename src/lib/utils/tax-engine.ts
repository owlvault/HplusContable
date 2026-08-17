// =====================================================================
// Motor de retenciones (lógica pura, sin acceso a datos).
// Calcula retención en la fuente, reteIVA y reteICA respetando bases
// mínimas expresadas en UVT y la Matriz de Regímenes Tributarios
// (Art. 911 E.T. para Régimen Simple, Grandes Contribuyentes, etc.).
// =====================================================================

export type TaxRegime =
    | 'RESPONSABLE_IVA'
    | 'NO_RESPONSABLE_IVA'
    | 'REGIMEN_SIMPLE'
    | 'GRAN_CONTRIBUYENTE'
    | 'AUTORRETENEDOR';

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
    applied: boolean;   // false si no alcanzó la base mínima o está exonerado
    reason?: string;
}

/** Convierte un valor en UVT a pesos. */
export function uvtToCop(uvt: number, uvtValue: number): number {
    return Math.round(uvt * uvtValue);
}

/**
 * Matriz Tributaria: Determina si una transacción está exonerada por ley.
 * Art. 911 E.T.: Los contribuyentes del Régimen Simple de Tributación (RST)
 * NO son sujetos pasivos de retención en la fuente ni de ReteICA.
 */
export function isExemptFromWithholding(
    sellerRegime: TaxRegime,
    buyerRegime: TaxRegime = 'RESPONSABLE_IVA',
    type: TaxConcept['type']
): { isExempt: boolean; reason?: string } {
    // 1. Régimen Simple de Tributación (Art. 911 E.T.)
    if (sellerRegime === 'REGIMEN_SIMPLE') {
        if (type === 'RETEFUENTE') {
            return {
                isExempt: true,
                reason: 'Exonerado de Retención en la Fuente por pertenecer al Régimen Simple de Tributación (Art. 911 E.T.).',
            };
        }
        if (type === 'RETEICA') {
            return {
                isExempt: true,
                reason: 'Exonerado de ReteICA por pertenecer al Régimen Simple de Tributación (Art. 911 E.T.).',
            };
        }
    }

    // 2. Proveedor Autorretenedor
    if (sellerRegime === 'AUTORRETENEDOR' && type === 'RETEFUENTE') {
        return {
            isExempt: true,
            reason: 'Exonerado: El proveedor tiene calidad de Autorretenedor en la Fuente.',
        };
    }

    // 3. Comprador No Responsable de IVA (Art. 368-2 E.T.)
    if (buyerRegime === 'NO_RESPONSABLE_IVA') {
        return {
            isExempt: true,
            reason: 'El comprador no es agente de retención (Art. 368-2 E.T.).',
        };
    }

    return { isExempt: false };
}

/**
 * Calcula la retención en la fuente / reteICA sobre una base gravable.
 * Se aplica solo si la base alcanza el mínimo en UVT del concepto y no está exonerado.
 */
export function computeRetention(
    base: number,
    concept: TaxConcept,
    uvtValue: number,
    sellerRegime?: TaxRegime,
    buyerRegime?: TaxRegime
): WithholdingResult {
    if (sellerRegime) {
        const exemption = isExemptFromWithholding(sellerRegime, buyerRegime, concept.type);
        if (exemption.isExempt) {
            return {
                concept_code: concept.code,
                type: concept.type,
                base,
                rate: concept.rate,
                amount: 0,
                account_code: concept.account_code,
                applied: false,
                reason: exemption.reason,
            };
        }
    }

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
    concept: TaxConcept,
    sellerRegime?: TaxRegime,
    buyerRegime?: TaxRegime
): WithholdingResult {
    if (sellerRegime) {
        const exemption = isExemptFromWithholding(sellerRegime, buyerRegime, 'RETEIVA');
        if (exemption.isExempt) {
            return {
                concept_code: concept.code,
                type: 'RETEIVA',
                base: ivaAmount,
                rate: concept.rate,
                amount: 0,
                account_code: concept.account_code,
                applied: false,
                reason: exemption.reason,
            };
        }
    }

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
    sellerRegime?: TaxRegime;
    buyerRegime?: TaxRegime;
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
 * Devuelve el detalle por concepto y los totales por tipo considerando regímenes fiscales.
 */
export function calculateWithholdings(inputs: WithholdingInputs): WithholdingSummary {
    const results: WithholdingResult[] = [];

    if (inputs.retefuenteConcept) {
        results.push(
            computeRetention(
                inputs.taxableBase,
                inputs.retefuenteConcept,
                inputs.uvtValue,
                inputs.sellerRegime,
                inputs.buyerRegime
            )
        );
    }
    if (inputs.reteIvaConcept) {
        results.push(
            computeReteIva(
                inputs.ivaAmount,
                inputs.reteIvaConcept,
                inputs.sellerRegime,
                inputs.buyerRegime
            )
        );
    }
    if (inputs.reteIcaConcept) {
        results.push(
            computeRetention(
                inputs.taxableBase,
                inputs.reteIcaConcept,
                inputs.uvtValue,
                inputs.sellerRegime,
                inputs.buyerRegime
            )
        );
    }

    const sumByType = (t: TaxConcept['type']) =>
        results.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0);

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
