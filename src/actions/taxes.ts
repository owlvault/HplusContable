'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import {
    calculateWithholdings,
    type TaxConcept,
    type WithholdingSummary,
} from '@/lib/utils/tax-engine';

export type { TaxConcept, WithholdingSummary };

// ============ UVT ============

export async function getUvtValue(year: number): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('uvt_values')
        .select('value')
        .eq('year', year)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
        // Usa el último año disponible como fallback
        const { data: latest } = await supabase
            .from('uvt_values')
            .select('value')
            .order('year', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!latest) throw new Error('No hay valores de UVT configurados.');
        return Number(latest.value);
    }
    return Number(data.value);
}

export async function upsertUvtValue(year: number, value: number) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('uvt_values').upsert({ year, value });
    if (error) throw new Error(error.message);
    revalidatePath('/configuracion');
    return { success: true };
}

// ============ CONCEPTOS DE RETENCIÓN ============

export async function getTaxConcepts(type?: TaxConcept['type']): Promise<TaxConcept[]> {
    await enforcePermission('configuracion', 'read');
    const supabase = await createClient();
    let query = supabase.from('tax_concepts').select('*').eq('is_active', true).order('code');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as TaxConcept[];
}

export async function getTaxConcept(code: string): Promise<TaxConcept | null> {
    const supabase = await createClient();
    const { data } = await supabase.from('tax_concepts').select('*').eq('code', code).maybeSingle();
    return (data as TaxConcept) || null;
}

export async function createTaxConcept(concept: Omit<TaxConcept, 'id'>) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('tax_concepts').insert(concept);
    if (error) throw new Error(error.message);
    revalidatePath('/configuracion');
    return { success: true };
}

export async function updateTaxConcept(code: string, changes: Partial<TaxConcept>) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('tax_concepts').update(changes).eq('code', code);
    if (error) throw new Error(error.message);
    revalidatePath('/configuracion');
    return { success: true };
}

export async function deactivateTaxConcept(code: string) {
    await enforcePermission('configuracion', 'delete');
    const supabase = await createClient();
    const { error } = await supabase.from('tax_concepts').update({ is_active: false }).eq('code', code);
    if (error) throw new Error(error.message);
    revalidatePath('/configuracion');
    return { success: true };
}

// ============ CÁLCULO APLICADO A UN DOCUMENTO ============

export interface DocumentTaxInput {
    thirdPartyId: string;
    taxableBase: number;
    ivaAmount: number;
    date?: Date;
    /** Concepto de retefuente elegido para el documento. */
    retefuenteConceptCode?: string;
    /** Aplicar reteIVA (si la empresa es agente de reteIVA y el tercero responsable). */
    applyReteIva?: boolean;
    /** Aplicar reteICA. */
    applyReteIca?: boolean;
}

/**
 * Calcula las retenciones de un documento de compra usando la configuración real:
 * conceptos parametrizados, UVT del año y responsabilidades del tercero.
 */
export async function computeDocumentWithholdings(input: DocumentTaxInput): Promise<WithholdingSummary> {
    await enforcePermission('facturas', 'read');
    const supabase = await createClient();

    const year = (input.date ?? new Date()).getFullYear();
    const uvtValue = await getUvtValue(year);

    // Régimen del tercero (autorretenedor → no se le practica retefuente)
    const { data: tp } = await supabase
        .from('third_parties')
        .select('is_self_withholding, ica_rate_x_mil')
        .eq('id', input.thirdPartyId)
        .maybeSingle();

    let retefuenteConcept: TaxConcept | undefined;
    if (input.retefuenteConceptCode && !tp?.is_self_withholding) {
        retefuenteConcept = (await getTaxConcept(input.retefuenteConceptCode)) ?? undefined;
    }

    let reteIvaConcept: TaxConcept | undefined;
    if (input.applyReteIva) {
        const list = await getTaxConcepts('RETEIVA');
        reteIvaConcept = list[0];
    }

    let reteIcaConcept: TaxConcept | undefined;
    if (input.applyReteIca) {
        const list = await getTaxConcepts('RETEICA');
        reteIcaConcept = list[0];
        // Si el tercero tiene tarifa municipal específica, se respeta
        if (reteIcaConcept && tp?.ica_rate_x_mil) {
            reteIcaConcept = { ...reteIcaConcept, rate: Number(tp.ica_rate_x_mil) / 10 };
        }
    }

    return calculateWithholdings({
        taxableBase: input.taxableBase,
        ivaAmount: input.ivaAmount,
        uvtValue,
        retefuenteConcept,
        reteIvaConcept,
        reteIcaConcept,
    });
}
