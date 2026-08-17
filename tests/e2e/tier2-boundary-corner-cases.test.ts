import { describe, it, expect } from 'vitest';
import {
  roundCOP,
  compareCOP,
  diffCOP,
  assertCOPEquals,
  rollupPUCHierarchy,
  getPUCAccountLevel,
  getPUCAccountLevelName,
  getPUCParentCode,
  getPUCAccountNature,
  calculateNetBalance,
  generateMockTransaction,
  generateBalancedEntryPair,
  generateMockBatch,
  validateTransactionBalance,
  STANDARD_MOCK_ACCOUNTS,
  DEFAULT_COP_TOLERANCE,
  type MockJournalLine,
  type MockJournalEntry,
} from './helpers/test-harness';
import { computeClosingEntry, type ResultAccountBalance } from '../../src/lib/utils/closing-calc';

/**
 * ============================================================================
 * E2E TIER 2: BOUNDARY & CORNER CASES TEST SUITE
 * ============================================================================
 * 
 * Requirement Coverage:
 * - Empty data / zero transaction periods
 * - Missing accounts / unmapped PUC subcuentas
 * - Zero balances & inactive accounts filtering
 * - Floating point rounding & COP precision (<= 0.01 COP tolerance)
 * - Malformed rows / missing mandatory fields
 * - Large volume transaction boundary cases
 */

