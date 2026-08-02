'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { getDefaultAccounts } from '@/actions/company';
import { getTaxConcepts } from '@/actions/taxes';

type Line = {
    account_code: string;
    third_party_id: string | null;
    debit: number;
    credit: number;
};

/** Devuelve las líneas de asientos APROBADOS dentro de un rango de fechas. */
async function getLinesInRange(from: Date, to: Date): Promise<Line[]> {
    const supabase = await createClient();
    const { data: entries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('state', 'APROBADO')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());
    const ids = (entries || []).map((e: any) => e.id);
    if (!ids.length) return [];
    const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_code, third_party_id, debit, credit')
        .in('entry_id', ids);
    return (lines || []).map((l: any) => ({
        account_code: l.account_code,
        third_party_id: l.third_party_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
    }));
}

const sumBy = (lines: Line[], code: string, side: 'debit' | 'credit') =>
    lines.filter((l) => l.account_code.startsWith(code)).reduce((s, l) => s + l[side], 0);

// =====================================================================
// 4.2a Declaración de IVA (Formulario 300) — por bimestre
// =====================================================================
export async function generateIvaReturn(year: number, bimester: number) {
    await enforcePermission('reportes', 'read');
    if (bimester < 1 || bimester > 6) throw new Error('Bimestre inválido (1-6)');

    const startMonth = (bimester - 1) * 2;
    const from = new Date(year, startMonth, 1);
    const to = new Date(year, startMonth + 2, 0, 23, 59, 59);

    const acc = await getDefaultAccounts();
    const ivaGeneradoAcc = acc.iva_generado || '240805';
    const ivaDescontableAcc = acc.iva_descontable || '240810';

    const lines = await getLinesInRange(from, to);
    const ivaGenerado = sumBy(lines, ivaGeneradoAcc, 'credit') - sumBy(lines, ivaGeneradoAcc, 'debit');
    const ivaDescontable = sumBy(lines, ivaDescontableAcc, 'debit') - sumBy(lines, ivaDescontableAcc, 'credit');
    const saldoAPagar = Math.max(0, Math.round(ivaGenerado - ivaDescontable));
    const saldoAFavor = Math.max(0, Math.round(ivaDescontable - ivaGenerado));

    const data = {
        iva_generado: Math.round(ivaGenerado),
        iva_descontable: Math.round(ivaDescontable),
        saldo_a_pagar: saldoAPagar,
        saldo_a_favor: saldoAFavor,
    };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('tax_returns').upsert(
        {
            type: 'IVA',
            period_year: year,
            period_number: bimester,
            data,
            total_to_pay: saldoAPagar,
            status: 'DRAFT',
            created_by: user?.id,
        },
        { onConflict: 'type,period_year,period_number' }
    );

    revalidatePath('/reportes');
    return data;
}

// =====================================================================
// 4.2b Declaración de Retención en la Fuente (Formulario 350) — mensual
// =====================================================================
export async function generateRetentionReturn(year: number, month: number) {
    await enforcePermission('reportes', 'read');
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    const concepts = await getTaxConcepts();
    const lines = await getLinesInRange(from, to);

    const byConcept: Record<string, number> = {};
    let totalRetefuente = 0, totalReteIva = 0, totalReteIca = 0;

    for (const c of concepts) {
        if (!c.account_code) continue;
        // Retenciones practicadas: naturaleza crédito (pasivo)
        const val = sumBy(lines, c.account_code, 'credit') - sumBy(lines, c.account_code, 'debit');
        const rounded = Math.round(val);
        if (rounded === 0) continue;
        byConcept[c.code] = rounded;
        if (c.type === 'RETEFUENTE') totalRetefuente += rounded;
        else if (c.type === 'RETEIVA') totalReteIva += rounded;
        else if (c.type === 'RETEICA') totalReteIca += rounded;
    }

    const totalToPay = totalRetefuente + totalReteIva + totalReteIca;
    const data = { byConcept, totalRetefuente, totalReteIva, totalReteIca };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('tax_returns').upsert(
        {
            type: 'RETENCION',
            period_year: year,
            period_number: month,
            data,
            total_to_pay: totalToPay,
            status: 'DRAFT',
            created_by: user?.id,
        },
        { onConflict: 'type,period_year,period_number' }
    );

    revalidatePath('/reportes');
    return { ...data, totalToPay };
}

