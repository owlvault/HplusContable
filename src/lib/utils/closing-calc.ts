// =====================================================================
// Lógica pura del asiento de cierre del ejercicio (cancelación de
// cuentas de resultado contra utilidad/pérdida). Sin acceso a datos.
// =====================================================================

export interface ResultAccountBalance {
    account_code: string;
    type: 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | string;
    /** Saldo = débito − crédito. Ingresos suelen ser negativos (crédito). */
    balance: number;
}

export interface ClosingLine {
    account_code: string;
    debit: number;
    credit: number;
    description: string;
}

export interface ClosingResult {
    lines: ClosingLine[];
    totalIncome: number;
    totalExpense: number;
    netResult: number; // + utilidad / - pérdida
}

export interface ClosingAccounts {
    utilidadAccount: string;
    perdidaAccount: string;
}

const RESULT_TYPES = ['INGRESO', 'GASTO', 'COSTO_VENTAS', 'COSTO_PRODUCCION'];

/**
 * Construye las líneas del asiento de cierre a partir de los saldos de las
 * cuentas de resultado. Cancela ingresos (debitándolos) y costos/gastos
 * (acreditándolos), y lleva el neto a utilidad o pérdida del ejercicio.
 * El asiento resultante siempre cuadra (débito = crédito).
 */
export function computeClosingEntry(
    balances: ResultAccountBalance[],
    accounts: ClosingAccounts
): ClosingResult {
    const lines: ClosingLine[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const a of balances) {
        if (!RESULT_TYPES.includes(a.type)) continue;
        if (Math.abs(a.balance) < 0.01) continue;

        if (a.type === 'INGRESO') {
            const amount = Math.round(-a.balance); // saldo crédito → positivo
            totalIncome += amount;
            lines.push({ account_code: a.account_code, debit: amount, credit: 0, description: 'Cancelación de ingresos' });
        } else {
            const amount = Math.round(a.balance); // saldo débito → positivo
            totalExpense += amount;
            lines.push({ account_code: a.account_code, debit: 0, credit: amount, description: 'Cancelación de costos/gastos' });
        }
    }

    const netResult = totalIncome - totalExpense;
    if (netResult >= 0) {
        lines.push({ account_code: accounts.utilidadAccount, debit: 0, credit: netResult, description: 'Utilidad del ejercicio' });
    } else {
        lines.push({ account_code: accounts.perdidaAccount, debit: -netResult, credit: 0, description: 'Pérdida del ejercicio' });
    }

    return { lines, totalIncome, totalExpense, netResult };
}
