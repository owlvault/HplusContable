import { describe, it, expect } from 'vitest';
import {
  calculateTrialBalance,
  inferAccountMeta,
  getPrefixHierarchy,
  RawJournalLineData,
  TrialBalanceOptions,
} from './trial-balance-calc';

describe('Trial Balance Engine (trial-balance-calc.ts)', () => {
  describe('Helper Functions', () => {
    it('inferAccountMeta should infer nature, type, level and parent code correctly', () => {
      const metaAux = inferAccountMeta('11050501');
      expect(metaAux.level).toBe(5);
      expect(metaAux.nature).toBe('DEBITO');
      expect(metaAux.type).toBe('ACTIVO');
      expect(metaAux.parent_code).toBe('110505');
      expect(metaAux.name).toBe('CUENTA 11050501');

      const metaPasivo = inferAccountMeta('220505');
      expect(metaPasivo.level).toBe(4);
      expect(metaPasivo.nature).toBe('CREDITO');
      expect(metaPasivo.type).toBe('PASIVO');
      expect(metaPasivo.parent_code).toBe('2205');
      expect(metaPasivo.name).toBe('Proveedores Nacionales');
    });

    it('getPrefixHierarchy should extract all 5 parent levels correctly', () => {
      expect(getPrefixHierarchy('11050501')).toEqual(['1', '11', '1105', '110505', '11050501']);
      expect(getPrefixHierarchy('110505')).toEqual(['1', '11', '1105', '110505']);
      expect(getPrefixHierarchy('1105')).toEqual(['1', '11', '1105']);
      expect(getPrefixHierarchy('11')).toEqual(['1', '11']);
      expect(getPrefixHierarchy('1')).toEqual(['1']);
    });
  });

  describe('Account Nature Math & Dual-Bucket Math', () => {
    it('1. should calculate DEBITO nature accounts: Final = Initial + Debit - Credit', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '11050501', entry_date: '2026-02-15', debit: 1_000_000, credit: 200_000 },
        { account_code: '11050501', entry_date: '2026-03-10', debit: 500_000, credit: 100_000 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      const aux = report.items.find((i) => i.code === '11050501');
      expect(aux).toBeDefined();
      expect(aux?.saldo_inicial).toBe(800_000); // 1,000,000 - 200,000
      expect(aux?.debito).toBe(500_000);
      expect(aux?.credito).toBe(100_000);
      expect(aux?.saldo_final).toBe(1_200_000); // 800,000 + 500,000 - 100,000
    });

    it('2. should calculate CREDITO nature accounts: Final = Initial + Credit - Debit', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '22050501', entry_date: '2026-02-10', debit: 100_000, credit: 1_000_000 },
        { account_code: '22050501', entry_date: '2026-03-15', debit: 300_000, credit: 500_000 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      const aux = report.items.find((i) => i.code === '22050501');
      expect(aux).toBeDefined();
      expect(aux?.saldo_inicial).toBe(900_000); // 1,000,000 - 100,000
      expect(aux?.debito).toBe(300_000);
      expect(aux?.credito).toBe(500_000);
      expect(aux?.saldo_final).toBe(1_100_000); // 900,000 + 500,000 - 300,000
    });
  });

  describe('Real vs Nominal Account Initial Balance & Fiscal Year Reset Rules', () => {
    it('3. Real accounts (Classes 1-3) carry cumulative balances across multi-year boundaries', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '11050501', entry_date: '2024-05-10', debit: 5_000_000, credit: 0 },
        { account_code: '11050501', entry_date: '2025-11-20', debit: 3_000_000, credit: 1_000_000 },
        { account_code: '11050501', entry_date: '2026-01-15', debit: 2_000_000, credit: 500_000 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });

      const aux = report.items.find((i) => i.code === '11050501');
      expect(aux?.saldo_inicial).toBe(8_500_000); // (5M) + (3M - 1M) + (2M - 0.5M) = 8.5M
    });

    it('4. Nominal accounts (Classes 4-7) reset initial balance on Jan 1 and carry forward YTD within same fiscal year', () => {
      const lines: RawJournalLineData[] = [
        // Prior fiscal year (2025) movements - should NOT be in 2026 nominal account initial balance
        { account_code: '41350501', entry_date: '2025-12-15', debit: 0, credit: 10_000_000 },
        { account_code: '51050601', entry_date: '2025-12-20', debit: 4_000_000, credit: 0 },

        // Current fiscal year (2026) movements prior to March
        { account_code: '41350501', entry_date: '2026-01-15', debit: 0, credit: 5_000_000 },
        { account_code: '41350501', entry_date: '2026-02-15', debit: 0, credit: 3_000_000 },
        { account_code: '51050601', entry_date: '2026-01-30', debit: 2_000_000, credit: 0 },

        // March movements
        { account_code: '41350501', entry_date: '2026-03-10', debit: 0, credit: 4_000_000 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      const revenue = report.items.find((i) => i.code === '41350501');
      expect(revenue?.saldo_inicial).toBe(8_000_000); // Jan + Feb 2026 (5M + 3M). 2025 10M is reset!
      expect(revenue?.debito).toBe(0);
      expect(revenue?.credito).toBe(4_000_000);
      expect(revenue?.saldo_final).toBe(12_000_000);

      const expense = report.items.find((i) => i.code === '51050601');
      expect(expense?.saldo_inicial).toBe(2_000_000); // Jan 2026 (2M). 2025 4M is reset!
    });

    it('5. Prior years net profit/loss (Income - Expenses) carries forward to Equity 360505 (Utilidad) or 361005 (Pérdida)', () => {
      const lines: RawJournalLineData[] = [
        // 2025 Profit: Revenue 15M, Expenses 9M, Cash 6M -> Net Profit = +6M, fully balanced
        { account_code: '11050501', entry_date: '2025-06-15', debit: 6_000_000, credit: 0 },
        { account_code: '41350501', entry_date: '2025-06-15', debit: 0, credit: 15_000_000 },
        { account_code: '51050601', entry_date: '2025-06-20', debit: 9_000_000, credit: 0 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      // 360505 Utilidad del ejercicio should receive 6M prior net profit carry-forward
      const utilidad = report.items.find((i) => i.code === '360505');
      expect(utilidad).toBeDefined();
      expect(utilidad?.saldo_inicial).toBe(6_000_000);

      // Verify report double-entry balance
      expect(report.totals.is_balanced).toBe(true);
    });
  });

  describe('Dynamic PUC Hierarchy Rollup across 5 Levels', () => {
    it('6. should dynamically synthesize missing parent account rows (L5 -> L4 -> L3 -> L2 -> L1)', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '11050501', entry_date: '2026-03-10', debit: 1_000_000, credit: 0 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      // All 5 levels must exist and have debito = 1,000,000
      const l5 = report.items.find((i) => i.code === '11050501');
      const l4 = report.items.find((i) => i.code === '110505');
      const l3 = report.items.find((i) => i.code === '1105');
      const l2 = report.items.find((i) => i.code === '11');
      const l1 = report.items.find((i) => i.code === '1');

      expect(l5?.level).toBe(5);
      expect(l4?.level).toBe(4);
      expect(l3?.level).toBe(3);
      expect(l2?.level).toBe(2);
      expect(l1?.level).toBe(1);

      expect(l5?.debito).toBe(1_000_000);
      expect(l4?.debito).toBe(1_000_000);
      expect(l3?.debito).toBe(1_000_000);
      expect(l2?.debito).toBe(1_000_000);
      expect(l1?.debito).toBe(1_000_000);

      expect(l4?.is_synthesized).toBe(false); // 110505 in STANDARD_PUC_NAMES
      expect(l1?.name).toBe('ACTIVO');
    });
  });

  describe('Third-Party Breakdown Toggle & Closing Entries Filter', () => {
    it('7. includeThirdParty = true breaks down leaf rows by third_party_id with fallback for unassigned third parties', () => {
      const lines: RawJournalLineData[] = [
        {
          account_code: '13050501',
          entry_date: '2026-03-10',
          debit: 500_000,
          credit: 0,
          third_party_id: 'tp-client-a',
          document_number: '900123456',
          third_party_name: 'CLIENTE A S.A.S.',
        },
        {
          account_code: '13050501',
          entry_date: '2026-03-12',
          debit: 300_000,
          credit: 0,
          third_party_id: null, // Unassigned third party fallback
        },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        includeThirdParty: true,
      });

      // Account summary row for 13050501
      const accountSummary = report.items.find(
        (i) => i.code === '13050501' && !i.third_party_id
      );
      expect(accountSummary).toBeDefined();
      expect(accountSummary?.debito).toBe(800_000);

      // Third party detail row for Client A
      const clientA = report.items.find(
        (i) => i.code === '13050501' && i.third_party_id === 'tp-client-a'
      );
      expect(clientA).toBeDefined();
      expect(clientA?.third_party_name).toBe('CLIENTE A S.A.S.');
      expect(clientA?.debito).toBe(500_000);

      // Third party detail row for unassigned fallback
      const fallback = report.items.find(
        (i) => i.code === '13050501' && i.third_party_id === null && i.document_number === '0'
      );
      expect(fallback).toBeDefined();
      expect(fallback?.third_party_name).toBe('CUANTIAS MENORES / GENERAL');
      expect(fallback?.debito).toBe(300_000);
    });

    it('8. excludeClosingEntries = true filters out CIERRE entries from movements', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '41350501', entry_date: '2026-12-15', debit: 0, credit: 10_000_000, entry_type: null },
        { account_code: '41350501', entry_date: '2026-12-31', debit: 10_000_000, credit: 0, entry_type: 'CIERRE' },
      ];

      // Exclude closing entries (default true)
      const reportPreClose = calculateTrialBalance(lines, {
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        excludeClosingEntries: true,
      });

      const revPre = reportPreClose.items.find((i) => i.code === '41350501');
      expect(revPre?.credito).toBe(10_000_000);
      expect(revPre?.debito).toBe(0);

      // Include closing entries (post-close audit)
      const reportPostClose = calculateTrialBalance(lines, {
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        excludeClosingEntries: false,
      });

      const revPost = reportPostClose.items.find((i) => i.code === '41350501');
      expect(revPost?.debito).toBe(10_000_000);
      expect(revPost?.credito).toBe(10_000_000);
      expect(revPost?.saldo_final).toBe(0);
    });
  });

  describe('Totals & Double-Entry Equality', () => {
    it('9. should report correct totals object and verify is_balanced = true', () => {
      const lines: RawJournalLineData[] = [
        { account_code: '11050501', entry_date: '2026-03-05', debit: 2_000_000, credit: 0 },
        { account_code: '22050501', entry_date: '2026-03-05', debit: 0, credit: 2_000_000 },
      ];

      const report = calculateTrialBalance(lines, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      expect(report.totals.total_debito).toBe(2_000_000);
      expect(report.totals.total_credito).toBe(2_000_000);
      expect(report.totals.saldo_final_debito).toBe(2_000_000);
      expect(report.totals.saldo_final_credito).toBe(2_000_000);
      expect(report.totals.is_balanced).toBe(true);
    });
  });
});
