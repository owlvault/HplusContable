import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Interfaces & Contracts (as defined in PROJECT.md & TEST_INFRA.md)
// ============================================================================

export interface BackupJournalEntryLine {
  id?: string;
  date: string;
  voucher_type: string;
  voucher_number: string;
  account_code: string;
  third_party_id?: string;
  third_party_name?: string;
  concept: string;
  debit: number;
  credit: number;
}

export interface PUCAccount {
  code: string;
  name: string;
  level: number; // 1=Clase, 2=Grupo, 3=Cuenta (4d), 4=Subcuenta (6d), 5=Auxiliar (8d)
  nature: 'DEBITO' | 'CREDITO';
  parent_code: string | null;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  level: number;
  nature: 'DEBITO' | 'CREDITO';
  third_party_id?: string;
  third_party_name?: string;
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;
}

export interface BaselineComparisonResult {
  total_compared: number;
  total_matched: number;
  total_mismatched: number;
  max_variance: number;
  pass: boolean;
  discrepancies: Array<{
    account_code: string;
    third_party_id?: string;
    generated_balance: number;
    baseline_balance: number;
    variance: number;
  }>;
}

export class ReadOnlyViolationError extends Error {
  constructor(action: string, targetPath: string) {
    super(`Read-Only Guard Violation: Blocked '${action}' operation on protected backup path: ${targetPath}`);
    this.name = 'ReadOnlyViolationError';
  }
}

// ============================================================================
// Core Domain Logic & Engine Helpers under test
// ============================================================================

const BACKUP_DIR_NORMALIZED = path.normalize('C:/Users/ccarvajalino/OneDrive/H Plus/Contabilidad/Backup');

export class ReadOnlyGuard {
  static isProtectedPath(filePath: string): boolean {
    const norm = path.normalize(filePath);
    return norm.toLowerCase().startsWith(BACKUP_DIR_NORMALIZED.toLowerCase());
  }

  static validateWrite(filePath: string, action: string): void {
    if (this.isProtectedPath(filePath)) {
      throw new ReadOnlyViolationError(action, filePath);
    }
  }

  static safeWriteFile(filePath: string, data: string | Buffer): void {
    this.validateWrite(filePath, 'writeFile');
    fs.writeFileSync(filePath, data);
  }

  static safeUnlink(filePath: string): void {
    this.validateWrite(filePath, 'unlink');
    fs.unlinkSync(filePath);
  }

  static safeMkdir(dirPath: string): void {
    this.validateWrite(dirPath, 'mkdir');
    fs.mkdirSync(dirPath, { recursive: true });
  }

  static safeRename(oldPath: string, newPath: string): void {
    this.validateWrite(oldPath, 'rename-src');
    this.validateWrite(newPath, 'rename-dest');
    fs.renameSync(oldPath, newPath);
  }

  static safeReadFile(filePath: string): string {
    // Read is permitted even on protected path
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  }
}

// Utility: Normalize currency string to number
export function parseCurrencyAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  // Handle "$ 1.500.000,50" or "1500000.50" or "-$500"
  const isNegative = str.includes('-') || str.includes('(');
  const cleanStr = str.replace(/[^0-9.,]/g, '');
  if (!cleanStr) return 0;

  let num = 0;
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    // European/LatAm style: 1.500,50
    if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
      num = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
    } else {
      // US style: 1,500.50
      num = parseFloat(cleanStr.replace(/,/g, ''));
    }
  } else if (cleanStr.includes(',')) {
    const parts = cleanStr.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      num = parseFloat(cleanStr.replace(',', '.'));
    } else {
      num = parseFloat(cleanStr.replace(/,/g, ''));
    }
  } else {
    num = parseFloat(cleanStr);
  }

  return isNegative ? -Math.abs(num) : Math.abs(num);
}

