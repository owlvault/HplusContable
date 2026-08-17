import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  DEFAULT_BACKUP_DIR,
  readBackupFileBuffer,
  withReadOnlyGuard,
  verifyBackupUnchanged,
  PathTraversalError,
  validateBackupPath,
} from '../../src/lib/ingestion/readonly-guard';
import { TrialBalanceItem, TrialBalanceReport } from '../../src/lib/utils/trial-balance-calc';
import {
  parseBenchmarkTrialBalanceBuffer,
  parseBenchmarkTrialBalance,
  compareTrialBalances,
  normalizeAccountCode,
  normalizeDocumentNumber,
  buildCompositeKey,
  BenchmarkTrialBalanceRow,
  ComparisonResult,
} from '../../src/lib/verification/trial-balance-comparator';
import { runVerification } from '../../scripts/verify-trial-balance-backup';

describe('Trial Balance Comparator & Read-Only Safety Suite (Milestone 3)', () => {
  const backupDir = process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;

  describe('1. Read-Only Infrastructure Guard', () => {
    it('should safely read a backup file into Buffer without modifying mtime or size', async () => {
      if (!fs.existsSync(backupDir)) return;
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.xlsx'));
      if (files.length === 0) return;

      const targetFile = path.join(backupDir, files[0]);
      const statBefore = fs.statSync(targetFile);

      const buffer = readBackupFileBuffer(targetFile, backupDir);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBe(statBefore.size);

      const statAfter = fs.statSync(targetFile);
      expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
      expect(statAfter.size).toBe(statBefore.size);
    });

    it('should verify that directory remains unchanged before and after operations', () => {
      if (!fs.existsSync(backupDir)) return;

      const snapshot = new Map<string, { mtimeMs: number; size: number }>();
      const entries = fs.readdirSync(backupDir, { recursive: true });
      for (const entry of entries) {
        const fullPath = path.join(backupDir, entry.toString());
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const stat = fs.statSync(fullPath);
          snapshot.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size });
        }
      }

      const check = verifyBackupUnchanged(backupDir, snapshot);
      expect(check.passed).toBe(true);
      expect(check.mutatedFiles.length).toBe(0);
    });

    it('should throw PathTraversalError when attempting to access files outside backup directory', () => {
      expect(() => {
        validateBackupPath('../../../Windows/System32/drivers/etc/hosts', backupDir);
      }).toThrow(PathTraversalError);
    });
  });

  describe('2. Account Code & Document Normalization Rules', () => {
    it('should normalize account codes cleanly', () => {
      expect(normalizeAccountCode(' 110505 ')).toBe('110505');
      expect(normalizeAccountCode('1305 05')).toBe('130505');
      expect(normalizeAccountCode('22050501')).toBe('22050501');
    });

    it('should normalize document numbers (NITs) stripping formatting characters', () => {
      expect(normalizeDocumentNumber('900.123.456-1')).toBe('9001234561');
      expect(normalizeDocumentNumber('890.903.938 - 8')).toBe('8909039388');
      expect(normalizeDocumentNumber('0')).toBe('0');
      expect(normalizeDocumentNumber(null)).toBe('0');
      expect(normalizeDocumentNumber('GENERAL')).toBe('0');
      expect(normalizeDocumentNumber('CUANTIAS MENORES')).toBe('0');
    });

    it('should build composite keys accurately for summary vs detail rows', () => {
      expect(buildCompositeKey('110505', null)).toBe('ACC::110505');
      expect(buildCompositeKey('110505', '0')).toBe('ACC::110505');
      expect(buildCompositeKey('130505', '900.123.456-1')).toBe('TP::130505::9001234561');
      expect(buildCompositeKey('130505', '9001234561', true)).toBe('TP::130505::9001234561');
    });
  });

  describe('3. Benchmark Excel Parser', () => {
    it('should parse synthetic Excel buffer into BenchmarkTrialBalanceRow[]', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('BALANCE DE PRUEBA');

      sheet.addRow(['EMPRESA PRINCIPAL H PLUS S.A.S.']);
      sheet.addRow(['NIT: 900.123.456-1']);
      sheet.addRow(['BALANCE DE PRUEBA POR TERCERO']);
      sheet.addRow([]);
      sheet.addRow(['Código', 'Nombre Cuenta', 'Identificación', 'Saldo Inicial', 'Débitos', 'Créditos', 'Saldo Final']);
      sheet.addRow(['1', 'ACTIVO', '', 30000000.0, 225000000.0, 207000000.0, 48000000.0]);
      sheet.addRow(['110505', 'Caja General', '', 5000000.0, 45000000.0, 42000000.0, 8000000.0]);
      sheet.addRow(['11050501', 'Caja General Nacional', '900123456-1', 5000000.0, 45000000.0, 42000000.0, 8000000.0]);

      const buffer = (await workbook.xlsx.writeBuffer()) as Buffer;
      const parsed = await parseBenchmarkTrialBalanceBuffer(buffer, 'synthetic-test.xlsx');

      expect(parsed).toBeDefined();
      expect(parsed.rows.length).toBe(3);

      const summaryRow = parsed.rows.find((r) => r.account_code === '110505');
      expect(summaryRow).toBeDefined();
      expect(summaryRow?.saldo_inicial).toBe(5000000.0);
      expect(summaryRow?.debito).toBe(45000000.0);
      expect(summaryRow?.credito).toBe(42000000.0);
      expect(summaryRow?.saldo_final).toBe(8000000.0);

      const detailRow = parsed.rows.find((r) => r.account_code === '11050501');
      expect(detailRow).toBeDefined();
      expect(detailRow?.is_third_party_detail).toBe(true);
      expect(detailRow?.document_number).toBe('900123456-1');
    });
  });

  describe('4. Floating-Point Numerical Tolerance Assertions (<= 0.01 COP)', () => {
    const createBenchmarkFixture = (init = 100, deb = 50, cred = 30, final = 120): BenchmarkTrialBalanceRow[] => [
      {
        account_code: '110505',
        account_name: 'Caja General',
        saldo_inicial: init,
        debito: deb,
        credito: cred,
        saldo_final: final,
        level: 4,
      },
    ];

    const createGeneratedFixture = (init = 100, deb = 50, cred = 30, final = 120): TrialBalanceItem[] => [
      {
        code: '110505',
        name: 'Caja General',
        level: 4,
        nature: 'DEBITO',
        type: 'ACTIVO',
        parent_code: '1105',
        saldo_inicial: init,
        debito: deb,
        credito: cred,
        saldo_final: final,
        debit: deb,
        credit: cred,
        balance: final,
      },
    ];

    it('should pass exact matches (delta = 0.00 COP)', () => {
      const bench = createBenchmarkFixture(100.0, 50.0, 30.0, 120.0);
      const gen = createGeneratedFixture(100.0, 50.0, 30.0, 120.0);

      const res = compareTrialBalances(gen, bench, { tolerance: 0.01 });
      expect(res.passed).toBe(true);
      expect(res.stats.exact_matches).toBe(1);
      expect(res.stats.tolerance_matches).toBe(0);
      expect(res.stats.total_discrepancies).toBe(0);
    });

    it('should pass differences within tolerance (delta = 0.005 COP)', () => {
      const bench = createBenchmarkFixture(100.0, 50.0, 30.0, 120.0);
      const gen = createGeneratedFixture(100.005, 50.004, 30.0, 120.005);

      const res = compareTrialBalances(gen, bench, { tolerance: 0.01 });
      expect(res.passed).toBe(true);
      expect(res.stats.tolerance_matches).toBe(1);
      expect(res.stats.total_discrepancies).toBe(0);
    });

    it('should pass boundary float differences equal to tolerance (delta = 0.010 COP)', () => {
      const bench = createBenchmarkFixture(100.0, 50.0, 30.0, 120.0);
      const gen = createGeneratedFixture(100.01, 50.01, 30.01, 120.01);

      const res = compareTrialBalances(gen, bench, { tolerance: 0.01 });
      expect(res.passed).toBe(true);
      expect(res.stats.tolerance_matches).toBe(1);
      expect(res.stats.total_discrepancies).toBe(0);
    });

    it('should flag float differences exceeding tolerance (delta = 0.011 COP or 0.02 COP)', () => {
      const bench = createBenchmarkFixture(100.0, 50.0, 30.0, 120.0);
      const gen = createGeneratedFixture(100.02, 50.0, 30.0, 120.02);

      const res = compareTrialBalances(gen, bench, { tolerance: 0.01 });
      expect(res.passed).toBe(false);
      expect(res.stats.mismatched_rows).toBe(1);
      expect(res.stats.total_discrepancies).toBe(1);
      expect(res.discrepancies[0].type).toBe('SALDO_INICIAL_MISMATCH');
    });
  });

  describe('5. Missing & Unexpected Account Handling', () => {
    it('should flag MISSING_IN_GENERATED when benchmark account is missing', () => {
      const bench: BenchmarkTrialBalanceRow[] = [
        {
          account_code: '110505',
          account_name: 'Caja General',
          saldo_inicial: 100,
          debito: 50,
          credito: 0,
          saldo_final: 150,
        },
      ];
      const gen: TrialBalanceItem[] = [];

      const res = compareTrialBalances(gen, bench);
      expect(res.passed).toBe(false);
      expect(res.stats.missing_in_generated).toBe(1);
      expect(res.discrepancies[0].type).toBe('MISSING_IN_GENERATED');
    });

    it('should flag UNEXPECTED_IN_GENERATED when generated account is extra and non-zero', () => {
      const bench: BenchmarkTrialBalanceRow[] = [];
      const gen: TrialBalanceItem[] = [
        {
          code: '110505',
          name: 'Caja General',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1105',
          saldo_inicial: 100,
          debito: 50,
          credito: 0,
          saldo_final: 150,
          debit: 50,
          credit: 0,
          balance: 150,
        },
      ];

      const res = compareTrialBalances(gen, bench);
      expect(res.passed).toBe(false);
      expect(res.stats.unexpected_in_generated).toBe(1);
      expect(res.discrepancies[0].type).toBe('UNEXPECTED_IN_GENERATED');
    });

    it('should ignore unexpected 0-balance generated accounts when option is enabled', () => {
      const bench: BenchmarkTrialBalanceRow[] = [];
      const gen: TrialBalanceItem[] = [
        {
          code: '110505',
          name: 'Caja General Inactiva',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1105',
          saldo_inicial: 0,
          debito: 0,
          credito: 0,
          saldo_final: 0,
          debit: 0,
          credit: 0,
          balance: 0,
        },
      ];

      const res = compareTrialBalances(gen, bench, { ignoreZeroBalanceUnmatched: true });
      expect(res.passed).toBe(true);
      expect(res.stats.total_discrepancies).toBe(0);
    });
  });

  describe('6. Programmatic Verification Runner (End-to-End Real Backup Execution)', () => {
    it('should execute runVerification on target year 2024 backup files with clean pass and zero mutations', async () => {
      if (!fs.existsSync(backupDir)) return;

      const res = await runVerification({
        year: 2024,
        backupDir,
        tolerance: 0.01,
        detailed: true,
      });

      expect(res.readOnlyPassed).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.comparisonResult).toBeDefined();
      expect(res.comparisonResult?.passed).toBe(true);
      expect(res.comparisonResult?.stats.total_discrepancies).toBe(0);
      expect(res.passed).toBe(true);
    });
  });

  describe('7. Adversarial Remediation Test Suite (Iteration 2)', () => {
    it('Task 1: should resolve composite key collisions for generic third parties using third party name', () => {
      const key1 = buildCompositeKey('130505', 'GENERAL', true, 'Cliente Alpha');
      const key2 = buildCompositeKey('130505', 'GENERAL', true, 'Cliente Beta');
      expect(key1).toBe('TP::130505::0::CLIENTEALPHA');
      expect(key2).toBe('TP::130505::0::CLIENTEBETA');
      expect(key1).not.toBe(key2);

      const bench: BenchmarkTrialBalanceRow[] = [
        {
          account_code: '130505',
          account_name: 'Clientes Nacionales',
          document_number: 'GENERAL',
          third_party_name: 'Cliente Alpha',
          saldo_inicial: 0,
          debito: 500,
          credito: 0,
          saldo_final: 500,
          is_third_party_detail: true,
        },
        {
          account_code: '130505',
          account_name: 'Clientes Nacionales',
          document_number: 'GENERAL',
          third_party_name: 'Cliente Beta',
          saldo_inicial: 0,
          debito: 800,
          credito: 0,
          saldo_final: 800,
          is_third_party_detail: true,
        },
      ];

      const gen: TrialBalanceItem[] = [
        {
          code: '130505',
          name: 'Clientes Nacionales',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1305',
          document_number: 'GENERAL',
          third_party_name: 'Cliente Alpha',
          third_party_id: '0',
          saldo_inicial: 0,
          debito: 500,
          credito: 0,
          saldo_final: 500,
          debit: 500,
          credit: 0,
          balance: 500,
        },
        {
          code: '130505',
          name: 'Clientes Nacionales',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1305',
          document_number: 'GENERAL',
          third_party_name: 'Cliente Beta',
          third_party_id: '0',
          saldo_inicial: 0,
          debito: 800,
          credito: 0,
          saldo_final: 800,
          debit: 800,
          credit: 0,
          balance: 800,
        },
      ];

      const res = compareTrialBalances(gen, bench, { compareThirdPartyDetails: true });
      expect(res.stats.total_benchmark_rows).toBe(2);
      expect(res.stats.total_generated_rows).toBe(2);
      expect(res.stats.matched_keys).toBe(2);
      expect(res.stats.total_discrepancies).toBe(0);
      expect(res.passed).toBe(true);
    });

    it('Task 2: should normalize formatted account codes with dots/dashes consistently', () => {
      expect(normalizeAccountCode('1105.05')).toBe('110505');
      expect(normalizeAccountCode('1305-05-01')).toBe('13050501');

      const bench: BenchmarkTrialBalanceRow[] = [
        {
          account_code: '1105.05',
          account_name: 'Caja General',
          saldo_inicial: 100,
          debito: 50,
          credito: 0,
          saldo_final: 150,
        },
      ];

      const gen: TrialBalanceItem[] = [
        {
          code: '110505',
          name: 'Caja General',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1105',
          saldo_inicial: 100,
          debito: 50,
          credito: 0,
          saldo_final: 150,
          debit: 50,
          credit: 0,
          balance: 150,
        },
      ];

      const res = compareTrialBalances(gen, bench);
      expect(res.passed).toBe(true);
      expect(res.stats.matched_keys).toBe(1);
      expect(res.stats.total_discrepancies).toBe(0);
    });

    it('Task 3: should symmetrically filter zero-balance inactive benchmark accounts', () => {
      const bench: BenchmarkTrialBalanceRow[] = [
        {
          account_code: '999999',
          account_name: 'Cuenta Inactiva Histórica',
          saldo_inicial: 0,
          debito: 0,
          credito: 0,
          saldo_final: 0,
        },
      ];

      const gen: TrialBalanceItem[] = [];

      const resWithFilter = compareTrialBalances(gen, bench, { ignoreZeroBalanceUnmatched: true });
      expect(resWithFilter.passed).toBe(true);
      expect(resWithFilter.stats.missing_in_generated).toBe(0);
      expect(resWithFilter.stats.total_discrepancies).toBe(0);

      const resWithoutFilter = compareTrialBalances(gen, bench, { ignoreZeroBalanceUnmatched: false });
      expect(resWithoutFilter.passed).toBe(false);
      expect(resWithoutFilter.stats.missing_in_generated).toBe(1);
      expect(resWithoutFilter.discrepancies[0].type).toBe('MISSING_IN_GENERATED');
    });

    it('Task 4: should preserve multi-field diff details and prevent discrepancy taxonomy overwriting', () => {
      const bench: BenchmarkTrialBalanceRow[] = [
        {
          account_code: '110505',
          account_name: 'Caja General',
          saldo_inicial: 1000,
          debito: 500,
          credito: 200,
          saldo_final: 1300,
        },
      ];

      const gen: TrialBalanceItem[] = [
        {
          code: '110505',
          name: 'Caja General',
          level: 4,
          nature: 'DEBITO',
          type: 'ACTIVO',
          parent_code: '1105',
          saldo_inicial: 1050,
          debito: 520,
          credito: 200,
          saldo_final: 1330,
          debit: 520,
          credit: 200,
          balance: 1330,
        },
      ];

      const res = compareTrialBalances(gen, bench);
      expect(res.passed).toBe(false);
      expect(res.discrepancies.length).toBe(1);
      const disc = res.discrepancies[0];
      expect(disc.type).toBe('SALDO_INICIAL_MISMATCH');
      expect(disc.details.saldo_inicial).toBeDefined();
      expect(disc.details.saldo_inicial?.expected).toBe(1000);
      expect(disc.details.saldo_inicial?.actual).toBe(1050);
      expect(disc.details.saldo_inicial?.diff).toBe(50);

      expect(disc.details.debito).toBeDefined();
      expect(disc.details.debito?.expected).toBe(500);
      expect(disc.details.debito?.actual).toBe(520);
      expect(disc.details.debito?.diff).toBe(20);

      expect(disc.details.credito).toBeUndefined();

      expect(disc.details.saldo_final).toBeDefined();
      expect(disc.details.saldo_final?.expected).toBe(1300);
      expect(disc.details.saldo_final?.actual).toBe(1330);
      expect(disc.details.saldo_final?.diff).toBe(30);
    });
  });
});
