'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { enforcePermission } from '@/lib/rbac';

export interface BankAccount {
    id: string;
    bank_name: string;
    account_number: string;
    account_type: 'AHORROS' | 'CORRIENTE';
    currency: string;
    initial_balance: number;
    current_balance: number;
    puc_account_code?: string;
    is_active: boolean;
    created_at: string;
}

export interface BankMovement {
    id: string;
    bank_account_id: string;
    date: string;
    type: 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'COMISION' | 'INTERES';
    reference?: string;
    description?: string;
    amount: number;
    balance_after: number;
    is_reconciled: boolean;
    source_type?: string;
    source_id?: string;
    bank_account?: BankAccount;
}

export interface CashFlowStats {
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    accountsCount: number;
    pendingReconciliation: number;
}

// Get all bank accounts
export async function getBankAccounts(activeOnly: boolean = true) {
    // RBAC: verificar permiso de lectura en tesorería
    await enforcePermission('tesoreria', 'read');
    
    const supabase = await createClient();

    let query = supabase
        .from('bank_accounts')
        .select('*')
        .order('bank_name');

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching bank accounts:', error);
        throw new Error('Error al obtener cuentas bancarias');
    }

    return data || [];
}

// Get single bank account
export async function getBankAccount(id: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        throw new Error('Cuenta bancaria no encontrada');
    }

    return data;
}

// Create bank account
export async function createBankAccount(accountData: Omit<BankAccount, 'id' | 'created_at' | 'current_balance'>) {
    // RBAC: verificar permiso de escritura en tesorería
    await enforcePermission('tesoreria', 'write');
    
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
            ...accountData,
            current_balance: accountData.initial_balance,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating bank account:', error);
        throw new Error('Error al crear cuenta bancaria');
    }

    revalidatePath('/tesoreria');
    return { success: true, account: data };
}

// Update bank account
export async function updateBankAccount(id: string, accountData: Partial<BankAccount>) {
    // RBAC: verificar permiso de escritura en tesorería
    await enforcePermission('tesoreria', 'write');
    
    const supabase = await createClient();

    const { error } = await supabase
        .from('bank_accounts')
        .update({
            ...accountData,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        throw new Error('Error al actualizar cuenta bancaria');
    }

    revalidatePath('/tesoreria');
    return { success: true };
}

// Delete bank account (soft delete - deactivate)
export async function deactivateBankAccount(id: string) {
    // RBAC: verificar permiso de eliminación en tesorería
    await enforcePermission('tesoreria', 'delete');
    
    const supabase = await createClient();

    const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        throw new Error('Error al desactivar cuenta bancaria');
    }

    revalidatePath('/tesoreria');
    return { success: true };
}

// Get bank movements
export async function getBankMovements(accountId?: string, limit: number = 50) {
    // RBAC: verificar permiso de lectura en tesorería
    await enforcePermission('tesoreria', 'read');
    
    const supabase = await createClient();

    let query = supabase
        .from('bank_movements')
        .select(`
            *,
            bank_account:bank_accounts(id, bank_name, account_number)
        `)
        .order('date', { ascending: false })
        .limit(limit);

    if (accountId) {
        query = query.eq('bank_account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching bank movements:', error);
        throw new Error('Error al obtener movimientos bancarios');
    }

    return data || [];
}

// Create bank movement
export async function createBankMovement(movementData: {
    bank_account_id: string;
    date: string;
    type: 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'COMISION' | 'INTERES';
    amount: number;
    reference?: string;
    description?: string;
}) {
    // RBAC: verificar permiso de escritura en tesorería
    await enforcePermission('tesoreria', 'write');
    
    const supabase = await createClient();

    // Get current balance
    const { data: account, error: accountError } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', movementData.bank_account_id)
        .single();

    if (accountError || !account) {
        throw new Error('Cuenta bancaria no encontrada');
    }

    // Calculate new balance
    const isDebit = ['RETIRO', 'TRANSFERENCIA', 'COMISION'].includes(movementData.type);
    const amount = Math.abs(movementData.amount);
    const newBalance = isDebit 
        ? account.current_balance - amount 
        : account.current_balance + amount;

    if (newBalance < 0) {
        throw new Error('Saldo insuficiente para realizar esta operación');
    }

    // Create movement
    const { data: movement, error: movementError } = await supabase
        .from('bank_movements')
        .insert({
            bank_account_id: movementData.bank_account_id,
            date: movementData.date,
            type: movementData.type,
            amount: isDebit ? -amount : amount,
            reference: movementData.reference,
            description: movementData.description,
            balance_after: newBalance,
            is_reconciled: false,
        })
        .select()
        .single();

    if (movementError) {
        console.error('Error creating movement:', movementError);
        throw new Error('Error al crear movimiento');
    }

    // Update account balance
    const { error: updateError } = await supabase
        .from('bank_accounts')
        .update({ 
            current_balance: newBalance,
            updated_at: new Date().toISOString()
        })
        .eq('id', movementData.bank_account_id);

    if (updateError) {
        console.error('Error updating balance:', updateError);
    }

    revalidatePath('/tesoreria');
    return { success: true, movement };
}

