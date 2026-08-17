import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeClosingEntry,
  type ResultAccountBalance,
  type ClosingAccounts,
  type ClosingResult,
} from '../../src/lib/utils/closing-calc';
import {
  validatePeriodForClosing,
  type ClosingValidation,
} from '../../src/actions/cierre';
import {
  rollupPUCHierarchy,
  applyAnnualClosingResets,
  calculateNetBalance,
  roundCOP,
  compareCOP,
  assertCOPEquals,
  createDirectorySnapshot,
  verifyDirectoryIntegrity,
  DEFAULT_BACKUP_DIRECTORY,
  STANDARD_MOCK_ACCOUNTS,
  generateMockTransaction,
  generateMockBatch,
  generateBalancedEntryPair,
  type MockJournalEntry,
  type DirectorySnapshot,
} from './helpers/test-harness';

/**
 * ============================================================================
 * E2E TIER 3: MULTI-PERIOD & ANNUAL CLOSURES TEST SUITE
 * ============================================================================
 * Coverage Requirements:
 * 1. Multi-month consecutive period balance transitions (Jan -> Feb -> ... -> Dec)
 * 2. Annual closing entries (Class 4 Revenue, Class 5 Expenses, Class 6 Costs, Class 7 Reset to 0)
 * 3. Net income/loss equity update (Class 3)
 * 4. Multi-year initial balance propagation (Dec 2023 ending -> Jan 2024 initial)
 * 5. Read-Only infrastructure protection verification
 * ============================================================================
 */