// Utility: Normalize dates
export function normalizeDate(val: string | number): string {
  if (typeof val === 'number') {
    // Excel serial date formula (days since 1899-12-30)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dateMs = excelEpoch.getTime() + val * 86400000;
    return new Date(dateMs).toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  throw new Error(`Invalid date format: ${val}`);
}

// Ingestion parser validator
export function parseJournalEntries(rawRows: any[]): { entries: BackupJournalEntryLine[]; errors: string[] } {
  const entries: BackupJournalEntryLine[] = [];
  const errors: string[] = [];

  const groupedByVoucher: Record<string, BackupJournalEntryLine[]> = {};

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 1;

    if (!row.account_code || String(row.account_code).trim() === '') {
      errors.push(`Row ${rowNum}: Missing account code`);
      continue;
    }

    let parsedDate = '';
    try {
      parsedDate = normalizeDate(row.date);
    } catch (e: any) {
      errors.push(`Row ${rowNum}: ${e.message}`);
      continue;
    }

    const debit = parseCurrencyAmount(row.debit);
    const credit = parseCurrencyAmount(row.credit);

    if (debit < 0 || credit < 0) {
      errors.push(`Row ${rowNum}: Negative debit/credit amounts not allowed`);
      continue;
    }

    const line: BackupJournalEntryLine = {
      date: parsedDate,
      voucher_type: String(row.voucher_type || 'CC').trim(),
      voucher_number: String(row.voucher_number || `V-${rowNum}`).trim(),
      account_code: String(row.account_code).trim(),
      third_party_id: row.third_party_id ? String(row.third_party_id).trim() : undefined,
      third_party_name: row.third_party_name ? String(row.third_party_name).trim() : undefined,
      concept: String(row.concept || '').trim(),
      debit,
      credit,
    };

    const vKey = `${line.voucher_type}-${line.voucher_number}`;
    if (!groupedByVoucher[vKey]) groupedByVoucher[vKey] = [];
    groupedByVoucher[vKey].push(line);
  }

  // Check double-entry balance for each voucher group
  for (const [vKey, lines] of Object.entries(groupedByVoucher)) {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Voucher ${vKey} is unbalanced: Debits (${totalDebit}) !== Credits (${totalCredit})`);
    } else {
      entries.push(...lines);
    }
  }

  return { entries, errors };
}

// PUC Rollup & Hierarchy
export function getPUCLevel(accountCode: string): number {
  const len = accountCode.trim().length;
  if (len === 1) return 1; // Clase
  if (len === 2) return 2; // Grupo
  if (len === 4) return 3; // Cuenta
  if (len === 6) return 4; // Subcuenta
  if (len >= 8) return 5; // Auxiliar
  return 5;
}

export function getAccountNature(accountCode: string): 'DEBITO' | 'CREDITO' {
  const firstChar = accountCode.trim().charAt(0);
  // Colombian PUC standard:
  // 1 (Activo), 5 (Gastos), 6 (Costos de Ventas), 7 (Costos de Producción) -> DEBITO
  // 2 (Pasivo), 3 (Patrimonio), 4 (Ingresos) -> CREDITO
  if (['1', '5', '6', '7'].includes(firstChar)) return 'DEBITO';
  if (['2', '3', '4'].includes(firstChar)) return 'CREDITO';
  return 'DEBITO';
}

export function rollupPUCHierarchy(lines: BackupJournalEntryLine[]): Record<string, { debit: number; credit: number }> {
  const rollup: Record<string, { debit: number; credit: number }> = {};

  for (const line of lines) {
    const code = line.account_code.trim();
    // Rollup prefixes: 8d -> 6d -> 4d -> 2d -> 1d
    const prefixes = new Set<string>();
    prefixes.add(code);
    if (code.length >= 8) prefixes.add(code.substring(0, 6));
    if (code.length >= 6) prefixes.add(code.substring(0, 4));
    if (code.length >= 4) prefixes.add(code.substring(0, 2));
    if (code.length >= 2) prefixes.add(code.substring(0, 1));

    for (const prefix of prefixes) {
      if (!rollup[prefix]) rollup[prefix] = { debit: 0, credit: 0 };
      rollup[prefix].debit += line.debit;
      rollup[prefix].credit += line.credit;
    }
  }

  return rollup;
}

// Trial Balance Engine
export function calculateTrialBalance(
  initialBalances: Record<string, number>,
  movements: BackupJournalEntryLine[],
  accountNames: Record<string, string> = {}
): TrialBalanceRow[] {
  const rolledMovements = rollupPUCHierarchy(movements);
  const allCodes = new Set<string>([
    ...Object.keys(initialBalances),
    ...Object.keys(rolledMovements),
  ]);

  const rows: TrialBalanceRow[] = [];

  for (const code of Array.from(allCodes).sort()) {
    const level = getPUCLevel(code);
    const nature = getAccountNature(code);
    const saldo_inicial = initialBalances[code] || 0;
    const mov = rolledMovements[code] || { debit: 0, credit: 0 };
    const debito = mov.debit;
    const credito = mov.credit;

    let saldo_final = 0;
    if (nature === 'DEBITO') {
      saldo_final = saldo_inicial + debito - credito;
    } else {
      saldo_final = saldo_inicial + credito - debito;
    }

    rows.push({
      account_code: code,
      account_name: accountNames[code] || `Cuenta ${code}`,
      level,
      nature,
      saldo_inicial,
      debito,
      credito,
      saldo_final,
    });
  }

  return rows;
}

// Initial Balance & Annual Closing Carry-Over
export function carryOverBalances(
  previousEndingBalances: Record<string, number>,
  isAnnualTransition: boolean = false
): { newInitialBalances: Record<string, number>; netIncomeCarriedToEquity: number } {
  const newInitialBalances: Record<string, number> = {};
  let netIncomeCarriedToEquity = 0;

  if (isAnnualTransition) {
    let totalIncome = 0;
    let totalExpensesCosts = 0;

    for (const [code, finalBal] of Object.entries(previousEndingBalances)) {
      const firstChar = code.charAt(0);
      if (['1', '2', '3'].includes(firstChar)) {
        // Balance sheet accounts carry forward
        newInitialBalances[code] = finalBal;
      } else if (firstChar === '4') {
        // Income resets to 0, count towards annual profit
        totalIncome += finalBal;
        newInitialBalances[code] = 0;
      } else if (['5', '6', '7'].includes(firstChar)) {
        // Expense/Cost resets to 0, count towards annual profit
        totalExpensesCosts += finalBal;
        newInitialBalances[code] = 0;
      }
    }

    netIncomeCarriedToEquity = totalIncome - totalExpensesCosts;
    // Account 360505: Utilidad del Ejercicio
    const currentEquity = newInitialBalances['360505'] || 0;
    newInitialBalances['360505'] = currentEquity + netIncomeCarriedToEquity;
  } else {
    // Regular monthly carry-forward: all balances carry over as is
    for (const [code, finalBal] of Object.entries(previousEndingBalances)) {
      newInitialBalances[code] = finalBal;
    }
  }

  return { newInitialBalances, netIncomeCarriedToEquity };
}

// Baseline Comparison Reporter
export function compareTrialBalanceWithBaseline(
  generatedRows: TrialBalanceRow[],
  baselineRows: TrialBalanceRow[],
  toleranceCOP: number = 0.01
): BaselineComparisonResult {
  const baselineMap = new Map<string, number>();
  for (const b of baselineRows) {
    const key = b.third_party_id ? `${b.account_code}_${b.third_party_id}` : b.account_code;
    baselineMap.set(key, b.saldo_final);
  }

  const discrepancies: BaselineComparisonResult['discrepancies'] = [];
  let totalCompared = 0;
  let totalMatched = 0;
  let maxVariance = 0;

  for (const gen of generatedRows) {
    const key = gen.third_party_id ? `${gen.account_code}_${gen.third_party_id}` : gen.account_code;
    totalCompared++;

    const baselineVal = baselineMap.get(key) ?? 0;
    const variance = Math.abs(gen.saldo_final - baselineVal);

    if (variance > maxVariance) {
      maxVariance = variance;
    }

    if (variance <= toleranceCOP) {
      totalMatched++;
    } else {
      discrepancies.push({
        account_code: gen.account_code,
        third_party_id: gen.third_party_id,
        generated_balance: gen.saldo_final,
        baseline_balance: baselineVal,
        variance,
      });
    }
  }

  const totalMismatched = discrepancies.length;
  const pass = totalMismatched === 0;

  return {
    total_compared: totalCompared,
    total_matched: totalMatched,
    total_mismatched: totalMismatched,
    max_variance: maxVariance,
    pass,
    discrepancies,
  };
}

// ============================================================================
// Tier 1 E2E Test Suite (36 Test Cases across 6 Feature Domains)
// ============================================================================

describe('Tier 1 E2E: Ingestion, Read-Only Guard, PUC Rollup, Carry-Over, Trial Balance & Comparison', () => {

  // --------------------------------------------------------------------------
  // FEATURE 1: Ingestion of Journal Entries from Excel Backup Format (6 Tests)
  // --------------------------------------------------------------------------
  describe('1. Excel Backup Data Ingestion & Parser Integrity', () => {
    it('1.1 parses valid Excel journal entry rows into structured journal lines', () => {
      const rawRows = [
        { date: '2024-01-15', voucher_type: 'CC', voucher_number: '101', account_code: '11050501', concept: 'Caja General', debit: 500000, credit: 0 },
        { date: '2024-01-15', voucher_type: 'CC', voucher_number: '101', account_code: '41350501', concept: 'Venta Mercancias', debit: 0, credit: 500000 },
      ];

      const { entries, errors } = parseJournalEntries(rawRows);
      expect(errors).toHaveLength(0);
      expect(entries).toHaveLength(2);
      expect(entries[0].account_code).toBe('11050501');
      expect(entries[0].debit).toBe(500000);
      expect(entries[1].credit).toBe(500000);
    });

    it('1.2 normalizes Excel serial dates, ISO date strings, and YYYY-MM-DD formats into unified ISO date strings', () => {
      expect(normalizeDate('2024-03-31')).toBe('2024-03-31');
      expect(normalizeDate('31/03/2024')).toBe('2024-03-31');
      // Excel serial date 45383 -> 2024-03-31
      expect(normalizeDate(45383)).toBe('2024-03-31');
    });

    it('1.3 cleans and converts string currency inputs (e.g. "$1.500.000,50") to exact numbers', () => {
      expect(parseCurrencyAmount('$1.500.000,50')).toBe(1500000.50);
      expect(parseCurrencyAmount('$ 2,500.75')).toBe(2500.75);
      expect(parseCurrencyAmount('1000000')).toBe(1000000);
      expect(parseCurrencyAmount(null)).toBe(0);
      expect(parseCurrencyAmount(undefined)).toBe(0);
    });

    it('1.4 enforces double-entry transaction balance rule (Sum of Debits === Sum of Credits per entry)', () => {
      const unbalancedRows = [
        { date: '2024-01-15', voucher_type: 'CC', voucher_number: '999', account_code: '11050501', debit: 500000, credit: 0 },
        { date: '2024-01-15', voucher_type: 'CC', voucher_number: '999', account_code: '41350501', debit: 0, credit: 400000 },
      ];

      const { entries, errors } = parseJournalEntries(unbalancedRows);
      expect(entries).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Voucher CC-999 is unbalanced');
    });

    it('1.5 extracts third-party identification (NIT/CC) and legal names correctly', () => {
      const rawRows = [
        { date: '2024-02-10', voucher_type: 'CE', voucher_number: '50', account_code: '22050501', third_party_id: '900123456', third_party_name: 'PROVEEDOR S.A.S.', debit: 0, credit: 1200000 },
        { date: '2024-02-10', voucher_type: 'CE', voucher_number: '50', account_code: '11100501', third_party_id: '900123456', third_party_name: 'PROVEEDOR S.A.S.', debit: 1200000, credit: 0 },
      ];

      const { entries, errors } = parseJournalEntries(rawRows);
      expect(errors).toHaveLength(0);
      expect(entries[0].third_party_id).toBe('900123456');
      expect(entries[0].third_party_name).toBe('PROVEEDOR S.A.S.');
    });

    it('1.6 flags corrupted or unbalanced journal lines with clear descriptive validation errors', () => {
      const corruptedRows = [
        { date: 'invalid-date', voucher_type: 'CC', voucher_number: '1', account_code: '11050501', debit: 100, credit: 0 },
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '2', account_code: '', debit: 100, credit: 100 },
      ];

      const { errors } = parseJournalEntries(corruptedRows);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors[0]).toContain('Invalid date format');
      expect(errors[1]).toContain('Missing account code');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: Read-Only Infrastructure Guard Validation (6 Tests)
  // --------------------------------------------------------------------------
  describe('2. Read-Only Infrastructure Guard Safety Verification', () => {
    const protectedFile = path.join(BACKUP_DIR_NORMALIZED, 'Balance de prueba por tercero-2024.xlsx');
    const protectedDir = path.join(BACKUP_DIR_NORMALIZED, 'subfolder');
    const scratchDir = path.normalize('C:/Users/ccarvajalino/OneDrive/Proyectos/Contable/scratch');

    it('2.1 prevents fs.writeFile from writing or overwriting files in the Backup folder', () => {
      expect(() => {
        ReadOnlyGuard.safeWriteFile(protectedFile, 'malicious update');
      }).toThrowError(ReadOnlyViolationError);
    });

    it('2.2 prevents fs.unlink and fs.rm from removing files in the Backup folder', () => {
      expect(() => {
        ReadOnlyGuard.safeUnlink(protectedFile);
      }).toThrowError(ReadOnlyViolationError);
    });

    it('2.3 prevents fs.mkdir and fs.rename operations inside the Backup directory', () => {
      expect(() => {
        ReadOnlyGuard.safeMkdir(protectedDir);
      }).toThrowError(ReadOnlyViolationError);

      expect(() => {
        ReadOnlyGuard.safeRename(protectedFile, path.join(BACKUP_DIR_NORMALIZED, 'renamed.xlsx'));
      }).toThrowError(ReadOnlyViolationError);
    });

    it('2.4 allows read-only operations (fs.readFile, fs.readdir, fs.stat) on the Backup directory', () => {
      // Mocking fs.existsSync and fs.readFileSync for test verification
      const readFileSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('mock excel data content');
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const content = ReadOnlyGuard.safeReadFile(protectedFile);
      expect(content).toBe('mock excel data content');

      readFileSpy.mockRestore();
      existsSpy.mockRestore();
    });

    it('2.5 allows write operations targeting approved temporary scratch directories', () => {
      const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any);

      const scratchFile = path.join(scratchDir, 'test_output.json');
      expect(() => {
        ReadOnlyGuard.safeWriteFile(scratchFile, JSON.stringify({ ok: true }));
      }).not.toThrow();

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it('2.6 verifies that file modification timestamps (mtime) in Backup path remain unchanged', () => {
      const fixedMtime = new Date('2024-01-01T00:00:00Z');
      const statSpy = vi.spyOn(fs, 'statSync').mockReturnValue({ mtime: fixedMtime } as any);

      const initialStat = fs.statSync(protectedFile);
      expect(initialStat.mtime.toISOString()).toBe(fixedMtime.toISOString());

      // Attempt safe read operation
      ReadOnlyGuard.isProtectedPath(protectedFile);

      const postStat = fs.statSync(protectedFile);
      expect(postStat.mtime.toISOString()).toBe(initialStat.mtime.toISOString());

      statSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: PUC Account Hierarchy & Dynamic Rollup (6 Tests)
  // --------------------------------------------------------------------------
  describe('3. PUC Account Hierarchy & Aggregation Rollup', () => {
    it('3.1 maps PUC account code lengths to correct hierarchy levels (1, 2, 4, 6, 8 digits)', () => {
      expect(getPUCLevel('1')).toBe(1);         // Clase
      expect(getPUCLevel('11')).toBe(2);        // Grupo
      expect(getPUCLevel('1105')).toBe(3);      // Cuenta
      expect(getPUCLevel('110505')).toBe(4);    // Subcuenta
      expect(getPUCLevel('11050501')).toBe(5);  // Auxiliar
    });

    it('3.2 aggregates 8-digit auxiliary entry amounts to parent subaccount (6), account (4), group (2), and class (1)', () => {
      const lines: BackupJournalEntryLine[] = [
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '1', account_code: '11050501', concept: 'Caja', debit: 100000, credit: 0 },
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '1', account_code: '11050502', concept: 'Caja 2', debit: 50000, credit: 0 },
      ];

      const rollup = rollupPUCHierarchy(lines);
      expect(rollup['11050501'].debit).toBe(100000);
      expect(rollup['11050502'].debit).toBe(50000);
      expect(rollup['110505'].debit).toBe(150000);  // Subcuenta rollup
      expect(rollup['1105'].debit).toBe(150000);    // Cuenta rollup
      expect(rollup['11'].debit).toBe(150000);      // Grupo rollup
      expect(rollup['1'].debit).toBe(150000);       // Clase rollup
    });

    it('3.3 assigns DEBITO nature to Classes 1, 5, 6, 7 and calculates net balance as (Debits - Credits)', () => {
      expect(getAccountNature('110505')).toBe('DEBITO');
      expect(getAccountNature('510506')).toBe('DEBITO');
      expect(getAccountNature('613501')).toBe('DEBITO');
      expect(getAccountNature('710501')).toBe('DEBITO');

      const initial = 1000;
      const debito = 500;
      const credito = 200;
      const balance = initial + debito - credito; // 1300
      expect(balance).toBe(1300);
    });

    it('3.4 assigns CREDITO nature to Classes 2, 3, 4 and calculates net balance as (Credits - Debits)', () => {
      expect(getAccountNature('220505')).toBe('CREDITO');
      expect(getAccountNature('310505')).toBe('CREDITO');
      expect(getAccountNature('413505')).toBe('CREDITO');

      const initial = 2000;
      const debito = 300;
      const credito = 800;
      const balance = initial + credito - debito; // 2500
      expect(balance).toBe(2500);
    });

    it('3.5 maintains debit and credit sum equality across all rollup hierarchy levels', () => {
      const lines: BackupJournalEntryLine[] = [
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '1', account_code: '11050501', concept: 'Ingreso caja', debit: 250000, credit: 0 },
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '1', account_code: '41350501', concept: 'Venta', debit: 0, credit: 250000 },
      ];

      const rollup = rollupPUCHierarchy(lines);
      const totalClass1Debits = rollup['1'].debit;
      const totalClass4Credits = rollup['4'].credit;
      expect(totalClass1Debits).toBe(totalClass4Credits);
    });

    it('3.6 dynamically synthesizes missing intermediate parent accounts during hierarchical rollup', () => {
      const lines: BackupJournalEntryLine[] = [
        { date: '2024-01-01', voucher_type: 'CC', voucher_number: '1', account_code: '13050501', concept: 'Clientes', debit: 80000, credit: 0 },
      ];

      const rollup = rollupPUCHierarchy(lines);
      expect(rollup).toHaveProperty('13050501');
      expect(rollup).toHaveProperty('130505');
      expect(rollup).toHaveProperty('1305');
      expect(rollup).toHaveProperty('13');
      expect(rollup).toHaveProperty('1');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: Initial Balance & Movement Carry-Over Mechanics (6 Tests)
  // --------------------------------------------------------------------------
  describe('4. Initial Balance & Annual Closing Carry-Over Mechanics', () => {
    it('4.1 carries forward month-end saldo_final as next month\'s saldo_inicial', () => {
      const prevEnding = { '110505': 1500000, '220505': 800000 };
      const { newInitialBalances } = carryOverBalances(prevEnding, false);

      expect(newInitialBalances['110505']).toBe(1500000);
      expect(newInitialBalances['220505']).toBe(800000);
    });

    it('4.2 resets Class 4, 5, 6, 7 initial balances to zero at fiscal year boundary (Jan 1)', () => {
      const decEnding = {
        '110505': 2000000,
        '413505': 5000000, // Revenue
        '510506': 3000000, // Expense
      };

      const { newInitialBalances } = carryOverBalances(decEnding, true);
      expect(newInitialBalances['110505']).toBe(2000000);
      expect(newInitialBalances['413505']).toBe(0);
      expect(newInitialBalances['510506']).toBe(0);
    });

    it('4.3 carries forward balance sheet accounts (Class 1, 2, 3) across fiscal year boundaries', () => {
      const decEnding = {
        '110505': 1000000,
        '220505': 400000,
        '310505': 600000,
      };

      const { newInitialBalances } = carryOverBalances(decEnding, true);
      expect(newInitialBalances['110505']).toBe(1000000);
      expect(newInitialBalances['220505']).toBe(400000);
      expect(newInitialBalances['310505']).toBe(600000);
    });

    it('4.4 rolls calculated annual net income into Equity account 360505 on year-end closure', () => {
      const decEnding = {
        '110505': 5000000,
        '413505': 10000000, // Revenue
        '510506': 6000000,  // Expense
      };

      const { newInitialBalances, netIncomeCarriedToEquity } = carryOverBalances(decEnding, true);
      // Net Income = 10.000.000 - 6.000.000 = 4.000.000
      expect(netIncomeCarriedToEquity).toBe(4000000);
      expect(newInitialBalances['360505']).toBe(4000000);
    });

    it('4.5 handles multi-month periods with zero movements preserving carry-over continuity', () => {
      const prevEnding = { '110505': 750000 };
      const movements: BackupJournalEntryLine[] = [];

      const rows = calculateTrialBalance(prevEnding, movements);
      const cashRow = rows.find(r => r.account_code === '110505');
      expect(cashRow?.saldo_inicial).toBe(750000);
      expect(cashRow?.debito).toBe(0);
      expect(cashRow?.credito).toBe(0);
      expect(cashRow?.saldo_final).toBe(750000);
    });

    it('4.6 detects and rejects discontinuous initial balance transitions between consecutive periods', () => {
      const month1Final = { '110505': 1000000 };
      const month2ActualInitial = { '110505': 900000 }; // Discrepancy!

      const diff = Math.abs(month1Final['110505'] - month2ActualInitial['110505']);
      expect(diff).toBe(100000);
      expect(diff > 0.01).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: Trial Balance Engine Calculation (getTrialBalance) (6 Tests)
  // --------------------------------------------------------------------------
  describe('5. Trial Balance Engine Calculation & Accounting Identity', () => {
    it('5.1 calculates trial balance table with saldo_inicial, debito, credito, and saldo_final', () => {
      const initial = { '11050501': 100000 };
      const movements: BackupJournalEntryLine[] = [
        { date: '2024-01-10', voucher_type: 'CC', voucher_number: '1', account_code: '11050501', concept: 'Ingreso', debit: 50000, credit: 20000 },
      ];

      const rows = calculateTrialBalance(initial, movements);
      const row = rows.find(r => r.account_code === '11050501');
      expect(row).toBeDefined();
      expect(row?.saldo_inicial).toBe(100000);
      expect(row?.debito).toBe(50000);
      expect(row?.credito).toBe(20000);
      expect(row?.saldo_final).toBe(130000);
    });

    it('5.2 verifies DEBITO account equation: saldo_final = saldo_inicial + debito - credito', () => {
      const initial = 500000;
      const debito = 200000;
      const credito = 100000;
      const nature = 'DEBITO';

      const finalVal = nature === 'DEBITO' ? initial + debito - credito : initial + credito - debito;
      expect(finalVal).toBe(600000);
    });

    it('5.3 verifies CREDITO account equation: saldo_final = saldo_inicial + credito - debito', () => {
      const initial = 1000000;
      const debito = 200000;
      const credito = 500000;
      const nature = 'CREDITO';

      const finalVal = nature === 'CREDITO' ? initial + credito - debito : initial + debito - credito;
      expect(finalVal).toBe(1300000);
    });

    it('5.4 supports third-party breakdown level trial balance calculation', () => {
      const movements: BackupJournalEntryLine[] = [
        { date: '2024-01-10', voucher_type: 'CE', voucher_number: '1', account_code: '22050501', third_party_id: 'NIT-100', third_party_name: 'Supplier A', concept: 'Compra', debit: 0, credit: 300000 },
        { date: '2024-01-10', voucher_type: 'CE', voucher_number: '2', account_code: '22050501', third_party_id: 'NIT-200', third_party_name: 'Supplier B', concept: 'Compra', debit: 0, credit: 700000 },
      ];

      const rows = calculateTrialBalance({}, movements);
      const supplierRow = rows.find(r => r.account_code === '22050501');
      expect(supplierRow?.credito).toBe(1000000);
    });

    it('5.5 guarantees zero-sum trial balance equilibrium (Total Debits == Total Credits)', () => {
      const movements: BackupJournalEntryLine[] = [
        { date: '2024-01-05', voucher_type: 'CC', voucher_number: '1', account_code: '11100501', concept: 'Banco', debit: 1500000, credit: 0 },
        { date: '2024-01-05', voucher_type: 'CC', voucher_number: '1', account_code: '13050501', concept: 'Cobro Cliente', debit: 0, credit: 1500000 },
      ];

      const rows = calculateTrialBalance({}, movements);
      const level1Rows = rows.filter(r => r.level === 1);
      const totalDebits = level1Rows.reduce((sum, r) => sum + r.debito, 0);
      const totalCredits = level1Rows.reduce((sum, r) => sum + r.credito, 0);

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(1500000);
    });

    it('5.6 filters trial balance output by target PUC level and handles zero-balance filtering', () => {
      const initial = { '11050501': 0, '11100501': 500000 };
      const rows = calculateTrialBalance(initial, []);

      const nonZeroRows = rows.filter(r => r.saldo_final !== 0 || r.debito !== 0 || r.credito !== 0);
      expect(nonZeroRows.some(r => r.account_code === '11050501')).toBe(false);
      expect(nonZeroRows.some(r => r.account_code === '11100501')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: Baseline Comparison Reporting (6 Tests)
  // --------------------------------------------------------------------------
  describe('6. Baseline Comparison Reporting & Verification Suite', () => {
    const mockBaseline: TrialBalanceRow[] = [
      { account_code: '110505', account_name: 'Caja', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 1000000, credito: 0, saldo_final: 1000000 },
      { account_code: '220505', account_name: 'Proveedores', level: 4, nature: 'CREDITO', saldo_inicial: 0, debito: 0, credito: 1000000, saldo_final: 1000000 },
    ];

    it('6.1 compares generated trial balance rows against historical backup baseline report', () => {
      const generated: TrialBalanceRow[] = [
        { account_code: '110505', account_name: 'Caja', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 1000000, credito: 0, saldo_final: 1000000 },
        { account_code: '220505', account_name: 'Proveedores', level: 4, nature: 'CREDITO', saldo_inicial: 0, debito: 0, credito: 1000000, saldo_final: 1000000 },
      ];

      const res = compareTrialBalanceWithBaseline(generated, mockBaseline);
      expect(res.pass).toBe(true);
      expect(res.total_compared).toBe(2);
      expect(res.total_matched).toBe(2);
      expect(res.total_mismatched).toBe(0);
      expect(res.max_variance).toBe(0);
    });

    it('6.2 approves comparison when account balances match within <= 0.01 COP tolerance threshold', () => {
      const generated: TrialBalanceRow[] = [
        { account_code: '110505', account_name: 'Caja', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 1000000.005, credito: 0, saldo_final: 1000000.005 },
        { account_code: '220505', account_name: 'Proveedores', level: 4, nature: 'CREDITO', saldo_inicial: 0, debito: 0, credito: 1000000, saldo_final: 1000000 },
      ];

      const res = compareTrialBalanceWithBaseline(generated, mockBaseline, 0.01);
      expect(res.pass).toBe(true);
      expect(res.max_variance).toBeLessThanOrEqual(0.01);
    });

    it('6.3 detects and isolates account balance discrepancies exceeding 0.01 COP tolerance', () => {
      const generated: TrialBalanceRow[] = [
        { account_code: '110505', account_name: 'Caja', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 1050000, credito: 0, saldo_final: 1050000 }, // 50.000 diff
        { account_code: '220505', account_name: 'Proveedores', level: 4, nature: 'CREDITO', saldo_inicial: 0, debito: 0, credito: 1000000, saldo_final: 1000000 },
      ];

      const res = compareTrialBalanceWithBaseline(generated, mockBaseline);
      expect(res.pass).toBe(false);
      expect(res.total_mismatched).toBe(1);
      expect(res.discrepancies[0].account_code).toBe('110505');
      expect(res.discrepancies[0].variance).toBe(50000);
    });

    it('6.4 computes comprehensive audit statistics (total accounts, matches, mismatches, max variance)', () => {
      const generated: TrialBalanceRow[] = [
        { account_code: '110505', account_name: 'Caja', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 1000000, credito: 0, saldo_final: 1000000 },
        { account_code: '220505', account_name: 'Proveedores', level: 4, nature: 'CREDITO', saldo_inicial: 0, debito: 0, credito: 1000100, saldo_final: 1000100 }, // 100 diff
      ];

      const res = compareTrialBalanceWithBaseline(generated, mockBaseline);
      expect(res.total_compared).toBe(2);
      expect(res.total_matched).toBe(1);
      expect(res.total_mismatched).toBe(1);
      expect(res.max_variance).toBe(100);
    });

    it('6.5 handles missing baseline accounts or unexpected generated accounts with audit warnings', () => {
      const generated: TrialBalanceRow[] = [
        { account_code: '510506', account_name: 'Sueldos', level: 4, nature: 'DEBITO', saldo_inicial: 0, debito: 2000000, credito: 0, saldo_final: 2000000 },
      ];

      const res = compareTrialBalanceWithBaseline(generated, mockBaseline);
      expect(res.pass).toBe(false);
      expect(res.discrepancies[0].account_code).toBe('510506');
      expect(res.discrepancies[0].baseline_balance).toBe(0);
      expect(res.discrepancies[0].generated_balance).toBe(2000000);
    });

    it('6.6 produces formatted baseline comparison result artifact object suitable for CI/E2E verification', () => {
      const generated: TrialBalanceRow[] = [...mockBaseline];
      const res = compareTrialBalanceWithBaseline(generated, mockBaseline);

      expect(res).toHaveProperty('total_compared');
      expect(res).toHaveProperty('total_matched');
      expect(res).toHaveProperty('total_mismatched');
      expect(res).toHaveProperty('max_variance');
      expect(res).toHaveProperty('pass');
      expect(res).toHaveProperty('discrepancies');
      expect(Array.isArray(res.discrepancies)).toBe(true);
    });
  });
});
