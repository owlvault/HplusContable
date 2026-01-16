'use server';

import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/utils/dian';

export async function getTrialBalance(startDate?: string, endDate?: string) {
    const supabase = await createClient();

    // Get all journal lines with account info
    let query = supabase
        .from('journal_lines')
        .select(`
            debit,
            credit,
            account_code,
            puc_accounts (name, type, nature),
            journal_entries!inner (date, state)
        `)
        .eq('journal_entries.state', 'APROBADO');

    if (startDate) {
        query = query.gte('journal_entries.date', startDate);
    }
    if (endDate) {
        query = query.lte('journal_entries.date', endDate);
    }

    const { data: lines, error } = await query;
    if (error) throw new Error(error.message);

    // Group by account
    const balances: Record<string, {
        code: string;
        name: string;
        type: string;
        nature: string;
        debit: number;
        credit: number;
        balance: number;
    }> = {};

    lines?.forEach((line: any) => {
        const code = line.account_code;
        if (!balances[code]) {
            balances[code] = {
                code,
                name: line.puc_accounts?.name || '',
                type: line.puc_accounts?.type || '',
                nature: line.puc_accounts?.nature || '',
                debit: 0,
                credit: 0,
                balance: 0
            };
        }
        balances[code].debit += Number(line.debit) || 0;
        balances[code].credit += Number(line.credit) || 0;
    });

    // Calculate balance based on nature
    Object.values(balances).forEach(acc => {
        if (acc.nature === 'DEBITO') {
            acc.balance = acc.debit - acc.credit;
        } else {
            acc.balance = acc.credit - acc.debit;
        }
    });

    const result = Object.values(balances).sort((a, b) => a.code.localeCompare(b.code));
    
    const totalDebit = result.reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredit = result.reduce((sum, acc) => sum + acc.credit, 0);

    return {
        accounts: result,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    };
}

export async function getIncomeStatement(startDate?: string, endDate?: string) {
    const supabase = await createClient();

    let query = supabase
        .from('journal_lines')
        .select(`
            debit,
            credit,
            account_code,
            puc_accounts (name, type),
            journal_entries!inner (date, state)
        `)
        .eq('journal_entries.state', 'APROBADO');

    if (startDate) {
        query = query.gte('journal_entries.date', startDate);
    }
    if (endDate) {
        query = query.lte('journal_entries.date', endDate);
    }

    const { data: lines, error } = await query;
    if (error) throw new Error(error.message);

    let income = 0;
    let expenses = 0;
    let costOfSales = 0;

    const incomeDetails: { code: string; name: string; amount: number }[] = [];
    const expenseDetails: { code: string; name: string; amount: number }[] = [];

    const accountTotals: Record<string, { name: string; type: string; amount: number }> = {};

    lines?.forEach((line: any) => {
        const code = line.account_code;
        const type = line.puc_accounts?.type;
        
        if (!accountTotals[code]) {
            accountTotals[code] = {
                name: line.puc_accounts?.name || '',
                type: type || '',
                amount: 0
            };
        }

        if (type === 'INGRESO') {
            accountTotals[code].amount += Number(line.credit) - Number(line.debit);
        } else if (type === 'GASTO' || type === 'COSTO_VENTAS') {
            accountTotals[code].amount += Number(line.debit) - Number(line.credit);
        }
    });

    Object.entries(accountTotals).forEach(([code, acc]) => {
        if (acc.type === 'INGRESO') {
            income += acc.amount;
            incomeDetails.push({ code, name: acc.name, amount: acc.amount });
        } else if (acc.type === 'GASTO') {
            expenses += acc.amount;
            expenseDetails.push({ code, name: acc.name, amount: acc.amount });
        } else if (acc.type === 'COSTO_VENTAS') {
            costOfSales += acc.amount;
        }
    });

    const grossProfit = income - costOfSales;
    const netProfit = grossProfit - expenses;

    return {
        income,
        incomeDetails: incomeDetails.sort((a, b) => b.amount - a.amount),
        costOfSales,
        grossProfit,
        expenses,
        expenseDetails: expenseDetails.sort((a, b) => b.amount - a.amount),
        netProfit
    };
}
