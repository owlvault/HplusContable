'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface BankStatementLine {
    id?: string;
    statement_id?: string;
    date: string;
    description: string;
    reference: string | null;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    balance_after: number | null;
    status: 'PENDING' | 'MATCHED' | 'MANUAL' | 'EXCLUDED';
    matched_movement_id: string | null;
}

export interface BankStatement {
    id: string;
    bank_account_id: string;
    period_start: string;
    period_end: string;
    opening_balance: number;
    closing_balance: number;
    total_credits: number;
    total_debits: number;
    status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
    created_at: string;
    lines?: BankStatementLine[];
    bank_account?: {
        id: string;
        name: string;
        account_number: string;
    };
}

export interface ReconciliationSummary {
    statement_balance: number;
    book_balance: number;
    difference: number;
    matched_count: number;
    pending_count: number;
    excluded_count: number;
}

// Get bank accounts for reconciliation
export async function getBankAccountsForReconciliation() {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, bank_name, account_number, account_type, balance, is_active')
        .eq('is_active', true)
        .order('name');
    
    if (error) {
        console.error('Error fetching bank accounts:', error);
        return [];
    }
    
    return data || [];
}

// Get movements for a bank account (not yet reconciled)
export async function getUnreconciledMovements(bankAccountId: string, startDate: string, endDate: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('bank_movements')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .gte('date', startDate)
        .lte('date', endDate)
        .is('reconciled_at', null)
        .order('date');
    
    if (error) {
        console.error('Error fetching movements:', error);
        return [];
    }
    
    return data || [];
}

// Get all movements for a bank account in a period
export async function getMovementsForPeriod(bankAccountId: string, startDate: string, endDate: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('bank_movements')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
    
    if (error) {
        console.error('Error fetching movements:', error);
        return [];
    }
    
    return data || [];
}

// Create a new bank statement for reconciliation
export async function createBankStatement(
    bankAccountId: string,
    periodStart: string,
    periodEnd: string,
    openingBalance: number,
    closingBalance: number
) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('bank_statements')
        .insert({
            bank_account_id: bankAccountId,
            period_start: periodStart,
            period_end: periodEnd,
            opening_balance: openingBalance,
            closing_balance: closingBalance,
            total_credits: 0,
            total_debits: 0,
            status: 'DRAFT',
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating statement:', error);
        throw new Error('Error al crear extracto bancario');
    }
    
    revalidatePath('/conciliacion');
    return data;
}

// Import statement lines from CSV data
export async function importStatementLines(statementId: string, lines: Omit<BankStatementLine, 'id' | 'statement_id'>[]) {
    const supabase = await createClient();
    
    const linesToInsert = lines.map(line => ({
        ...line,
        statement_id: statementId,
        status: 'PENDING',
        matched_movement_id: null,
    }));
    
    const { data, error } = await supabase
        .from('bank_statement_lines')
        .insert(linesToInsert)
        .select();
    
    if (error) {
        console.error('Error importing lines:', error);
        throw new Error('Error al importar líneas del extracto');
    }
    
    // Update statement totals
    const totalCredits = lines.filter(l => l.type === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);
    const totalDebits = lines.filter(l => l.type === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);
    
    await supabase
        .from('bank_statements')
        .update({
            total_credits: totalCredits,
            total_debits: totalDebits,
            status: 'IN_PROGRESS',
        })
        .eq('id', statementId);
    
    revalidatePath('/conciliacion');
    return data;
}

// Auto-match statement lines with bank movements
export async function autoMatchStatementLines(statementId: string) {
    const supabase = await createClient();
    
    // Get statement with lines
    const { data: statement, error: stmtError } = await supabase
        .from('bank_statements')
        .select(`
            *,
            lines:bank_statement_lines(*)
        `)
        .eq('id', statementId)
        .single();
    
    if (stmtError || !statement) {
        throw new Error('Extracto no encontrado');
    }
    
    // Get movements for the period
    const { data: movements, error: movError } = await supabase
        .from('bank_movements')
        .select('*')
        .eq('bank_account_id', statement.bank_account_id)
        .gte('date', statement.period_start)
        .lte('date', statement.period_end)
        .is('reconciled_at', null);
    
    if (movError) {
        throw new Error('Error al obtener movimientos');
    }
    
    let matchedCount = 0;
    const usedMovements = new Set<string>();
    
    // Try to match each pending line
    for (const line of statement.lines || []) {
        if (line.status !== 'PENDING') continue;
        
        // Find matching movement by amount and approximate date
        const lineAmount = line.type === 'CREDIT' ? line.amount : -line.amount;
        const lineDate = new Date(line.date);
        
        const match = (movements || []).find(mov => {
            if (usedMovements.has(mov.id)) return false;
            
            const movAmount = mov.type === 'DEPOSITO' ? mov.amount : -mov.amount;
            const movDate = new Date(mov.date);
            const dateDiff = Math.abs(lineDate.getTime() - movDate.getTime()) / (1000 * 60 * 60 * 24);
            
            // Match by exact amount and date within 3 days
            return Math.abs(movAmount - lineAmount) < 0.01 && dateDiff <= 3;
        });
        
        if (match) {
            usedMovements.add(match.id);
            
            // Update line status
            await supabase
                .from('bank_statement_lines')
                .update({
                    status: 'MATCHED',
                    matched_movement_id: match.id,
                })
                .eq('id', line.id);
            
            // Mark movement as reconciled
            await supabase
                .from('bank_movements')
                .update({ reconciled_at: new Date().toISOString() })
                .eq('id', match.id);
            
            matchedCount++;
        }
    }
    
    revalidatePath('/conciliacion');
    return { matchedCount, totalLines: (statement.lines || []).length };
}

