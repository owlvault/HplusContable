'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { getDefaultAccounts } from '@/actions/company';
import { computeClosingEntry, type ResultAccountBalance } from '@/lib/utils/closing-calc';

type AccountBalance = {
    account_code: string;
    type: string;
    nature: string;
    balance: number; // débito - crédito
};

/**
 * Calcula el saldo (débito − crédito) de cada cuenta con movimiento aprobado
 * dentro de un rango de fechas. Base para cierre, balance y declaraciones.
 */
export async function getAccountBalances(from: Date, to: Date): Promise<AccountBalance[]> {
    const supabase = await createClient();

    const { data: entries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('state', 'APROBADO')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());

    const entryIds = (entries || []).map((e: any) => e.id);
    if (entryIds.length === 0) return [];

    const { data: lines } = await supabase
        .from('journal_lines')
        .select('account_code, debit, credit')
        .in('entry_id', entryIds);

    const balances = new Map<string, number>();
    for (const l of lines || []) {
        const prev = balances.get(l.account_code) || 0;
        balances.set(l.account_code, prev + (Number(l.debit) || 0) - (Number(l.credit) || 0));
    }

    const codes = [...balances.keys()];
    if (codes.length === 0) return [];

    const { data: accounts } = await supabase
        .from('puc_accounts')
        .select('code, type, nature')
        .in('code', codes);

    const meta = new Map((accounts || []).map((a: any) => [a.code, a]));
    return codes.map((code) => ({
        account_code: code,
        type: meta.get(code)?.type || '',
        nature: meta.get(code)?.nature || '',
        balance: Math.round((balances.get(code) || 0) * 100) / 100,
    }));
}

const RESULT_TYPES = ['INGRESO', 'GASTO', 'COSTO_VENTAS', 'COSTO_PRODUCCION'];

/**
 * Genera el asiento de cierre del ejercicio: cancela las cuentas de resultado
 * (ingresos, gastos y costos) contra la utilidad/pérdida del ejercicio.
 */
export async function closeFiscalYear(year: number, notes?: string) {
    await enforcePermission('cierre', 'approve');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // Evitar doble cierre
    const { data: existing } = await supabase
        .from('year_end_closings')
        .select('id')
        .eq('year', year)
        .maybeSingle();
    if (existing) throw new Error(`El año ${year} ya fue cerrado.`);

    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);
    const balances = await getAccountBalances(from, to);
    const resultAccounts = balances.filter(
        (b) => RESULT_TYPES.includes(b.type) && Math.abs(b.balance) > 0.01
    );

    if (resultAccounts.length === 0) {
        throw new Error('No hay cuentas de resultado con movimiento para cerrar.');
    }

    const acc = await getDefaultAccounts();
    const closing = computeClosingEntry(
        resultAccounts as ResultAccountBalance[],
        {
            utilidadAccount: acc.utilidad_ejercicio || '360505',
            perdidaAccount: acc.perdida_ejercicio || '361005',
        }
    );

    const lines = closing.lines.map((l) => ({
        account_code: l.account_code,
        third_party_id: null,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
    }));

    // Verificación de partida doble
    const td = lines.reduce((s, l) => s + l.debit, 0);
    const tc = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(td - tc) > 1) {
        throw new Error(`El asiento de cierre no cuadra: débito ${td} vs crédito ${tc}`);
    }

    const { data: entryId, error } = await supabase.rpc('create_journal_entry', {
        p_date: to.toISOString(),
        p_description: `Cierre del ejercicio ${year}`,
        p_created_by: user.id,
        p_lines: lines as unknown,
    });
    if (error) throw new Error(error.message);

    await supabase.from('journal_entries').update({ state: 'APROBADO' }).eq('id', entryId);

    const { error: closeError } = await supabase.from('year_end_closings').insert({
        year,
        total_income: closing.totalIncome,
        total_expense: closing.totalExpense,
        net_result: closing.netResult,
        journal_entry_id: entryId,
        closed_by: user.id,
        status: 'CLOSED',
    });
    if (closeError) throw new Error(closeError.message);

    revalidatePath('/cierre');
    return { success: true, entryId, netResult: closing.netResult, totalIncome: closing.totalIncome, totalExpense: closing.totalExpense };
}

export async function getYearEndClosings() {
    await enforcePermission('cierre', 'read');
    const supabase = await createClient();
    const { data } = await supabase.from('year_end_closings').select('*').order('year', { ascending: false });
    return data || [];
}
