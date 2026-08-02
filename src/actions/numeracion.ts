'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';

/**
 * Obtiene el siguiente número consecutivo para un tipo de documento de forma
 * atómica (vía RPC next_document_number). Reemplaza la numeración ad-hoc en
 * comprobantes, notas y otros documentos que no sean facturas.
 *
 * Tipos: 'CI' (comprobante ingreso), 'CE' (egreso), 'NC' (nota contable),
 * 'RC' (recibo de caja), 'NOMINA', 'LIQ' (liquidación).
 */
export async function getNextDocumentNumber(docType: string): Promise<string> {
    await enforcePermission('comprobantes', 'write');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: docType });
    if (error) throw new Error(error.message);
    return data as string;
}

export async function getDocumentSequences() {
    await enforcePermission('configuracion', 'read');
    const supabase = await createClient();
    const { data } = await supabase.from('document_sequences').select('*').order('doc_type');
    return data || [];
}

export async function updateSequencePrefix(docType: string, prefix: string) {
    await enforcePermission('configuracion', 'write');
    const supabase = await createClient();
    const { error } = await supabase.from('document_sequences').update({ prefix }).eq('doc_type', docType);
    if (error) throw new Error(error.message);
    return { success: true };
}
