'use server';

import { createClient } from '@/lib/supabase/server';

export interface ClientReport {
    third_party_id: string;
    third_party_name: string;
    document_number: string;
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
    documents_count: number;
    overdue_amount: number;
    oldest_due_date: string | null;
}

export interface BalanceSheetItem {
    code: string;
    name: string;
    level: number;
    debit: number;
    credit: number;
    balance: number;
    nature: string;
}

export interface IncomeStatementItem {
    code: string;
    name: string;
    level: number;
    amount: number;
    type: 'INGRESO' | 'GASTO' | 'COSTO_VENTAS';
}

// Get receivables report by client
export async function getReceivablesReportByClient(): Promise<ClientReport[]> {
    const supabase = await createClient();

    const { data: receivables, error } = await supabase
        .from('receivables')
        .select(`
            *,
            third_party:third_parties(id, full_name, document_number)
        `)
        .neq('status', 'WRITTEN_OFF');

    if (error) {
        console.error('Error fetching receivables:', error);
        return [];
    }

    // Group by third party
    const groupedByClient: Record<string, ClientReport> = {};
    const today = new Date();

    for (const rec of receivables || []) {
        const clientId = rec.third_party_id;
        
        if (!groupedByClient[clientId]) {
            groupedByClient[clientId] = {
                third_party_id: clientId,
                third_party_name: rec.third_party?.full_name || 'Desconocido',
                document_number: rec.third_party?.document_number || '',
                total_invoiced: 0,
                total_paid: 0,
                total_pending: 0,
                documents_count: 0,
                overdue_amount: 0,
                oldest_due_date: null,
            };
        }

        groupedByClient[clientId].total_invoiced += rec.original_amount;
        groupedByClient[clientId].total_paid += rec.paid_amount;
        groupedByClient[clientId].total_pending += rec.balance;
        groupedByClient[clientId].documents_count++;

        // Check if overdue
        const dueDate = new Date(rec.due_date);
        if (dueDate < today && rec.status !== 'PAID') {
            groupedByClient[clientId].overdue_amount += rec.balance;
        }

        // Track oldest due date
        if (!groupedByClient[clientId].oldest_due_date || rec.due_date < groupedByClient[clientId].oldest_due_date) {
            groupedByClient[clientId].oldest_due_date = rec.due_date;
        }
    }

    return Object.values(groupedByClient).sort((a, b) => b.total_pending - a.total_pending);
}

// Get payables report by supplier
export async function getPayablesReportBySupplier(): Promise<ClientReport[]> {
    const supabase = await createClient();

    const { data: payables, error } = await supabase
        .from('payables')
        .select(`
            *,
            third_party:third_parties(id, full_name, document_number)
        `);

    if (error) {
        console.error('Error fetching payables:', error);
        return [];
    }

    // Group by third party
    const groupedBySupplier: Record<string, ClientReport> = {};
    const today = new Date();

    for (const pay of payables || []) {
        const supplierId = pay.third_party_id;
        
        if (!groupedBySupplier[supplierId]) {
            groupedBySupplier[supplierId] = {
                third_party_id: supplierId,
                third_party_name: pay.third_party?.full_name || 'Desconocido',
                document_number: pay.third_party?.document_number || '',
                total_invoiced: 0,
                total_paid: 0,
                total_pending: 0,
                documents_count: 0,
                overdue_amount: 0,
                oldest_due_date: null,
            };
        }

        groupedBySupplier[supplierId].total_invoiced += pay.original_amount;
        groupedBySupplier[supplierId].total_paid += pay.paid_amount;
        groupedBySupplier[supplierId].total_pending += pay.balance;
        groupedBySupplier[supplierId].documents_count++;

        // Check if overdue
        const dueDate = new Date(pay.due_date);
        if (dueDate < today && pay.status !== 'PAID') {
            groupedBySupplier[supplierId].overdue_amount += pay.balance;
        }

        // Track oldest due date
        if (!groupedBySupplier[supplierId].oldest_due_date || pay.due_date < groupedBySupplier[supplierId].oldest_due_date) {
            groupedBySupplier[supplierId].oldest_due_date = pay.due_date;
        }
    }

    return Object.values(groupedBySupplier).sort((a, b) => b.total_pending - a.total_pending);
}