export async function getTaxReturns(type?: 'IVA' | 'RETENCION', year?: number) {
    await enforcePermission('reportes', 'read');
    const supabase = await createClient();
    let query = supabase.from('tax_returns').select('*').order('period_year', { ascending: false }).order('period_number', { ascending: false });
    if (type) query = query.eq('type', type);
    if (year) query = query.eq('period_year', year);
    const { data } = await query;
    return data || [];
}

// =====================================================================
// 4.3 Información exógena — Formato 1001 (pagos y retenciones a terceros)
// =====================================================================
export async function generateExogena1001(year: number) {
    await enforcePermission('reportes', 'read');
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);

    const lines = await getLinesInRange(from, to);
    const supabase = await createClient();

    // Cuentas de costo/gasto (clases 5, 6, 7) por tercero = pagos
    const byThird = new Map<string, { pago: number }>();
    for (const l of lines) {
        if (!l.third_party_id) continue;
        const cls = l.account_code[0];
        if (cls === '5' || cls === '6' || cls === '7') {
            const prev = byThird.get(l.third_party_id) || { pago: 0 };
            prev.pago += l.debit - l.credit;
            byThird.set(l.third_party_id, prev);
        }
    }

    const thirdIds = [...byThird.keys()];
    const { data: thirds } = await supabase
        .from('third_parties')
        .select('id, document_type, document_number, dv, full_name')
        .in('id', thirdIds.length ? thirdIds : ['00000000-0000-0000-0000-000000000000']);
    const meta = new Map((thirds || []).map((t: any) => [t.id, t]));

    const content = thirdIds
        .map((id) => {
            const t = meta.get(id);
            const pago = Math.round(byThird.get(id)!.pago);
            return {
                document_type: t?.document_type || '',
                document_number: t?.document_number || '',
                dv: t?.dv ?? null,
                name: t?.full_name || '',
                concept: '5001', // pagos por compras/servicios (simplificado)
                payment: pago,
            };
        })
        .filter((r) => r.payment > 0);

    const totalAmount = content.reduce((s, r) => s + r.payment, 0);

    await supabase.from('exogena_reports').upsert(
        { format_code: '1001', year, row_count: content.length, total_amount: totalAmount, content },
        { onConflict: 'format_code,year' }
    );

    revalidatePath('/reportes');
    return { format: '1001', year, rowCount: content.length, totalAmount, content };
}

// =====================================================================
// 4.4 Certificado de retención en la fuente por tercero
// =====================================================================
export async function generateWithholdingCertificate(thirdPartyId: string, year: number) {
    await enforcePermission('reportes', 'read');
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);

    const concepts = await getTaxConcepts('RETEFUENTE');
    const conceptCodes = concepts.map((c) => c.account_code).filter(Boolean) as string[];

    const supabase = await createClient();
    const { data: entries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('state', 'APROBADO')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());
    const ids = (entries || []).map((e: any) => e.id);

    let totalWithheld = 0;
    if (ids.length) {
        const { data: lines } = await supabase
            .from('journal_lines')
            .select('account_code, debit, credit, third_party_id')
            .in('entry_id', ids)
            .eq('third_party_id', thirdPartyId);
        for (const l of lines || []) {
            if (conceptCodes.some((c) => l.account_code.startsWith(c))) {
                totalWithheld += (Number(l.credit) || 0) - (Number(l.debit) || 0);
            }
        }
    }

    totalWithheld = Math.round(totalWithheld);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('withholding_certificates')
        .upsert(
            {
                third_party_id: thirdPartyId,
                year,
                type: 'RETEFUENTE',
                total_withheld: totalWithheld,
                data: { generatedBy: user?.id },
            },
            { onConflict: 'third_party_id,year,type' }
        )
        .select()
        .single();
    if (error) throw new Error(error.message);

    revalidatePath('/reportes');
    return data;
}