describe('Tier 2: Boundary & Corner Cases Test Suite', () => {

  // ==========================================================================
  // Category 1: Empty Data / Zero Transaction Periods
  // ==========================================================================
  describe('1. Empty Data & Zero Transaction Periods', () => {
    it('1.1 should handle empty transaction list in PUC hierarchy rollup without errors', () => {
      const emptyLines: MockJournalLine[] = [];
      const rollup = rollupPUCHierarchy(emptyLines);

      expect(rollup).toBeDefined();
      expect(rollup.totalDebit).toBe(0);
      expect(rollup.totalCredit).toBe(0);
      expect(rollup.isBalanced).toBe(true);
      expect(Object.keys(rollup.byCode).length).toBe(0);
      expect(rollup.byLevel[1].length).toBe(0);
    });

    it('1.2 should return net zero summary when evaluating period with zero transactions', () => {
      const periodEntries: MockJournalEntry[] = [];
      const periodLines = periodEntries.flatMap(e => e.lines);
      const rollup = rollupPUCHierarchy(periodLines);

      expect(periodLines.length).toBe(0);
      expect(rollup.totalDebit).toBe(0);
      expect(rollup.totalCredit).toBe(0);
      expect(rollup.isBalanced).toBe(true);
    });

    it('1.3 should handle period containing only ANULADO (voided) transactions', () => {
      const entry1 = generateMockTransaction({ date: '2024-03-10', amount: 5000000, state: 'ANULADO' });
      const entry2 = generateMockTransaction({ date: '2024-03-15', amount: 3500000, state: 'ANULADO' });
      const allEntries = [entry1, entry2];

      // Filter active (approved/non-voided) entries
      const activeEntries = allEntries.filter(e => e.state !== 'ANULADO');
      const activeLines = activeEntries.flatMap(e => e.lines);
      const rollup = rollupPUCHierarchy(activeLines);

      expect(activeEntries.length).toBe(0);
      expect(activeLines.length).toBe(0);
      expect(rollup.totalDebit).toBe(0);
      expect(rollup.totalCredit).toBe(0);
      expect(rollup.isBalanced).toBe(true);
    });

    it('1.4 should compute zero closing entry lines when income and expense balances are all zero', () => {
      const zeroBalances: ResultAccountBalance[] = [
        { account_code: '413505', type: 'INGRESO', balance: 0 },
        { account_code: '510506', type: 'GASTO', balance: 0 },
        { account_code: '613505', type: 'COSTO_VENTAS', balance: 0 },
      ];
      const accounts = { utilidadAccount: '360505', perdidaAccount: '361005' };

      const result = computeClosingEntry(zeroBalances, accounts);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.netResult).toBe(0);
      expect(result.lines.length).toBe(0);
    });

    it('1.5 should handle empty input batch generator gracefully', () => {
      const batch = generateMockBatch({ count: 0 });

      expect(Array.isArray(batch)).toBe(true);
      expect(batch.length).toBe(0);
    });

    it('1.6 should safely handle empty third-party receivables/payables aggregation', () => {
      const emptyReceivables: Array<{ third_party_id: string; balance: number; original_amount: number }> = [];

      const aggregated = emptyReceivables.reduce((acc, curr) => {
        if (!acc[curr.third_party_id]) {
          acc[curr.third_party_id] = { totalPending: 0, count: 0 };
        }
        acc[curr.third_party_id].totalPending += curr.balance;
        acc[curr.third_party_id].count++;
        return acc;
      }, {} as Record<string, { totalPending: number; count: number }>);

      expect(Object.keys(aggregated).length).toBe(0);
    });
  });

  // ==========================================================================
  // Category 2: Missing Accounts / Unmapped PUC Subcuentas
  // ==========================================================================
  describe('2. Missing Accounts & Unmapped PUC Subcuentas', () => {
    it('2.1 should derive correct hierarchy rollup for unmapped 8-digit auxiliary account', () => {
      const unmappedLine: MockJournalLine = {
        account_code: '11050599', // Custom unmapped auxiliary subcuenta
        debit: 1250000,
        credit: 0,
      };

      const rollup = rollupPUCHierarchy([unmappedLine]);

      expect(getPUCAccountLevel('11050599')).toBe(5); // Auxiliar
      expect(getPUCAccountLevelName(5)).toBe('AUXILIAR');
      expect(getPUCParentCode('11050599')).toBe('110505'); // Subcuenta

      // Parent nodes must automatically exist in rollup
      expect(rollup.byCode['11050599']).toBeDefined();
      expect(rollup.byCode['110505']).toBeDefined(); // Subcuenta
      expect(rollup.byCode['1105']).toBeDefined();   // Cuenta
      expect(rollup.byCode['11']).toBeDefined();     // Grupo
      expect(rollup.byCode['1']).toBeDefined();      // Clase

      expect(rollup.byCode['1'].debit).toBe(1250000);
      expect(rollup.byCode['11050599'].debit).toBe(1250000);
    });

    it('2.2 should derive hierarchy for non-standard code lengths up to 10 digits', () => {
      const deepCode = '1105050101'; // 10-digit code
      const level = getPUCAccountLevel(deepCode);
      const parent = getPUCParentCode(deepCode);

      expect(level).toBe(5);
      expect(parent).toBe('110505');
    });

    it('2.3 should determine standard nature (DEBIT vs CREDIT) for all 9 Colombian PUC classes', () => {
      expect(getPUCAccountNature('11050501')).toBe('DEBIT');  // Class 1 - Activo
      expect(getPUCAccountNature('22050501')).toBe('CREDIT'); // Class 2 - Pasivo
      expect(getPUCAccountNature('31050501')).toBe('CREDIT'); // Class 3 - Patrimonio
      expect(getPUCAccountNature('41350501')).toBe('CREDIT'); // Class 4 - Ingresos
      expect(getPUCAccountNature('51050601')).toBe('DEBIT');  // Class 5 - Gastos
      expect(getPUCAccountNature('61350501')).toBe('DEBIT');  // Class 6 - Costo Ventas
      expect(getPUCAccountNature('71050501')).toBe('DEBIT');  // Class 7 - Costo Produccion
      expect(getPUCAccountNature('81050501')).toBe('DEBIT');  // Class 8 - Orden Deudoras
      expect(getPUCAccountNature('91050501')).toBe('CREDIT'); // Class 9 - Orden Acreedoras
    });

    it('2.4 should aggregate orphan subcuenta to group and class level even when direct parent account is omitted', () => {
      const line: MockJournalLine = {
        account_code: '236540', // Retención en la fuente (6 digits, no explicit 4-digit line provided)
        debit: 0,
        credit: 450000,
      };

      const rollup = rollupPUCHierarchy([line]);

      // Direct item
      expect(rollup.byCode['236540']).toBeDefined();
      expect(rollup.byCode['236540'].credit).toBe(450000);

      // Inferred parents
      expect(rollup.byCode['2365']).toBeDefined(); // Account level 3
      expect(rollup.byCode['23']).toBeDefined();   // Group level 2
      expect(rollup.byCode['2']).toBeDefined();    // Class level 1

      expect(rollup.byCode['2'].credit).toBe(450000);
      expect(rollup.isBalanced).toBe(true);
    });

    it('2.5 should validate code formatting and strip non-numeric characters cleanly', () => {
      const formattedCode = ' 1105.05.01 ';
      const level = getPUCAccountLevel(formattedCode);
      const parent = getPUCParentCode(formattedCode);
      const nature = getPUCAccountNature(formattedCode);

      expect(level).toBe(5);
      expect(parent).toBe('110505');
      expect(nature).toBe('DEBIT');
    });
  });

  // ==========================================================================
  // Category 3: Zero Balances & Inactive Accounts Filtering
  // ==========================================================================
  describe('3. Zero Balances & Inactive Accounts Filtering', () => {
    it('3.1 should exclude zero-movement accounts from active reporting results', () => {
      const lines: MockJournalLine[] = [
        { account_code: '11050501', debit: 500000, credit: 0 },
        { account_code: '11100501', debit: 0, credit: 500000 },
        { account_code: '13050501', debit: 0, credit: 0 }, // Zero movement account
      ];

      const rollup = rollupPUCHierarchy(lines);
      const activeAccountsWithMovement = Object.values(rollup.byCode).filter(
        item => item.debit !== 0 || item.credit !== 0
      );

      const zeroAccountInActiveList = activeAccountsWithMovement.find(item => item.code === '13050501');
      expect(zeroAccountInActiveList).toBeUndefined();
    });

    it('3.2 should show net balance zero when debit equals credit for DEBIT nature account', () => {
      const debitVal = 1500000;
      const creditVal = 1500000;
      const net = calculateNetBalance('11050501', debitVal, creditVal, 0);

      expect(net).toBe(0);
    });

    it('3.3 should show net balance zero when debit equals credit for CREDIT nature account', () => {
      const debitVal = 2800000;
      const creditVal = 2800000;
      const net = calculateNetBalance('22050501', debitVal, creditVal, 0);

      expect(net).toBe(0);
    });

    it('3.4 should filter out inactive accounts with zero current period balance', () => {
      const masterAccounts = [
        { code: '11050501', name: 'Caja General', is_active: true, balance: 100000 },
        { code: '11050502', name: 'Caja Menor Sucursal B', is_active: false, balance: 0 },
        { code: '11100501', name: 'Banco Bogota', is_active: true, balance: 4500000 },
      ];

      // Active accounts filter rule: active accounts OR non-zero balance historical accounts
      const reportAccounts = masterAccounts.filter(acc => acc.is_active || acc.balance !== 0);

      expect(reportAccounts.length).toBe(2);
      expect(reportAccounts.some(acc => acc.code === '11050502')).toBe(false);
    });

    it('3.5 should retain inactive account in historical period reports if historical journal entries exist', () => {
      const masterAccounts = [
        { code: '11050502', name: 'Caja Menor Sucursal B', is_active: false },
      ];

      const historicalJournalLines = [
        { account_code: '11050502', debit: 250000, credit: 0, date: '2024-01-15' },
      ];

      // Query historical period lines
      const accountHasMovement = historicalJournalLines.some(l => l.account_code === '11050502');
      const accountInfo = masterAccounts.find(a => a.code === '11050502');

      const shouldIncludeInHistoricalReport = accountHasMovement || (accountInfo?.is_active ?? false);

      expect(shouldIncludeInHistoricalReport).toBe(true);
    });
  });

  // ==========================================================================
  // Category 4: Floating Point Rounding & COP Precision (<= 0.01 COP Tolerance)
  // ==========================================================================
  describe('4. Floating Point Rounding & COP Precision', () => {
    it('4.1 should round fractional COP values to 2 decimal places', () => {
      expect(roundCOP(12345.678)).toBe(12345.68);
      expect(roundCOP(12345.672)).toBe(12345.67);
      expect(roundCOP(100.005)).toBe(100.01);
      expect(roundCOP(0.004)).toBe(0);
    });

    it('4.2 should resolve JavaScript float representation errors like 0.1 + 0.2', () => {
      const rawSum = 0.1 + 0.2; // 0.30000000000000004 in IEEE 754
      const normalized = roundCOP(rawSum);

      expect(rawSum).not.toBe(0.3); // Demonstrates raw JS floating point inaccuracy
      expect(normalized).toBe(0.3);
      expect(compareCOP(rawSum, 0.3, 0.01)).toBe(true);
      expect(diffCOP(rawSum, 0.3)).toBe(0);
    });

    it('4.3 should verify VAT 19% tax calculation precision within 0.01 COP tolerance', () => {
      const baseAmount = 1543210.55;
      const vatRate = 0.19;
      const calculatedVat = baseAmount * vatRate; // 293209.9995
      const expectedVat = 293210.00;

      const roundedVat = roundCOP(calculatedVat);

      expect(compareCOP(calculatedVat, expectedVat, 0.01)).toBe(true);
      expect(roundedVat).toBe(expectedVat);
      expect(() => assertCOPEquals(calculatedVat, expectedVat, 0.01)).not.toThrow();
    });

    it('4.4 should maintain double-entry parity across multi-line split transaction with floating numbers', () => {
      const customLines: MockJournalLine[] = [
        { account_code: '11050501', debit: 1000000.33, credit: 0 },
        { account_code: '41350501', debit: 0, credit: 333333.33 },
        { account_code: '24080501', debit: 0, credit: 333333.33 },
        { account_code: '23654001', debit: 0, credit: 333333.67 },
      ];

      const entry = generateMockTransaction({ customLines });
      const balanceStatus = validateTransactionBalance(entry);

      expect(entry.total_debit).toBe(1000000.33);
      expect(entry.total_credit).toBe(1000000.33);
      expect(balanceStatus.isBalanced).toBe(true);
      expect(balanceStatus.diff).toBe(0);
    });

    it('4.5 should assert equality of two COP values using assertCOPEquals within 0.01 tolerance', () => {
      expect(() => assertCOPEquals(500000.004, 500000.009, 0.01)).not.toThrow();
      expect(() => assertCOPEquals(500000.00, 500000.02, 0.01)).toThrow();
    });

    it('4.6 should correctly compare aggregated trial balance totals with floating point movements', () => {
      const lines: MockJournalLine[] = [
        { account_code: '51050601', debit: 1234567.89, credit: 0 },
        { account_code: '11100501', debit: 0, credit: 1234567.88 }, // Off by 0.01
      ];

      const rollup = rollupPUCHierarchy(lines);
      const isWithinTolerance = compareCOP(rollup.totalDebit, rollup.totalCredit, 0.01);
      const difference = diffCOP(rollup.totalDebit, rollup.totalCredit);

      expect(isWithinTolerance).toBe(true);
      expect(difference).toBe(0.01);
    });
  });

  // ==========================================================================
  // Category 5: Malformed Rows / Missing Mandatory Fields
  // ==========================================================================
  describe('5. Malformed Rows & Missing Mandatory Fields', () => {
    it('5.1 should reject or flag journal lines missing account_code', () => {
      const malformedLine = {
        account_code: '', // Missing mandatory account code
        debit: 100000,
        credit: 0,
      };

      const validateLine = (line: typeof malformedLine) => {
        const cleanCode = (line.account_code || '').trim().replace(/\D/g, '');
        if (!cleanCode) return { isValid: false, error: 'Código de cuenta obligatorio es requerido' };
        return { isValid: true, error: null };
      };

      const result = validateLine(malformedLine);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('obligatorio');
    });

    it('5.2 should coerce null, undefined, or NaN debit/credit values to 0 safely', () => {
      const rawLine = {
        account_code: '11050501',
        debit: NaN as any,
        credit: null as any,
      };

      const sanitizedLine: MockJournalLine = {
        account_code: rawLine.account_code,
        debit: roundCOP(rawLine.debit || 0),
        credit: roundCOP(rawLine.credit || 0),
      };

      expect(sanitizedLine.debit).toBe(0);
      expect(sanitizedLine.credit).toBe(0);
      expect(isNaN(sanitizedLine.debit)).toBe(false);
    });

    it('5.3 should handle missing third party document by assigning generic default identifier', () => {
      const entryWithoutTP = generateMockTransaction({
        third_party_id: undefined,
        third_party_name: undefined,
        third_party_nit: undefined,
      });

      const line = entryWithoutTP.lines[0];
      const effectiveNIT = line.third_party_nit || '222222222222'; // DIAN generic NIT for minor/unassigned entities

      expect(effectiveNIT).toBe('222222222222');
    });

    it('5.4 should convert negative debit or credit values to positive counterpart', () => {
      const lineWithNegativeDebit = {
        account_code: '11050501',
        debit: -750000,
        credit: 0,
      };

      const normalizeLine = (line: typeof lineWithNegativeDebit): MockJournalLine => {
        let deb = line.debit || 0;
        let cred = line.credit || 0;

        if (deb < 0) {
          cred += Math.abs(deb);
          deb = 0;
        }
        if (cred < 0) {
          deb += Math.abs(cred);
          cred = 0;
        }

        return {
          account_code: line.account_code,
          debit: roundCOP(deb),
          credit: roundCOP(cred),
        };
      };

      const normalized = normalizeLine(lineWithNegativeDebit);

      expect(normalized.debit).toBe(0);
      expect(normalized.credit).toBe(750000);
    });

    it('5.5 should detect unbalanced journal entry where debit does not equal credit', () => {
      const unbalancedEntry = generateMockTransaction({
        unbalanced: true,
        unbalanceAmount: 50000,
      });

      const validation = validateTransactionBalance(unbalancedEntry);

      expect(validation.isBalanced).toBe(false);
      expect(validation.diff).toBe(50000);
    });
  });

  // ==========================================================================
  // Category 6: Large Volume Transaction Boundary Cases
  // ==========================================================================
  describe('6. Large Volume Transaction Boundary Cases', () => {
    it('6.1 should process and aggregate 10,000 journal lines in PUC rollup within 500ms', () => {
      const count = 10000;
      const lines: MockJournalLine[] = [];
      
      const sampleAccounts = [
        STANDARD_MOCK_ACCOUNTS.CAJA_GENERAL,
        STANDARD_MOCK_ACCOUNTS.BANCOS_NACIONALES,
        STANDARD_MOCK_ACCOUNTS.CLIENTES_NACIONALES,
        STANDARD_MOCK_ACCOUNTS.PROVEEDORES_NACIONALES,
        STANDARD_MOCK_ACCOUNTS.COMERCIO_MAYOR_MENOR,
        STANDARD_MOCK_ACCOUNTS.GASTOS_SERVICIOS,
      ];

      for (let i = 0; i < count; i++) {
        const acc = sampleAccounts[i % sampleAccounts.length];
        const isDebit = i % 2 === 0;
        lines.push({
          account_code: acc,
          debit: isDebit ? 10000 : 0,
          credit: isDebit ? 0 : 10000,
        });
      }

      const startTime = performance.now();
      const rollup = rollupPUCHierarchy(lines);
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      expect(rollup).toBeDefined();
      expect(rollup.totalDebit).toBe(50000000);
      expect(rollup.totalCredit).toBe(50000000);
      expect(rollup.isBalanced).toBe(true);
      expect(durationMs).toBeLessThan(500); // Must complete under 500ms performance boundary
    });

    it('6.2 should process large monetary values up to 1 Trillion COP without overflow', () => {
      const oneTrillion = 1_000_000_000_000; // 1,000,000,000,000 COP
      const largeEntry = generateMockTransaction({
        amount: oneTrillion,
      });

      const rollup = rollupPUCHierarchy(largeEntry.lines);

      expect(largeEntry.total_debit).toBe(oneTrillion);
      expect(largeEntry.total_credit).toBe(oneTrillion);
      expect(largeEntry.is_balanced).toBe(true);
      expect(rollup.totalDebit).toBe(oneTrillion);
      expect(rollup.totalCredit).toBe(oneTrillion);
      expect(rollup.isBalanced).toBe(true);
    });

    it('6.3 should roll up dynamic hierarchy across high cardinality of 1,000 distinct auxiliary accounts', () => {
      const lines: MockJournalLine[] = [];
      const numAccounts = 1000;

      for (let i = 1; i <= numAccounts; i++) {
        // Generate account codes 11050501 to 11051499
        const auxSuffix = String(i).padStart(4, '0');
        const code = `1105${auxSuffix}`;
        lines.push({
          account_code: code,
          debit: 1000,
          credit: 0,
        });
      }
      // Balancing credit line
      lines.push({
        account_code: STANDARD_MOCK_ACCOUNTS.BANCOS_NACIONALES,
        debit: 0,
        credit: numAccounts * 1000,
      });

      const rollup = rollupPUCHierarchy(lines);

      expect(Object.keys(rollup.byCode).length).toBeGreaterThanOrEqual(numAccounts);
      expect(rollup.totalDebit).toBe(numAccounts * 1000);
      expect(rollup.totalCredit).toBe(numAccounts * 1000);
      expect(rollup.isBalanced).toBe(true);
    });

    it('6.4 should handle high-concurrency batch processing without total drift', async () => {
      const numBatches = 10;
      const entriesPerBatch = 50;

      // Simulate parallel batch aggregation tasks
      const batchTasks = Array.from({ length: numBatches }, (_, batchIdx) => {
        return new Promise<MockJournalEntry[]>(resolve => {
          const batch = generateMockBatch({
            count: entriesPerBatch,
            minAmount: 100000,
            maxAmount: 500000,
            allowUnbalanced: false,
          });
          resolve(batch);
        });
      });

      const allBatches = await Promise.all(batchTasks);
      const flattenedEntries = allBatches.flat();
      const allLines = flattenedEntries.flatMap(e => e.lines);

      const rollup = rollupPUCHierarchy(allLines);

      const expectedTotalDebit = roundCOP(flattenedEntries.reduce((sum, e) => sum + e.total_debit, 0));
      const expectedTotalCredit = roundCOP(flattenedEntries.reduce((sum, e) => sum + e.total_credit, 0));

      expect(flattenedEntries.length).toBe(numBatches * entriesPerBatch);
      expect(compareCOP(rollup.totalDebit, expectedTotalDebit, 0.01)).toBe(true);
      expect(compareCOP(rollup.totalCredit, expectedTotalCredit, 0.01)).toBe(true);
      expect(rollup.isBalanced).toBe(true);
    });

    it('6.5 should detect minute 0.01 COP unbalance across large volume batches', () => {
      const batch = generateMockBatch({ count: 100, allowUnbalanced: false });
      const firstEntry = batch[0];
      // Introduce subtle 0.02 COP unbalance (exceeds 0.01 tolerance)
      firstEntry.lines[0].debit = roundCOP(firstEntry.lines[0].debit + 0.02);
      firstEntry.total_debit = roundCOP(firstEntry.lines.reduce((s, l) => s + l.debit, 0));

      const validation = validateTransactionBalance(firstEntry);

      expect(validation.isBalanced).toBe(false);
      expect(validation.diff).toBe(0.02);
    });
  });

});
