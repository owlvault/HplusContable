'use server';

import { createClient } from '@/lib/supabase/server';

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
    const flow = lines.reduce((acc: any, curr) => {
        // @ts-ignore
        const date = new Date(curr.journal_entries?.date).toISOString().slice(0, 7); // YYYY-MM
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