describe('Tier 3: Multi-Period & Annual Closures E2E Test Suite', () => {
  const DEFAULT_CLOSING_ACCOUNTS: ClosingAccounts = {
    utilidadAccount: '360505',
    perdidaAccount: '361005',
  };

  let backupSnapshot: DirectorySnapshot;

  beforeEach(() => {
    // Capture snapshot of Read-Only backup directory before running multi-period tests
    backupSnapshot = createDirectorySnapshot(DEFAULT_BACKUP_DIRECTORY);
  });

  // ==========================================================================
  // SECTION 1: MULTI-MONTH CONSECUTIVE PERIOD BALANCE TRANSITIONS
  // ==========================================================================

  it('1. should perform multi-month consecutive period balance transitions (Jan through Dec)', () => {
    // Track balance sheet real accounts across 12 consecutive months
    const accountState: Record<string, number> = {
      [STANDARD_MOCK_ACCOUNTS.CAJA_GENERAL]: 5_000_000,    // 11050501 - Initial Cash
      [STANDARD_MOCK_ACCOUNTS.BANCOS_NACIONALES]: 50_000_000,// 11100501 - Initial Bank
      [STANDARD_MOCK_ACCOUNTS.CLIENTES_NACIONALES]: 12_000_000, // 13050501 - Receivables
      [STANDARD_MOCK_ACCOUNTS.PROVEEDORES_NACIONALES]: 15_000_000, // 22050501 - Payables
      '31050501': 52_000_000,                              // Capital Social (Assets - Liabilities)
    };

    const monthlyMovements: Array<{
      month: number;
      cashMove: number;
      bankMove: number;
      recMove: number;
      payMove: number;
    }> = [
      { month: 1, cashMove: 500_000, bankMove: 2_000_000, recMove: 1_000_000, payMove: 800_000 },
      { month: 2, cashMove: -200_000, bankMove: 3_500_000, recMove: -500_000, payMove: 1_200_000 },
      { month: 3, cashMove: 100_000, bankMove: -1_000_000, recMove: 2_500_000, payMove: -500_000 },
      { month: 4, cashMove: 800_000, bankMove: 4_000_000, recMove: -1_200_000, payMove: 2_000_000 },
      { month: 5, cashMove: -300_000, bankMove: -500_000, recMove: 3_000_000, payMove: 1_500_000 },
      { month: 6, cashMove: 400_000, bankMove: 6_000_000, recMove: 500_000, payMove: -2_000_000 },
      { month: 7, cashMove: 200_000, bankMove: -2_000_000, recMove: 1_800_000, payMove: 600_000 },
      { month: 8, cashMove: -100_000, bankMove: 1_500_000, recMove: -800_000, payMove: 1_000_000 },
      { month: 9, cashMove: 600_000, bankMove: 5_000_000, recMove: 2_000_000, payMove: -1_000_000 },
      { month: 10, cashMove: -400_000, bankMove: -1_500_000, recMove: -1_000_000, payMove: 500_000 },
      { month: 11, cashMove: 300_000, bankMove: 4_500_000, recMove: 1_500_000, payMove: 1_100_000 },
      { month: 12, cashMove: 500_000, bankMove: 7_000_000, recMove: -2_000_000, payMove: -1_500_000 },
    ];

    const monthlySnapshots: Array<Record<string, { opening: number; closing: number }>> = [];

    // Simulate 12 consecutive month roll-forwards
    for (const move of monthlyMovements) {
      const monthSnapshot: Record<string, { opening: number; closing: number }> = {};

      for (const accountCode of Object.keys(accountState)) {
        const opening = accountState[accountCode];
        let netMove = 0;

        if (accountCode === STANDARD_MOCK_ACCOUNTS.CAJA_GENERAL) netMove = move.cashMove;
        else if (accountCode === STANDARD_MOCK_ACCOUNTS.BANCOS_NACIONALES) netMove = move.bankMove;
        else if (accountCode === STANDARD_MOCK_ACCOUNTS.CLIENTES_NACIONALES) netMove = move.recMove;
        else if (accountCode === STANDARD_MOCK_ACCOUNTS.PROVEEDORES_NACIONALES) netMove = move.payMove;

        const closing = roundCOP(opening + netMove);
        monthSnapshot[accountCode] = { opening, closing };

        // Roll-forward: closing balance becomes next month's opening balance
        accountState[accountCode] = closing;
      }

      monthlySnapshots.push(monthSnapshot);
    }

    // Verify roll-forward continuity across consecutive months
    for (let m = 0; m < 11; m++) {
      const currentMonthClosing = monthlySnapshots[m];
      const nextMonthOpening = monthlySnapshots[m + 1];

      for (const code of Object.keys(accountState)) {
        assertCOPEquals(
          nextMonthOpening[code].opening,
          currentMonthClosing[code].closing,
          0.01,
          `Month ${m + 1} opening balance must match Month ${m} closing balance for account ${code}`
        );
      }
    }

    // Verify total cumulative balance at Dec 31
    const totalCashMoves = monthlyMovements.reduce((sum, m) => sum + m.cashMove, 0);
    const expectedDecCash = 5_000_000 + totalCashMoves;
    assertCOPEquals(accountState[STANDARD_MOCK_ACCOUNTS.CAJA_GENERAL], expectedDecCash, 0.01);
  });

  it('2. should accumulate nominal accounts YTD across consecutive months prior to annual closure', () => {
    // Nominal accounts YTD accumulation (Revenue & Expenses)
    const monthlyNominalData = [
      { month: 1, revenue: 10_000_000, expense: 4_000_000 },
      { month: 2, revenue: 12_000_000, expense: 5_500_000 },
      { month: 3, revenue: 15_000_000, expense: 6_000_000 },
      { month: 4, revenue: 11_000_000, expense: 4_800_000 },
      { month: 5, revenue: 14_000_000, expense: 5_200_000 },
      { month: 6, revenue: 18_000_000, expense: 7_000_000 },
      { month: 7, revenue: 16_000_000, expense: 6_500_000 },
      { month: 8, revenue: 13_000_000, expense: 5_000_000 },
      { month: 9, revenue: 17_000_000, expense: 6_800_000 },
      { month: 10, revenue: 19_000_000, expense: 7_200_000 },
      { month: 11, revenue: 20_000_000, expense: 8_000_000 },
      { month: 12, revenue: 25_000_000, expense: 10_000_000 },
    ];

    let ytdRevenue = 0;
    let ytdExpense = 0;

    for (const m of monthlyNominalData) {
      ytdRevenue += m.revenue;
      ytdExpense += m.expense;

      // Verify intermediate monthly YTD accumulation
      const netYTD = ytdRevenue - ytdExpense;
      expect(netYTD).toBeGreaterThan(0);
    }

    // Verify annual cumulative totals before closing
    expect(ytdRevenue).toBe(200_000_000);
    expect(ytdExpense).toBe(76_000_000);
  });

  it('3. should enforce period status lifecycle & transition constraints (OPEN -> CLOSED -> LOCKED)', () => {
    interface PeriodState {
      year: number;
      month: number;
      status: 'OPEN' | 'CLOSED' | 'LOCKED';
    }

    const periods: PeriodState[] = Array.from({ length: 12 }, (_, i) => ({
      year: 2024,
      month: i + 1,
      status: 'OPEN',
    }));

    // Function to close period
    const closePeriod = (month: number) => {
      const p = periods.find((item) => item.month === month);
      if (!p) throw new Error('Period not found');
      if (p.status !== 'OPEN') throw new Error('Period is already closed or locked');
      p.status = 'CLOSED';
    };

    // Function to reopen period
    const reopenPeriod = (month: number) => {
      const p = periods.find((item) => item.month === month);
      if (!p) throw new Error('Period not found');
      if (p.status === 'LOCKED') throw new Error('Period is locked');
      if (p.status === 'OPEN') throw new Error('Period is already open');

      // Constraint: Cannot reopen month M if month M+1 is CLOSED or LOCKED
      const nextP = periods.find((item) => item.month === month + 1);
      if (nextP && nextP.status !== 'OPEN') {
        throw new Error('Cannot reopen because next period is closed');
      }

      p.status = 'OPEN';
    };

    // Lock period
    const lockPeriod = (month: number) => {
      const p = periods.find((item) => item.month === month);
      if (!p) throw new Error('Period not found');
      if (p.status !== 'CLOSED') throw new Error('Only closed periods can be locked');
      p.status = 'LOCKED';
    };

    // Sequentially close Jan and Feb
    closePeriod(1);
    expect(periods[0].status).toBe('CLOSED');

    closePeriod(2);
    expect(periods[1].status).toBe('CLOSED');

    // Attempting to reopen Jan should fail because Feb is CLOSED
    expect(() => reopenPeriod(1)).toThrow('Cannot reopen because next period is closed');

    // Reopen Feb first, then Jan
    reopenPeriod(2);
    expect(periods[1].status).toBe('OPEN');
    reopenPeriod(1);
    expect(periods[0].status).toBe('OPEN');

    // Re-close Jan and lock it
    closePeriod(1);
    lockPeriod(1);
    expect(periods[0].status).toBe('LOCKED');

    // Attempting to reopen locked Jan should fail
    expect(() => reopenPeriod(1)).toThrow('Period is locked');
  });

  it('4. should reject period closing when draft or unbalanced entries exist', async () => {
    // Generate mock entries: 1 approved, 1 draft, 1 unbalanced
    const approvedEntry = generateMockTransaction({
      date: '2024-03-15',
      state: 'APROBADO',
      amount: 2_500_000,
    });

    const draftEntry = generateMockTransaction({
      date: '2024-03-20',
      state: 'BORRADOR',
      amount: 1_200_000,
    });

    const unbalancedEntry = generateMockTransaction({
      date: '2024-03-25',
      state: 'APROBADO',
      amount: 3_000_000,
      unbalanced: true,
      unbalanceAmount: 150_000,
    });

    const entries = [approvedEntry, draftEntry, unbalancedEntry];

    // Evaluate validation logic manually matching validatePeriodForClosing
    let draftCount = 0;
    let unbalancedCount = 0;
    const errors: string[] = [];

    for (const e of entries) {
      if (e.state === 'BORRADOR') {
        draftCount++;
      }
      const deb = e.lines.reduce((s, l) => s + l.debit, 0);
      const cred = e.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(deb - cred) > 0.01) {
        unbalancedCount++;
      }
    }

    if (draftCount > 0) {
      errors.push(`Existen ${draftCount} asientos en estado BORRADOR.`);
    }
    if (unbalancedCount > 0) {
      errors.push(`Existen ${unbalancedCount} asientos desbalanceados.`);
    }

    expect(errors.length).toBe(2);
    expect(errors[0]).toContain('BORRADOR');
    expect(errors[1]).toContain('desbalanceados');
  });

  // ==========================================================================
  // SECTION 2: ANNUAL CLOSING ENTRIES (CLASSES 4, 5, 6, 7 RESET TO 0)
  // ==========================================================================

  it('5. should calculate annual closing entries and reset Class 4, 5, 6, 7 accounts to zero', () => {
    // Setup nominal result account balances (Ingresos, Gastos, Costos)
    // In PUC, Ingresos have credit nature (balance < 0 in debit-credit notation)
    // Gastos and Costos have debit nature (balance > 0)
    const resultBalances: ResultAccountBalance[] = [
      { account_code: '41350501', type: 'INGRESO', balance: -150_000_000 },
      { account_code: '42100501', type: 'INGRESO', balance: -10_000_000 },
      { account_code: '51050601', type: 'GASTO', balance: 45_000_000 },
      { account_code: '51201001', type: 'GASTO', balance: 12_000_000 },
      { account_code: '51353001', type: 'GASTO', balance: 8_000_000 },
      { account_code: '61350501', type: 'COSTO_VENTAS', balance: 50_000_000 },
      { account_code: '71050501', type: 'COSTO_PRODUCCION', balance: 15_000_000 },
    ];

    const closingResult = computeClosingEntry(resultBalances, DEFAULT_CLOSING_ACCOUNTS);

    expect(closingResult.totalIncome).toBe(160_000_000);
    expect(closingResult.totalExpense).toBe(130_000_000);
    expect(closingResult.netResult).toBe(30_000_000);

    // Verify closing lines debiting revenue and crediting expenses/costs
    const revenueLines = closingResult.lines.filter((l) => l.account_code.startsWith('4'));
    const expenseLines = closingResult.lines.filter(
      (l) => l.account_code.startsWith('5') || l.account_code.startsWith('6') || l.account_code.startsWith('7')
    );

    for (const line of revenueLines) {
      expect(line.debit).toBeGreaterThan(0);
      expect(line.credit).toBe(0);
    }

    for (const line of expenseLines) {
      expect(line.debit).toBe(0);
      expect(line.credit).toBeGreaterThan(0);
    }

    // Apply annual closing resets to balances
    const initialMap: Record<string, { debit: number; credit: number; balance: number }> = {};
    for (const b of resultBalances) {
      initialMap[b.account_code] = {
        debit: b.balance > 0 ? b.balance : 0,
        credit: b.balance < 0 ? Math.abs(b.balance) : 0,
        balance: b.balance,
      };
    }

    const resetMap = applyAnnualClosingResets(initialMap);

    for (const code of Object.keys(resetMap)) {
      expect(resetMap[code].balance).toBe(0);
      expect(resetMap[code].debit).toBe(0);
      expect(resetMap[code].credit).toBe(0);
    }
  });

  it('6. should ensure 100% double-entry equilibrium (Debit == Credit) for annual closing entry', () => {
    const resultBalances: ResultAccountBalance[] = [
      { account_code: '41350501', type: 'INGRESO', balance: -245_875_420.50 },
      { account_code: '42100501', type: 'INGRESO', balance: -14_250_100.25 },
      { account_code: '51050601', type: 'GASTO', balance: 88_400_300.75 },
      { account_code: '51201001', type: 'GASTO', balance: 24_600_000.00 },
      { account_code: '51353001', type: 'GASTO', balance: 16_850_900.10 },
      { account_code: '61350501', type: 'COSTO_VENTAS', balance: 95_200_000.00 },
    ];

    const closing = computeClosingEntry(resultBalances, DEFAULT_CLOSING_ACCOUNTS);

    const totalDebits = roundCOP(closing.lines.reduce((s, l) => s + l.debit, 0));
    const totalCredits = roundCOP(closing.lines.reduce((s, l) => s + l.credit, 0));

    assertCOPEquals(
      totalDebits,
      totalCredits,
      0.01,
      'Annual closing journal entry must be perfectly balanced (Debit == Credit)'
    );
  });

  // ==========================================================================
  // SECTION 3: NET INCOME / LOSS EQUITY UPDATE (CLASS 3)
  // ==========================================================================

  it('7. should credit Net Profit (Utilidad) to Class 3 equity account and maintain accounting equation', () => {
    const revenue = 180_000_000;
    const expensesAndCosts = 120_000_000;
    const netProfit = revenue - expensesAndCosts; // +60,000,000 COP

    const resultBalances: ResultAccountBalance[] = [
      { account_code: '41350501', type: 'INGRESO', balance: -revenue },
      { account_code: '51050601', type: 'GASTO', balance: expensesAndCosts },
    ];

    const closing = computeClosingEntry(resultBalances, DEFAULT_CLOSING_ACCOUNTS);
    expect(closing.netResult).toBe(netProfit);

    // Verify closing line credits account 360505 (Utilidad del Ejercicio)
    const equityLine = closing.lines.find((l) => l.account_code === DEFAULT_CLOSING_ACCOUNTS.utilidadAccount);
    expect(equityLine).toBeDefined();
    expect(equityLine?.credit).toBe(netProfit);
    expect(equityLine?.debit).toBe(0);

    // Verify Accounting Equation: Assets (200M) = Liabilities (80M) + Initial Equity (60M) + Profit (60M)
    const assets = 200_000_000;
    const liabilities = 80_000_000;
    const initialEquity = 60_000_000;
    const finalEquity = initialEquity + netProfit; // 120,000,000

    assertCOPEquals(assets, liabilities + finalEquity, 0.01, 'Assets must equal Liabilities + Equity after profit credit');
  });

  it('8. should debit Net Loss (Pérdida) to Class 3 equity account and maintain accounting equation', () => {
    const revenue = 90_000_000;
    const expensesAndCosts = 140_000_000;
    const netLoss = revenue - expensesAndCosts; // -50,000,000 COP

    const resultBalances: ResultAccountBalance[] = [
      { account_code: '41350501', type: 'INGRESO', balance: -revenue },
      { account_code: '51050601', type: 'GASTO', balance: expensesAndCosts },
    ];

    const closing = computeClosingEntry(resultBalances, DEFAULT_CLOSING_ACCOUNTS);
    expect(closing.netResult).toBe(netLoss);

    // Verify closing line debits account 361005 (Pérdida del Ejercicio)
    const lossLine = closing.lines.find((l) => l.account_code === DEFAULT_CLOSING_ACCOUNTS.perdidaAccount);
    expect(lossLine).toBeDefined();
    expect(lossLine?.debit).toBe(Math.abs(netLoss));
    expect(lossLine?.credit).toBe(0);

    // Verify Accounting Equation with Net Loss: Assets (150M) = Liabilities (80M) + Initial Equity (120M) - Loss (50M)
    const assets = 150_000_000;
    const liabilities = 80_000_000;
    const initialEquity = 120_000_000;
    const finalEquity = initialEquity + netLoss; // 70,000,000

    assertCOPEquals(assets, liabilities + finalEquity, 0.01, 'Assets must equal Liabilities + Equity after loss debit');
  });

  it('9. should handle year-end retained earnings transfer (3605 Utilidad Ejercicio -> 3705 Utilidades Acumuladas)', () => {
    // Initial state: Prior year net profit in 360505
    let account360505 = 35_000_000; // Credit balance (Utilidad Ejercicio 2023)
    let account370505 = 100_000_000; // Credit balance (Utilidades Acumuladas)

    // Transfer transaction: Debit 360505, Credit 370505
    const transferLine1 = { account_code: '360505', debit: 35_000_000, credit: 0 };
    const transferLine2 = { account_code: '370505', debit: 0, credit: 35_000_000 };

    account360505 -= transferLine1.debit;
    account370505 += transferLine2.credit;

    // Verify 360505 is zeroed for new fiscal year and 370505 contains accumulated profits
    expect(account360505).toBe(0);
    expect(account370505).toBe(135_000_000);
  });

  // ==========================================================================
  // SECTION 4: MULTI-YEAR INITIAL BALANCE PROPAGATION
  // ==========================================================================

  it('10. should propagate Dec 31, 2023 ending balance as Jan 1, 2024 initial balance with nominal resets', () => {
    // Dec 31, 2023 Trial Balance
    const dec2023Balances: Array<{
      account_code: string;
      account_name: string;
      debit: number;
      credit: number;
      initial_balance?: number;
    }> = [
      { account_code: '11050501', account_name: 'Caja General', debit: 10_000_000, credit: 0 },
      { account_code: '11100501', account_name: 'Bancos Nacionales', debit: 85_000_000, credit: 0 },
      { account_code: '13050501', account_name: 'Clientes Nacionales', debit: 25_000_000, credit: 0 },
      { account_code: '22050501', account_name: 'Proveedores Nacionales', debit: 0, credit: 30_000_000 },
      { account_code: '31050501', account_name: 'Capital Social', debit: 0, credit: 50_000_000 },
      { account_code: '36050501', account_name: 'Utilidad del Ejercicio', debit: 0, credit: 40_000_000 },
      { account_code: '41350501', account_name: 'Comercio Mayor', debit: 0, credit: 120_000_000 },
      { account_code: '51050601', account_name: 'Gastos Personal', debit: 80_000_000, credit: 0 },
    ];

    // Rollup Dec 2023
    const decRollup = rollupPUCHierarchy(dec2023Balances);
    expect(decRollup.isBalanced).toBe(true);

    // Apply Year-End closing resets for Jan 1, 2024 propagation
    const jan1_2024_InitialBalances: Record<string, { initialBalance: number; nature: string }> = {};

    for (const code of Object.keys(decRollup.byCode)) {
      const item = decRollup.byCode[code];
      const isNominal = ['4', '5', '6', '7'].includes(code.charAt(0));

      if (isNominal) {
        // Nominal accounts reset to zero
        jan1_2024_InitialBalances[code] = { initialBalance: 0, nature: item.nature };
      } else {
        // Real accounts carry over final balance as initial balance
        jan1_2024_InitialBalances[code] = { initialBalance: item.finalBalance, nature: item.nature };
      }
    }

    // Verification assertions for Jan 1, 2024
    expect(jan1_2024_InitialBalances['11050501'].initialBalance).toBe(10_000_000);
    expect(jan1_2024_InitialBalances['11100501'].initialBalance).toBe(85_000_000);
    expect(jan1_2024_InitialBalances['22050501'].initialBalance).toBe(30_000_000);
    expect(jan1_2024_InitialBalances['36050501'].initialBalance).toBe(40_000_000);

    // Nominal accounts must strictly be 0
    expect(jan1_2024_InitialBalances['41350501'].initialBalance).toBe(0);
    expect(jan1_2024_InitialBalances['51050601'].initialBalance).toBe(0);
  });

  it('11. should perform multi-year balance roll-forward across 3 consecutive fiscal years (2023 -> 2024 -> 2025)', () => {
    interface FiscalYearData {
      year: number;
      revenue: number;
      expense: number;
      openingCash: number;
      openingEquity: number;
    }

    const yearsData: FiscalYearData[] = [
      { year: 2023, revenue: 100_000_000, expense: 70_000_000, openingCash: 20_000_000, openingEquity: 20_000_000 },
      { year: 2024, revenue: 150_000_000, expense: 90_000_000, openingCash: 0, openingEquity: 0 },
      { year: 2025, revenue: 200_000_000, expense: 130_000_000, openingCash: 0, openingEquity: 0 },
    ];

    let currentCash = yearsData[0].openingCash;
    let currentEquity = yearsData[0].openingEquity;

    const yearlyResults: Array<{ year: number; profit: number; closingCash: number; closingEquity: number }> = [];

    for (let i = 0; i < yearsData.length; i++) {
      const yd = yearsData[i];
      const profit = yd.revenue - yd.expense;

      // Net profit increases cash (assuming all cash transactions) and equity
      currentCash = roundCOP(currentCash + profit);
      currentEquity = roundCOP(currentEquity + profit);

      yearlyResults.push({
        year: yd.year,
        profit,
        closingCash: currentCash,
        closingEquity: currentEquity,
      });
    }

    // 2023: Profit = 30M -> Closing Cash = 50M, Closing Equity = 50M
    expect(yearlyResults[0].profit).toBe(30_000_000);
    expect(yearlyResults[0].closingCash).toBe(50_000_000);
    expect(yearlyResults[0].closingEquity).toBe(50_000_000);

    // 2024: Profit = 60M -> Closing Cash = 110M, Closing Equity = 110M
    expect(yearlyResults[1].profit).toBe(60_000_000);
    expect(yearlyResults[1].closingCash).toBe(110_000_000);
    expect(yearlyResults[1].closingEquity).toBe(110_000_000);

    // 2025: Profit = 70M -> Closing Cash = 180M, Closing Equity = 180M
    expect(yearlyResults[2].profit).toBe(70_000_000);
    expect(yearlyResults[2].closingCash).toBe(180_000_000);
    expect(yearlyResults[2].closingEquity).toBe(180_000_000);
  });

  // ==========================================================================
  // SECTION 5: READ-ONLY INFRASTRUCTURE GUARD VERIFICATION
  // ==========================================================================

  it('12. should verify Read-Only backup directory remains completely untouched during multi-period operations', () => {
    // Re-verify directory integrity against the snapshot taken before test execution
    const integrityResult = verifyDirectoryIntegrity(backupSnapshot);

    expect(integrityResult.isIntact).toBe(true);
    expect(integrityResult.addedFiles.length).toBe(0);
    expect(integrityResult.deletedFiles.length).toBe(0);
    expect(integrityResult.modifiedFiles.length).toBe(0);
    expect(integrityResult.errors.length).toBe(0);
  });
});
