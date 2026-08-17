import { describe, it, expect } from 'vitest';
import { computeClosingEntry, type ResultAccountBalance } from './closing-calc';

const ACCS = { utilidadAccount: '360505', perdidaAccount: '361005' };

describe('closing-calc', () => {
    it('genera utilidad y el asiento cuadra', () => {
        const balances: ResultAccountBalance[] = [
            { account_code: '4135', type: 'INGRESO', balance: -10_000_000 }, // ingreso 10M
            { account_code: '5135', type: 'GASTO', balance: 3_000_000 },
            { account_code: '6135', type: 'COSTO_VENTAS', balance: 4_000_000 },
        ];
        const r = computeClosingEntry(balances, ACCS);
        expect(r.totalIncome).toBe(10_000_000);
        expect(r.totalExpense).toBe(7_000_000);
        expect(r.netResult).toBe(3_000_000);

        const td = r.lines.reduce((s, l) => s + l.debit, 0);
        const tc = r.lines.reduce((s, l) => s + l.credit, 0);
        expect(td).toBe(tc); // cuadra

        const utilLine = r.lines.find((l) => l.account_code === ACCS.utilidadAccount);
        expect(utilLine?.credit).toBe(3_000_000);
    });

    it('genera pérdida cuando los gastos superan los ingresos', () => {
        const balances: ResultAccountBalance[] = [
            { account_code: '4135', type: 'INGRESO', balance: -5_000_000 },
            { account_code: '5135', type: 'GASTO', balance: 8_000_000 },
        ];
        const r = computeClosingEntry(balances, ACCS);
        expect(r.netResult).toBe(-3_000_000);
        const td = r.lines.reduce((s, l) => s + l.debit, 0);
        const tc = r.lines.reduce((s, l) => s + l.credit, 0);
        expect(td).toBe(tc);
        const perdLine = r.lines.find((l) => l.account_code === ACCS.perdidaAccount);
        expect(perdLine?.debit).toBe(3_000_000);
    });

    it('ignora cuentas de balance y saldos en cero', () => {
        const balances: ResultAccountBalance[] = [
            { account_code: '1105', type: 'ACTIVO', balance: 9_000_000 },
            { account_code: '4135', type: 'INGRESO', balance: 0 },
        ];
        const r = computeClosingEntry(balances, ACCS);
        // Solo la línea de resultado neto (0 → utilidad 0)
        expect(r.totalIncome).toBe(0);
        expect(r.totalExpense).toBe(0);
    });
});