// Transfer between accounts
export async function transferBetweenAccounts(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: string,
    reference?: string
) {
    const supabase = await createClient();

    // Get both accounts
    const { data: accounts, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('id, current_balance, bank_name')
        .in('id', [fromAccountId, toAccountId]);

    if (accountsError || !accounts || accounts.length !== 2) {
        throw new Error('Cuentas bancarias no encontradas');
    }

    const fromAccount = accounts.find(a => a.id === fromAccountId);
    const toAccount = accounts.find(a => a.id === toAccountId);

    if (!fromAccount || !toAccount) {
        throw new Error('Cuentas bancarias no encontradas');
    }

    if (fromAccount.current_balance < amount) {
        throw new Error('Saldo insuficiente en la cuenta origen');
    }

    const newFromBalance = fromAccount.current_balance - amount;
    const newToBalance = toAccount.current_balance + amount;

    // Create withdrawal movement
    await supabase.from('bank_movements').insert({
        bank_account_id: fromAccountId,
        date,
        type: 'TRANSFERENCIA',
        amount: -amount,
        reference,
        description: `Transferencia a ${toAccount.bank_name}`,
        balance_after: newFromBalance,
        is_reconciled: false,
    });

    // Create deposit movement
    await supabase.from('bank_movements').insert({
        bank_account_id: toAccountId,
        date,
        type: 'TRANSFERENCIA',
        amount: amount,
        reference,
        description: `Transferencia desde ${fromAccount.bank_name}`,
        balance_after: newToBalance,
        is_reconciled: false,
    });

    // Update both balances
    await supabase.from('bank_accounts').update({ 
        current_balance: newFromBalance,
        updated_at: new Date().toISOString()
    }).eq('id', fromAccountId);

    await supabase.from('bank_accounts').update({ 
        current_balance: newToBalance,
        updated_at: new Date().toISOString()
    }).eq('id', toAccountId);

    revalidatePath('/tesoreria');
    return { success: true };
}

// Reconcile movement
export async function reconcileMovement(movementId: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('bank_movements')
        .update({ 
            is_reconciled: true,
            reconciled_at: new Date().toISOString()
        })
        .eq('id', movementId);

    if (error) {
        throw new Error('Error al conciliar movimiento');
    }

    revalidatePath('/tesoreria');
    return { success: true };
}

// Get cash flow stats
export async function getCashFlowStats(): Promise<CashFlowStats> {
    const supabase = await createClient();

    // Get all active accounts
    const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('is_active', true);

    // Get movements for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: movements } = await supabase
        .from('bank_movements')
        .select('amount, is_reconciled')
        .gte('date', startOfMonth.toISOString());

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let pendingReconciliation = 0;

    for (const mov of movements || []) {
        if (mov.amount > 0) {
            totalDeposits += mov.amount;
        } else {
            totalWithdrawals += Math.abs(mov.amount);
        }
        if (!mov.is_reconciled) {
            pendingReconciliation++;
        }
    }

    const totalBalance = (accounts || []).reduce((sum, acc) => sum + acc.current_balance, 0);

    return {
        totalBalance,
        totalDeposits,
        totalWithdrawals,
        accountsCount: accounts?.length || 0,
        pendingReconciliation,
    };
}

// Get monthly cash flow for chart
export async function getMonthlyCashFlow(year: number = new Date().getFullYear()) {
    const supabase = await createClient();

    const { data: movements } = await supabase
        .from('bank_movements')
        .select('date, amount')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`);

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: new Date(year, i, 1).toLocaleDateString('es-CO', { month: 'short' }),
        inflows: 0,
        outflows: 0,
    }));

    for (const mov of movements || []) {
        const month = new Date(mov.date).getMonth();
        if (mov.amount > 0) {
            monthlyData[month].inflows += mov.amount;
        } else {
            monthlyData[month].outflows += Math.abs(mov.amount);
        }
    }

    return monthlyData;
}
