// Exportar reportes a Excel (CSV format para máxima compatibilidad)

type ExportRow = Record<string, string | number | null>;

/**
 * Convierte un array de objetos a formato CSV
 */
function arrayToCSV(data: ExportRow[], headers: { key: string; label: string }[]): string {
    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = data.map(row => 
        headers.map(h => {
            const value = row[h.key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'number') return value.toString();
            return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
}

/**
 * Descarga un archivo CSV
 */
function downloadCSV(content: string, filename: string) {
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exportar Cartera por Clientes/Proveedores
 */
export function downloadCarteraExcel(
    data: any[],
    type: 'receivable' | 'payable',
    filename: string
) {
    const headers = [
        { key: 'name', label: type === 'receivable' ? 'Cliente' : 'Proveedor' },
        { key: 'document_number', label: 'NIT/CC' },
        { key: 'total_documents', label: 'Documentos' },
        { key: 'total_amount', label: 'Monto Total' },
        { key: 'total_pending', label: 'Pendiente' },
        { key: 'overdue_count', label: 'Vencidos' },
        { key: 'overdue_amount', label: 'Monto Vencido' },
    ];
    
    const rows = data.map(item => ({
        name: item.name,
        document_number: item.document_number,
        total_documents: item.total_documents,
        total_amount: item.total_amount,
        total_pending: item.total_pending,
        overdue_count: item.overdue_count,
        overdue_amount: item.overdue_amount,
    }));
    
    const csv = arrayToCSV(rows, headers);
    downloadCSV(csv, filename);
}

/**
 * Exportar Balance de Comprobación
 */
export function downloadTrialBalanceExcel(data: any, period: string, filename: string) {
    const headers = [
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Cuenta' },
        { key: 'debit_balance', label: 'Saldo Débito' },
        { key: 'credit_balance', label: 'Saldo Crédito' },
    ];
    
    const rows = data.accounts?.map((acc: any) => ({
        code: acc.code,
        name: acc.name,
        debit_balance: acc.debit_balance || 0,
        credit_balance: acc.credit_balance || 0,
    })) || [];
    
    // Add totals row
    rows.push({
        code: '',
        name: 'TOTALES',
        debit_balance: data.total_debits || 0,
        credit_balance: data.total_credits || 0,
    });
    
    const csv = arrayToCSV(rows, headers);
    downloadCSV(csv, filename);
}

/**
 * Exportar Balance General
 */
export function downloadBalanceSheetExcel(data: any, filename: string) {
    const headers = [
        { key: 'section', label: 'Sección' },
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Cuenta' },
        { key: 'amount', label: 'Valor' },
    ];
    
    const rows: ExportRow[] = [];
    
    // Assets
    rows.push({ section: 'ACTIVOS', code: '', name: '', amount: null });
    data.assets?.forEach((item: any) => {
        rows.push({ section: 'Activo', code: item.code, name: item.name, amount: item.balance });
    });
    rows.push({ section: 'Activo', code: '', name: 'Total Activos', amount: data.total_assets });
    
    // Liabilities
    rows.push({ section: '', code: '', name: '', amount: null });
    rows.push({ section: 'PASIVOS', code: '', name: '', amount: null });
    data.liabilities?.forEach((item: any) => {
        rows.push({ section: 'Pasivo', code: item.code, name: item.name, amount: item.balance });
    });
    rows.push({ section: 'Pasivo', code: '', name: 'Total Pasivos', amount: data.total_liabilities });
    
    // Equity
    rows.push({ section: '', code: '', name: '', amount: null });
    rows.push({ section: 'PATRIMONIO', code: '', name: '', amount: null });
    data.equity?.forEach((item: any) => {
        rows.push({ section: 'Patrimonio', code: item.code, name: item.name, amount: item.balance });
    });
    rows.push({ section: 'Patrimonio', code: '', name: 'Total Patrimonio', amount: data.total_equity });
    
    // Totals
    rows.push({ section: '', code: '', name: '', amount: null });
    rows.push({ section: '', code: '', name: 'PASIVO + PATRIMONIO', amount: (data.total_liabilities || 0) + (data.total_equity || 0) });
    
    const csv = arrayToCSV(rows, headers);
    downloadCSV(csv, filename);
}

/**
 * Exportar Estado de Resultados
 */
export function downloadIncomeStatementExcel(data: any, filename: string) {
    const headers = [
        { key: 'section', label: 'Sección' },
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Cuenta' },
        { key: 'amount', label: 'Valor' },
    ];
    
    const rows: ExportRow[] = [];
    
    // Income
    rows.push({ section: 'INGRESOS', code: '', name: '', amount: null });
    data.income?.forEach((item: any) => {
        rows.push({ section: 'Ingreso', code: item.code, name: item.name, amount: item.balance });
    });
    rows.push({ section: 'Ingreso', code: '', name: 'Total Ingresos', amount: data.total_income });
    
    // Expenses
    rows.push({ section: '', code: '', name: '', amount: null });
    rows.push({ section: 'GASTOS', code: '', name: '', amount: null });
    data.expenses?.forEach((item: any) => {
        rows.push({ section: 'Gasto', code: item.code, name: item.name, amount: item.balance });
    });
    rows.push({ section: 'Gasto', code: '', name: 'Total Gastos', amount: data.total_expenses });
    
    // Costs
    if (data.costs?.length > 0) {
        rows.push({ section: '', code: '', name: '', amount: null });
        rows.push({ section: 'COSTOS', code: '', name: '', amount: null });
        data.costs?.forEach((item: any) => {
            rows.push({ section: 'Costo', code: item.code, name: item.name, amount: item.balance });
        });
        rows.push({ section: 'Costo', code: '', name: 'Total Costos', amount: data.total_costs || 0 });
    }
    
    // Net Income
    rows.push({ section: '', code: '', name: '', amount: null });
    rows.push({ section: '', code: '', name: 'UTILIDAD NETA', amount: data.net_income });
    
    const csv = arrayToCSV(rows, headers);
    downloadCSV(csv, filename);
}
