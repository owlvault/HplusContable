'use server';

import { createClient } from '@/lib/supabase/server';

export interface BackupData {
    exportedAt: string;
    tables: {
        name: string;
        count: number;
        data: any[];
    }[];
}

/**
 * Exporta todos los datos contables para backup
 */
export async function exportAllAccountingData(): Promise<BackupData> {
    const supabase = await createClient();
    
    const exportedAt = new Date().toISOString();
    const tables: BackupData['tables'] = [];
    
    // Lista de tablas a exportar
    const tablesToExport = [
        'puc_accounts',
        'third_parties',
        'invoices',
        'invoice_lines',
        'journal_entries',
        'journal_lines',
        'receivables',
        'payables',
        'bank_accounts',
        'bank_movements',
        'accounting_periods',
    ];
    
    for (const tableName of tablesToExport) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                tables.push({
                    name: tableName,
                    count: data.length,
                    data: data,
                });
            }
        } catch (e) {
            console.error(`Error exporting ${tableName}:`, e);
        }
    }
    
    return { exportedAt, tables };
}

/**
 * Exporta datos de un periodo específico
 */
export async function exportPeriodData(year: number, month: number): Promise<BackupData> {
    const supabase = await createClient();
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
    
    const exportedAt = new Date().toISOString();
    const tables: BackupData['tables'] = [];
    
    // Facturas del periodo
    const { data: invoices } = await supabase
        .from('invoices')
        .select('*, invoice_lines(*)')
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (invoices) {
        tables.push({ name: 'invoices', count: invoices.length, data: invoices });
    }
    
    // Asientos contables del periodo
    const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('*, journal_lines(*)')
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (journalEntries) {
        tables.push({ name: 'journal_entries', count: journalEntries.length, data: journalEntries });
    }
    
    // Movimientos bancarios del periodo
    const { data: bankMovements } = await supabase
        .from('bank_movements')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
    
    if (bankMovements) {
        tables.push({ name: 'bank_movements', count: bankMovements.length, data: bankMovements });
    }
    
    return { exportedAt, tables };
}

/**
 * Genera un archivo JSON de backup descargable
 */
export async function generateBackupJSON(): Promise<string> {
    const data = await exportAllAccountingData();
    return JSON.stringify(data, null, 2);
}

/**
 * Obtiene estadísticas del último backup
 */
export async function getBackupStats() {
    const supabase = await createClient();
    
    const stats: { table: string; count: number }[] = [];
    
    const tables = [
        'puc_accounts',
        'third_parties', 
        'invoices',
        'journal_entries',
        'bank_movements',
    ];
    
    for (const table of tables) {
        const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        stats.push({ table, count: count || 0 });
    }
    
    return stats;
}
