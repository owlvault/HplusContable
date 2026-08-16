'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface AccountingPeriod {
    id: string;
    year: number;
    month: number;
    start_date: string;
    end_date: string;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    closed_at?: string;
    closed_by?: string;
    notes?: string;
}

export interface ClosingValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
        totalEntries: number;
        totalDebit: number;
        totalCredit: number;
        unbalancedEntries: number;
        draftEntries: number;
    };
}

// Get all accounting periods
export async function getAccountingPeriods(year?: number) {
    const supabase = await createClient();

    let query = supabase
        .from('accounting_periods')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

    if (year) {
        query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching periods:', error);
        return [];
    }

    return data || [];
}

// Get single accounting period
export async function getAccountingPeriod(year: number, month: number) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .single();

    if (error) {
        // Period might not exist, create it
        if (error.code === 'PGRST116') {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            const { data: newPeriod } = await supabase
                .from('accounting_periods')
                .insert({
                    year,
                    month,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    status: 'OPEN',
                })
                .select()
                .single();
            
            return newPeriod;
        }
        throw new Error('Error al obtener período');
    }

    return data;
}

// Validate period for closing
export async function validatePeriodForClosing(year: number, month: number): Promise<ClosingValidation> {
    const supabase = await createClient();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Get all journal entries for the period
    const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select(`
            id,
            state,
            description,
            journal_lines(debit, credit)
        `)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString());

    if (entriesError) {
        return {
            isValid: false,
            errors: ['Error al obtener asientos del período'],
            warnings: [],
            stats: { totalEntries: 0, totalDebit: 0, totalCredit: 0, unbalancedEntries: 0, draftEntries: 0 },
        };
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let unbalancedEntries = 0;
    let draftEntries = 0;

    for (const entry of entries || []) {
        // Check draft entries
        if (entry.state === 'BORRADOR') {
            draftEntries++;
        }

        // Calculate totals and check balance
        let entryDebit = 0;
        let entryCredit = 0;
        
        for (const line of entry.journal_lines || []) {
            entryDebit += line.debit || 0;
            entryCredit += line.credit || 0;
            totalDebit += line.debit || 0;
            totalCredit += line.credit || 0;
        }

        if (Math.abs(entryDebit - entryCredit) > 0.01) {
            unbalancedEntries++;
        }
    }

    // Validations
    if (draftEntries > 0) {
        errors.push(`Existen ${draftEntries} asientos en estado BORRADOR. Deben ser aprobados o eliminados.`);
    }

    if (unbalancedEntries > 0) {
        errors.push(`Existen ${unbalancedEntries} asientos desbalanceados. Débitos ≠ Créditos.`);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        warnings.push(`Diferencia global: Débitos (${totalDebit.toFixed(2)}) vs Créditos (${totalCredit.toFixed(2)})`);
    }

    // Check previous periods
    if (month > 1 || year > 2024) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        const { data: prevPeriod } = await supabase
            .from('accounting_periods')
            .select('status')
            .eq('year', prevYear)
            .eq('month', prevMonth)
            .single();

        if (prevPeriod && prevPeriod.status === 'OPEN') {
            warnings.push(`El período anterior (${prevMonth}/${prevYear}) aún está abierto.`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        stats: {
            totalEntries: entries?.length || 0,
            totalDebit,
            totalCredit,
            unbalancedEntries,
            draftEntries,
        },
    };
}

// Close accounting period
export async function closeAccountingPeriod(year: number, month: number, notes?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Validate first
    const validation = await validatePeriodForClosing(year, month);
    
    if (!validation.isValid) {
        throw new Error(`No se puede cerrar el período: ${validation.errors.join(', ')}`);
    }

    // Get or create period
    const period = await getAccountingPeriod(year, month);
    
    if (!period) {
        throw new Error('Período no encontrado');
    }

    if (period.status !== 'OPEN') {
        throw new Error('El período ya está cerrado');
    }

    // Update period status
    const { error } = await supabase
        .from('accounting_periods')
        .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
            notes: notes,
        })
        .eq('id', period.id);

    if (error) {
        throw new Error('Error al cerrar el período');
    }

    revalidatePath('/cierre');
    return { success: true };
}

// Reopen accounting period
export async function reopenAccountingPeriod(year: number, month: number) {
    const supabase = await createClient();

    const { data: period } = await supabase
        .from('accounting_periods')
        .select('id, status')
        .eq('year', year)
        .eq('month', month)
        .single();

    if (!period) {
        throw new Error('Período no encontrado');
    }

    if (period.status === 'LOCKED') {
        throw new Error('El período está bloqueado y no se puede reabrir');
    }

    if (period.status === 'OPEN') {
        throw new Error('El período ya está abierto');
    }

    // Check if next period is closed
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    const { data: nextPeriod } = await supabase
        .from('accounting_periods')
        .select('status')
        .eq('year', nextYear)
        .eq('month', nextMonth)
        .single();

    if (nextPeriod && nextPeriod.status !== 'OPEN') {
        throw new Error('No se puede reabrir porque el período siguiente está cerrado');
    }

    // Reopen
    const { error } = await supabase
        .from('accounting_periods')
        .update({
            status: 'OPEN',
            closed_at: null,
            closed_by: null,
        })
        .eq('id', period.id);

    if (error) {
        throw new Error('Error al reabrir el período');
    }

    revalidatePath('/cierre');
    return { success: true };
}

// Lock accounting period (permanent)
export async function lockAccountingPeriod(year: number, month: number) {
    const supabase = await createClient();

    const { data: period } = await supabase
        .from('accounting_periods')
        .select('id, status')
        .eq('year', year)
        .eq('month', month)
        .single();

    if (!period) {
        throw new Error('Período no encontrado');
    }

    if (period.status !== 'CLOSED') {
        throw new Error('Solo se pueden bloquear períodos cerrados');
    }

    const { error } = await supabase
        .from('accounting_periods')
        .update({ status: 'LOCKED' })
        .eq('id', period.id);

    if (error) {
        throw new Error('Error al bloquear el período');
    }

    revalidatePath('/cierre');
    return { success: true };
}

// Get closing summary for a year
export async function getYearClosingSummary(year: number) {
    const supabase = await createClient();

    const { data: periods } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('year', year)
        .order('month');

    const summary = {
        year,
        periods: periods || [],
        openCount: 0,
        closedCount: 0,
        lockedCount: 0,
    };

    for (const period of periods || []) {
        if (period.status === 'OPEN') summary.openCount++;
        else if (period.status === 'CLOSED') summary.closedCount++;
        else if (period.status === 'LOCKED') summary.lockedCount++;
    }

    return summary;
}