// Get trial balance (Balance de Comprobación)
export async function getTrialBalance(year: number, month: number): Promise<BalanceSheetItem[]> {
    const supabase = await createClient();

    // Get all journal lines for the period
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data: lines, error } = await supabase
        .from('journal_lines')
        .select(`
            account_code,
            debit,
            credit,
            journal_entry:journal_entries!inner(date, state)
        `)
        .gte('journal_entry.date', startDate.toISOString())
        .lte('journal_entry.date', endDate.toISOString())
        .neq('journal_entry.state', 'ANULADO');

    if (error) {
        console.error('Error fetching journal lines:', error);
        return [];
    }

    // Get PUC accounts
    const { data: accounts } = await supabase
        .from('puc_accounts')
        .select('code, name, level, nature, type')
        .order('code');

    if (!accounts) return [];

    // Aggregate by account
    const balances: Record<string, { debit: number; credit: number }> = {};
    
    for (const line of lines || []) {
        if (!balances[line.account_code]) {
            balances[line.account_code] = { debit: 0, credit: 0 };
        }
        balances[line.account_code].debit += line.debit || 0;
        balances[line.account_code].credit += line.credit || 0;
    }

    // Build report with account details
    const report: BalanceSheetItem[] = [];

    for (const account of accounts) {
        const bal = balances[account.code] || { debit: 0, credit: 0 };
        if (bal.debit > 0 || bal.credit > 0) {
            const balance = account.nature === 'DEBITO' 
                ? bal.debit - bal.credit 
                : bal.credit - bal.debit;
            
            report.push({
                code: account.code,
                name: account.name,
                level: account.level,
                debit: bal.debit,
                credit: bal.credit,
                balance: balance,
                nature: account.nature,
            });
        }
    }

    return report;
}

// Get general ledger (Libro Mayor)
export async function getGeneralLedger(accountCode: string, year: number, month: number) {
    const supabase = await createClient();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data: lines, error } = await supabase
        .from('journal_lines')
        .select(`
            id,
            debit,
            credit,
            description,
            journal_entry:journal_entries!inner(id, date, description, sequence_number, state)
        `)
        .eq('account_code', accountCode)
        .gte('journal_entry.date', startDate.toISOString())
        .lte('journal_entry.date', endDate.toISOString())
        .neq('journal_entry.state', 'ANULADO')
        .order('journal_entry.date', { ascending: true });

    if (error) {
        console.error('Error fetching ledger:', error);
        return [];
    }

    // Calculate running balance
    let runningBalance = 0;
    const ledger = (lines || []).map(line => {
        runningBalance += (line.debit || 0) - (line.credit || 0);
        return {
            ...line,
            running_balance: runningBalance,
        };
    });

    return ledger;
}