// Manual match a line with a movement
export async function manualMatchLine(lineId: string, movementId: string) {
    const supabase = await createClient();
    
    // Update line
    const { error: lineError } = await supabase
        .from('bank_statement_lines')
        .update({
            status: 'MANUAL',
            matched_movement_id: movementId,
        })
        .eq('id', lineId);
    
    if (lineError) {
        throw new Error('Error al conciliar línea');
    }
    
    // Mark movement as reconciled
    await supabase
        .from('bank_movements')
        .update({ reconciled_at: new Date().toISOString() })
        .eq('id', movementId);
    
    revalidatePath('/conciliacion');
}

// Exclude a line from reconciliation
export async function excludeLine(lineId: string, reason: string) {
    const supabase = await createClient();
    
    const { error } = await supabase
        .from('bank_statement_lines')
        .update({
            status: 'EXCLUDED',
            description: reason,
        })
        .eq('id', lineId);
    
    if (error) {
        throw new Error('Error al excluir línea');
    }
    
    revalidatePath('/conciliacion');
}

// Get reconciliation summary
export async function getReconciliationSummary(statementId: string): Promise<ReconciliationSummary> {
    const supabase = await createClient();
    
    const { data: statement, error } = await supabase
        .from('bank_statements')
        .select(`
            *,
            lines:bank_statement_lines(*),
            bank_account:bank_accounts(balance)
        `)
        .eq('id', statementId)
        .single();
    
    if (error || !statement) {
        throw new Error('Extracto no encontrado');
    }
    
    const lines = statement.lines || [];
    const matchedCount = lines.filter((l: any) => l.status === 'MATCHED' || l.status === 'MANUAL').length;
    const pendingCount = lines.filter((l: any) => l.status === 'PENDING').length;
    const excludedCount = lines.filter((l: any) => l.status === 'EXCLUDED').length;
    
    return {
        statement_balance: statement.closing_balance,
        book_balance: (statement.bank_account as any)?.balance || 0,
        difference: statement.closing_balance - ((statement.bank_account as any)?.balance || 0),
        matched_count: matchedCount,
        pending_count: pendingCount,
        excluded_count: excludedCount,
    };
}

// Complete reconciliation
export async function completeReconciliation(statementId: string) {
    const supabase = await createClient();
    
    // Check if all lines are processed
    const { data: pendingLines } = await supabase
        .from('bank_statement_lines')
        .select('id')
        .eq('statement_id', statementId)
        .eq('status', 'PENDING');
    
    if (pendingLines && pendingLines.length > 0) {
        throw new Error(`Hay ${pendingLines.length} líneas pendientes de conciliar`);
    }
    
    const { error } = await supabase
        .from('bank_statements')
        .update({ status: 'COMPLETED' })
        .eq('id', statementId);
    
    if (error) {
        throw new Error('Error al completar conciliación');
    }
    
    revalidatePath('/conciliacion');
}

// Get statements for a bank account
export async function getBankStatements(bankAccountId?: string) {
    const supabase = await createClient();
    
    let query = supabase
        .from('bank_statements')
        .select(`
            *,
            bank_account:bank_accounts(id, name, account_number)
        `)
        .order('period_end', { ascending: false });
    
    if (bankAccountId) {
        query = query.eq('bank_account_id', bankAccountId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching statements:', error);
        return [];
    }
    
    return data || [];
}

// Get statement with lines
export async function getStatementWithLines(statementId: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('bank_statements')
        .select(`
            *,
            bank_account:bank_accounts(id, name, account_number, balance),
            lines:bank_statement_lines(*)
        `)
        .eq('id', statementId)
        .single();
    
    if (error) {
        console.error('Error fetching statement:', error);
        return null;
    }
    
    return data;
}
