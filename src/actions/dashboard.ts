'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Fecha del asiento al que pertenece la línea.
 *
 * El cliente de Supabase no está tipado con el esquema, así que infiere las
 * relaciones embebidas como arreglo aunque `entry_id` sea una relación a uno
 * y en tiempo de ejecución llegue un objeto. Se aceptan las dos formas.
 */
function entryDate(entry: unknown): string | null {
    const value = Array.isArray(entry) ? entry[0] : entry;
    return (value as { date?: string } | null | undefined)?.date ?? null;
}

export async function getFinancialMetrics() {
    const supabase = await createClient();

    // This would ideally be a SQL view. Fetching raw data for MVP.
    const { data: lines } = await supabase
        .from('journal_lines')
        .select(`
      debit, 
      credit, 
      account_code, 
      journal_entries ( date )
    `);

    if (!lines) return { income: 0, expenses: 0, profit: 0, history: [] };

    // 4 = Ingresos (Credito)
    const incomeLines = lines.filter(l => l.account_code.startsWith('4'));
    const income = incomeLines.reduce((sum, l) => sum + l.credit, 0); // Gross simplification (ignoring returns)

    // 5 = Gastos (Debito)
    const expenseLines = lines.filter(l => l.account_code.startsWith('5'));
    const expenses = expenseLines.reduce((sum, l) => sum + l.debit, 0);

    // Profit
    const profit = income - expenses;

    // History for Chart (Group by Month)
    // Simplified grouping
    const flow = lines.reduce<Record<string, { income: number; expense: number }>>((acc, curr) => {
        const rawDate = entryDate(curr.journal_entries);
        if (!rawDate) return acc;

        const parsed = new Date(rawDate);
        // Sin esta guarda una sola línea con fecha ilegible tumbaba el
        // dashboard entero: new Date(undefined).toISOString() lanza excepción.
        if (Number.isNaN(parsed.getTime())) return acc;

        const date = parsed.toISOString().slice(0, 7); // YYYY-MM
        if (!acc[date]) acc[date] = { income: 0, expense: 0 };

        if (curr.account_code.startsWith('4')) acc[date].income += curr.credit;
        if (curr.account_code.startsWith('5')) acc[date].expense += curr.debit;

        return acc;
    }, {});

    const history = Object.keys(flow).map(date => ({
        date,
        income: flow[date].income,
        expense: flow[date].expense
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
        income,
        expenses,
        profit,
        history
    };
}