// Get Balance Sheet (Estado de Situación Financiera)
export async function getBalanceSheet(year: number, month: number) {
    const supabase = await createClient();

    const endDate = new Date(year, month, 0, 23, 59, 59);
    const startOfYear = new Date(year, 0, 1);

    // Get all journal lines up to the end date
    const { data: lines, error } = await supabase
        .from('journal_lines')
        .select(`
            account_code,
            debit,
            credit,
            journal_entry:journal_entries!inner(date, state)
        `)
        .lte('journal_entry.date', endDate.toISOString())
        .neq('journal_entry.state', 'ANULADO');

    if (error) {
        console.error('Error fetching lines:', error);
        return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, netIncome: 0 };
    }

    // Get PUC accounts for balance sheet
    const { data: bsAccounts } = await supabase
        .from('puc_accounts')
        .select('code, name, level, nature, type')
        .in('type', ['ACTIVO', 'PASIVO', 'PATRIMONIO'])
        .order('code');

    // Get PUC accounts for income statement (to calculate net income)
    const { data: isAccounts } = await supabase
        .from('puc_accounts')
        .select('code, name, level, nature, type')
        .in('type', ['INGRESO', 'GASTO', 'COSTO_VENTAS'])
        .order('code');

    if (!bsAccounts) return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, netIncome: 0 };

    // Aggregate by account
    const balances: Record<string, number> = {};
    // Separate aggregation for income/expense (only current year for net income)
    const ytdBalances: Record<string, number> = {};
    
    for (const line of lines || []) {
        if (!balances[line.account_code]) {
            balances[line.account_code] = 0;
        }
        balances[line.account_code] += (line.debit || 0) - (line.credit || 0);

        // For YTD net income calculation
        const entryDate = new Date((line.journal_entry as any).date);
        if (entryDate >= startOfYear) {
            if (!ytdBalances[line.account_code]) {
                ytdBalances[line.account_code] = 0;
            }
            ytdBalances[line.account_code] += (line.credit || 0) - (line.debit || 0);
        }
    }

    const assets: BalanceSheetItem[] = [];
    const liabilities: BalanceSheetItem[] = [];
    const equity: BalanceSheetItem[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const account of bsAccounts) {
        const rawBalance = balances[account.code] || 0;
        if (rawBalance === 0) continue;

        const balance = account.nature === 'DEBITO' ? rawBalance : -rawBalance;
        const item: BalanceSheetItem = {
            code: account.code,
            name: account.name,
            level: account.level,
            debit: 0,
            credit: 0,
            balance: Math.abs(balance),
            nature: account.nature,
        };

        if (account.type === 'ACTIVO') {
            assets.push(item);
            totalAssets += item.balance;
        } else if (account.type === 'PASIVO') {
            liabilities.push(item);
            totalLiabilities += item.balance;
        } else if (account.type === 'PATRIMONIO') {
            equity.push(item);
            totalEquity += item.balance;
        }
    }

    // Calculate YTD Net Income from income statement accounts
    let netIncome = 0;
    if (isAccounts) {
        for (const account of isAccounts) {
            const balance = ytdBalances[account.code] || 0;
            if (account.type === 'INGRESO') {
                netIncome += balance;
            } else {
                netIncome -= Math.abs(balance);
            }
        }
    }

    // Add "Utilidad del Ejercicio" as a virtual equity line if there's net income
    if (netIncome !== 0) {
        equity.push({
            code: '36',
            name: 'Utilidad del Ejercicio',
            level: 2,
            debit: 0,
            credit: 0,
            balance: netIncome,
            nature: 'CREDITO',
        });
        totalEquity += netIncome;
    }

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome };
}

// Get Income Statement (Estado de Resultados)
export async function getIncomeStatement(year: number, month: number) {
    const supabase = await createClient();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all journal lines for the period
    const { data: lines, error } = await supabase
        .from('journal_lines')
        .select(`
            account_code,
            debit,
            credit,
            journal_entry:journal_entries!inner(date, state)
        `)
        .gte('journal_entry.date', startDate.toISOString())
        .lte('journal_entry.date', endDate.toISOString())
        .neq('journal_entry.state', 'ANULADO');

    if (error) {
        console.error('Error fetching lines:', error);
        return { income: [], expenses: [], costs: [], totalIncome: 0, totalExpenses: 0, totalCosts: 0, netIncome: 0 };
    }

    // Get PUC accounts
    const { data: accounts } = await supabase
        .from('puc_accounts')
        .select('code, name, level, nature, type')
        .in('type', ['INGRESO', 'GASTO', 'COSTO_VENTAS'])
        .order('code');

    if (!accounts) return { income: [], expenses: [], costs: [], totalIncome: 0, totalExpenses: 0, totalCosts: 0, netIncome: 0 };

    // Aggregate by account
    const balances: Record<string, number> = {};
    
    for (const line of lines || []) {
        if (!balances[line.account_code]) {
            balances[line.account_code] = 0;
        }
        // For income accounts, credit increases (positive)
        // For expense/cost accounts, debit increases (positive)
        balances[line.account_code] += (line.credit || 0) - (line.debit || 0);
    }

    const income: IncomeStatementItem[] = [];
    const expenses: IncomeStatementItem[] = [];
    const costs: IncomeStatementItem[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalCosts = 0;

    for (const account of accounts) {
        const balance = balances[account.code] || 0;
        if (balance === 0) continue;

        const item: IncomeStatementItem = {
            code: account.code,
            name: account.name,
            level: account.level,
            amount: Math.abs(balance),
            type: account.type as 'INGRESO' | 'GASTO' | 'COSTO_VENTAS',
        };

        if (account.type === 'INGRESO') {
            income.push(item);
            totalIncome += item.amount;
        } else if (account.type === 'GASTO') {
            expenses.push(item);
            totalExpenses += item.amount;
        } else if (account.type === 'COSTO_VENTAS') {
            costs.push(item);
            totalCosts += item.amount;
        }
    }

    const netIncome = totalIncome - totalExpenses - totalCosts;

    return { income, expenses, costs, totalIncome, totalExpenses, totalCosts, netIncome };
}
