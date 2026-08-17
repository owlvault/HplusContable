import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * ============================================================================
 * E2E TEST HARNESS FOR CFO-AI CONTABLE
 * ============================================================================
 * Standard test helpers for E2E testing including:
 * 1. Mock accounting transaction generators
 * 2. Read-only directory integrity checker
 * 3. PUC hierarchy rollup utility functions
 * 4. Floating-point COP comparison helpers (tolerance <= 0.01 COP)
 */

// ============================================================================
// 1. MOCK ACCOUNTING TRANSACTION GENERATORS
// ============================================================================

export interface MockJournalLine {
  id?: string;
  journal_entry_id?: string;
  account_code: string;
  account_name?: string;
  third_party_id?: string | null;
  third_party_name?: string | null;
  third_party_nit?: string | null;
  debit: number;
  credit: number;
  description?: string;
}

export interface MockJournalEntry {
  id: string;
  date: string; // ISO format string (YYYY-MM-DD)
  period: string; // YYYY-MM
  voucher_type: string; // e.g., 'CC', 'CE', 'RC', 'DS'
  voucher_number: number | string;
  description: string;
  state: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  created_by: string;
  created_at: string;
  lines: MockJournalLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface TransactionGeneratorOptions {
  date?: string | Date;
  description?: string;
  state?: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  voucher_type?: string;
  voucher_number?: number | string;
  third_party_id?: string;
  third_party_name?: string;
  third_party_nit?: string;
  unbalanced?: boolean;
  unbalanceAmount?: number;
  debitAccount?: string;
  creditAccount?: string;
  amount?: number;
  customLines?: MockJournalLine[];
}

export interface BatchGeneratorOptions {
  startDate?: string;
  endDate?: string;
  count?: number;
  accounts?: string[];
  thirdParties?: Array<{ id: string; name: string; nit: string }>;
  allowUnbalanced?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Default standard PUC accounts used for mock transactions.
 */
export const STANDARD_MOCK_ACCOUNTS = {
  CAJA_GENERAL: '11050501',
  BANCOS_NACIONALES: '11100501',
  CLIENTES_NACIONALES: '13050501',
  PROVEEDORES_NACIONALES: '22050501',
  RETENCION_FUENTE: '23654001',
  IVA_GENERADO: '24080501',
  COMERCIO_MAYOR_MENOR: '41350501',
  GASTOS_PERSONAL: '51050601',
  GASTOS_ARRENDAMIENTOS: '51201001',
  GASTOS_SERVICIOS: '51353001',
  COSTO_VENTAS: '61350501',
};

/**
 * Generates a mock accounting transaction / journal entry.
 */
export function generateMockTransaction(options: TransactionGeneratorOptions = {}): MockJournalEntry {
  const entryId = typeof crypto.randomUUID === 'function' 
    ? crypto.randomUUID() 
    : `entry-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rawDate = options.date 
    ? (typeof options.date === 'string' ? options.date : options.date.toISOString().split('T')[0]) 
    : '2024-01-15';
  const period = rawDate.substring(0, 7);
  const amount = options.amount ?? 1500000;
  const state = options.state ?? 'APROBADO';
  const voucher_type = options.voucher_type ?? 'CC';
  const voucher_number = options.voucher_number ?? Math.floor(Math.random() * 1000) + 1;
  const description = options.description ?? 'Asiento contable de prueba E2E';
  
  let lines: MockJournalLine[] = [];

  if (options.customLines && options.customLines.length > 0) {
    lines = options.customLines.map((line, idx) => ({
      id: line.id ?? `line-${entryId}-${idx + 1}`,
      journal_entry_id: entryId,
      account_code: line.account_code,
      account_name: line.account_name ?? `Cuenta ${line.account_code}`,
      third_party_id: line.third_party_id ?? options.third_party_id ?? null,
      third_party_name: line.third_party_name ?? options.third_party_name ?? null,
      third_party_nit: line.third_party_nit ?? options.third_party_nit ?? null,
      debit: roundCOP(line.debit),
      credit: roundCOP(line.credit),
      description: line.description ?? description,
    }));
  } else {
    const debitAcc = options.debitAccount ?? STANDARD_MOCK_ACCOUNTS.GASTOS_SERVICIOS;
    const creditAcc = options.creditAccount ?? STANDARD_MOCK_ACCOUNTS.BANCOS_NACIONALES;
    const tpId = options.third_party_id ?? 'tp-001';
    const tpName = options.third_party_name ?? 'Empresa Proveedora S.A.S.';
    const tpNit = options.third_party_nit ?? '900123456-1';
    
    let creditAmount = amount;
    if (options.unbalanced) {
      const diff = options.unbalanceAmount ?? 100;
      creditAmount = amount - diff;
    }

    lines = [
      {
        id: `line-${entryId}-1`,
        journal_entry_id: entryId,
        account_code: debitAcc,
        account_name: `Cuenta ${debitAcc}`,
        third_party_id: tpId,
        third_party_name: tpName,
        third_party_nit: tpNit,
        debit: roundCOP(amount),
        credit: 0,
        description: `${description} - Débito`,
      },
      {
        id: `line-${entryId}-2`,
        journal_entry_id: entryId,
        account_code: creditAcc,
        account_name: `Cuenta ${creditAcc}`,
        third_party_id: tpId,
        third_party_name: tpName,
        third_party_nit: tpNit,
        debit: 0,
        credit: roundCOP(creditAmount),
        description: `${description} - Crédito`,
      },
    ];
  }

  const total_debit = roundCOP(lines.reduce((sum, line) => sum + line.debit, 0));
  const total_credit = roundCOP(lines.reduce((sum, line) => sum + line.credit, 0));
  const is_balanced = compareCOP(total_debit, total_credit, 0.01);

  return {
    id: entryId,
    date: rawDate,
    period,
    voucher_type,
    voucher_number,
    description,
    state,
    created_by: 'system-test',
    created_at: new Date().toISOString(),
    lines,
    total_debit,
    total_credit,
    is_balanced,
  };
}

/**
 * Helper to generate a simple balanced transaction pair.
 */
export function generateBalancedEntryPair(
  accountDebit: string,
  accountCredit: string,
  amount: number,
  date = '2024-01-15',
  description = 'Asiento balanceado simple'
): MockJournalEntry {
  return generateMockTransaction({
    debitAccount: accountDebit,
    creditAccount: accountCredit,
    amount,
    date,
    description,
    unbalanced: false,
  });
}

/**
 * Generates a batch of mock transactions over a period.
 */
export function generateMockBatch(options: BatchGeneratorOptions = {}): MockJournalEntry[] {
  const count = options.count ?? 10;
  const startDateStr = options.startDate ?? '2024-01-01';
  const endDateStr = options.endDate ?? '2024-01-31';
  const startTs = new Date(startDateStr).getTime();
  const endTs = new Date(endDateStr).getTime();
  
  const entries: MockJournalEntry[] = [];
  const accounts = options.accounts ?? Object.values(STANDARD_MOCK_ACCOUNTS);
  const thirdParties = options.thirdParties ?? [
    { id: 'tp-101', name: 'Cliente Principal S.A.', nit: '800111222-3' },
    { id: 'tp-102', name: 'Proveedor Servicios Ltda', nit: '900333444-5' },
    { id: 'tp-103', name: 'Empleado Carlos Perez', nit: '1018222333' },
  ];

  for (let i = 0; i < count; i++) {
    const randomTime = startTs + Math.random() * (endTs - startTs);
    const dateStr = new Date(randomTime).toISOString().split('T')[0];
    const minAmt = options.minAmount ?? 50000;
    const maxAmt = options.maxAmount ?? 5000000;
    const rawAmt = minAmt + Math.random() * (maxAmt - minAmt);
    const amount = roundCOP(rawAmt);

    const debitAcc = accounts[Math.floor(Math.random() * accounts.length)];
    let creditAcc = accounts[Math.floor(Math.random() * accounts.length)];
    while (creditAcc === debitAcc && accounts.length > 1) {
      creditAcc = accounts[Math.floor(Math.random() * accounts.length)];
    }

    const tp = thirdParties[Math.floor(Math.random() * thirdParties.length)];
    const isUnbalanced = Boolean(options.allowUnbalanced && Math.random() < 0.1);

    entries.push(
      generateMockTransaction({
        date: dateStr,
        amount,
        debitAccount: debitAcc,
        creditAccount: creditAcc,
        third_party_id: tp.id,
        third_party_name: tp.name,
        third_party_nit: tp.nit,
        unbalanced: isUnbalanced,
        unbalanceAmount: isUnbalanced ? 50 : 0,
        description: `Transacción lote #${i + 1}`,
      })
    );
  }

  return entries;
}

/**
 * Validates double-entry balance requirement for a journal entry.
 */
export function validateTransactionBalance(entry: MockJournalEntry): { isBalanced: boolean; diff: number } {
  const totalDebit = roundCOP(entry.lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = roundCOP(entry.lines.reduce((s, l) => s + l.credit, 0));
  const diff = roundCOP(Math.abs(totalDebit - totalCredit));
  const isBalanced = diff <= 0.01;
  return { isBalanced, diff };
}

// ============================================================================
// 2. READ-ONLY DIRECTORY INTEGRITY CHECKER
// ============================================================================

export interface FileSnapshot {
  relativePath: string;
  fullPath: string;
  size: number;
  mtimeMs: number;
  hash: string;
}

export interface DirectorySnapshot {
  targetDir: string;
  capturedAt: string;
  fileCount: number;
  totalSizeBytes: number;
  files: Record<string, FileSnapshot>;
}

export interface IntegrityCheckResult {
  isIntact: boolean;
  addedFiles: string[];
  deletedFiles: string[];
  modifiedFiles: string[];
  errors: string[];
  summary: string;
}

/**
 * Default backup directory path specified in requirement R3 / ORIGINAL_REQUEST.md.
 */
export const DEFAULT_BACKUP_DIRECTORY = 'C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Contabilidad\\Backup';

/**
 * Computes SHA-256 hash of a file synchronously.
 */
function computeFileHash(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (err: any) {
    return `ERROR_HASHING: ${err.message}`;
  }
}

/**
 * Recursively scans directory and returns all file paths relative to rootDir.
 */
function getFilesRecursively(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, baseDir));
    } else if (item.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

/**
 * Returns the target backup directory path (or custom path).
 */
export function getBackupDirectoryPath(customPath?: string): string {
  return customPath || DEFAULT_BACKUP_DIRECTORY;
}

/**
 * Captures a complete snapshot of the target directory's files, sizes, mtimes, and SHA-256 hashes.
 */
export function createDirectorySnapshot(dirPath: string = DEFAULT_BACKUP_DIRECTORY): DirectorySnapshot {
  const targetDir = path.resolve(dirPath);
  const filesMap: Record<string, FileSnapshot> = {};
  let totalSize = 0;

  if (!fs.existsSync(targetDir)) {
    return {
      targetDir,
      capturedAt: new Date().toISOString(),
      fileCount: 0,
      totalSizeBytes: 0,
      files: {},
    };
  }

  const relativePaths = getFilesRecursively(targetDir);

  for (const relPath of relativePaths) {
    const fullPath = path.join(targetDir, relPath);
    try {
      const stat = fs.statSync(fullPath);
      const hash = computeFileHash(fullPath);
      totalSize += stat.size;

      filesMap[relPath] = {
        relativePath: relPath,
        fullPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash,
      };
    } catch {
      // Ignore transient file read errors if any
    }
  }

  return {
    targetDir,
    capturedAt: new Date().toISOString(),
    fileCount: Object.keys(filesMap).length,
    totalSizeBytes: totalSize,
    files: filesMap,
  };
}

/**
 * Compares current directory state against a previously captured snapshot to verify non-modification.
 */
export function verifyDirectoryIntegrity(snapshot: DirectorySnapshot): IntegrityCheckResult {
  const targetDir = snapshot.targetDir;
  const addedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(targetDir)) {
    if (snapshot.fileCount > 0) {
      return {
        isIntact: false,
        addedFiles: [],
        deletedFiles: Object.keys(snapshot.files),
        modifiedFiles: [],
        errors: [`Target directory no longer exists: ${targetDir}`],
        summary: `DIRECTORY REMOVED: ${targetDir}`,
      };
    }
    return {
      isIntact: true,
      addedFiles: [],
      deletedFiles: [],
      modifiedFiles: [],
      errors: [],
      summary: `Directory does not exist but snapshot was empty.`,
    };
  }

  const currentRelPaths = new Set(getFilesRecursively(targetDir));
  const snapshotRelPaths = new Set(Object.keys(snapshot.files));

  // Check for added files
  for (const relPath of currentRelPaths) {
    if (!snapshotRelPaths.has(relPath)) {
      addedFiles.push(relPath);
    }
  }

  // Check for deleted files
  for (const relPath of snapshotRelPaths) {
    if (!currentRelPaths.has(relPath)) {
      deletedFiles.push(relPath);
    }
  }

  // Check existing files for modifications
  for (const relPath of snapshotRelPaths) {
    if (currentRelPaths.has(relPath)) {
      const fullPath = path.join(targetDir, relPath);
      const snapFile = snapshot.files[relPath];
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size !== snapFile.size) {
          modifiedFiles.push(`${relPath} (size changed: ${snapFile.size} -> ${stat.size})`);
          continue;
        }

        const currentHash = computeFileHash(fullPath);
        if (currentHash !== snapFile.hash) {
          modifiedFiles.push(`${relPath} (content SHA256 hash changed)`);
        }
      } catch (err: any) {
        errors.push(`Failed to inspect file ${relPath}: ${err.message}`);
      }
    }
  }

  const isIntact = addedFiles.length === 0 && deletedFiles.length === 0 && modifiedFiles.length === 0 && errors.length === 0;

  const summary = isIntact
    ? `INTEGRITY PASSED: Target backup directory is untouched (${snapshot.fileCount} files verified).`
    : `INTEGRITY FAILED: ${addedFiles.length} added, ${deletedFiles.length} deleted, ${modifiedFiles.length} modified.`;

  return {
    isIntact,
    addedFiles,
    deletedFiles,
    modifiedFiles,
    errors,
    summary,
  };
}

/**
 * Asserts that the target backup directory has not been modified since the snapshot was taken.
 * Throws an explicit Error if integrity check fails.
 */
export function assertDirectoryUntouched(snapshot: DirectorySnapshot): void {
  const result = verifyDirectoryIntegrity(snapshot);
  if (!result.isIntact) {
    throw new Error(
      `READ-ONLY DIRECTORY INTEGRITY VIOLATION!\n` +
      `Target Directory: ${snapshot.targetDir}\n` +
      `Summary: ${result.summary}\n` +
      (result.addedFiles.length > 0 ? `Added Files: ${result.addedFiles.join(', ')}\n` : '') +
      (result.deletedFiles.length > 0 ? `Deleted Files: ${result.deletedFiles.join(', ')}\n` : '') +
      (result.modifiedFiles.length > 0 ? `Modified Files: ${result.modifiedFiles.join(', ')}\n` : '') +
      (result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}\n` : '')
    );
  }
}

// ============================================================================
// 3. PUC HIERARCHY ROLLUP UTILITY FUNCTIONS FOR TESTING
// ============================================================================

export type PUCAccountLevel = 1 | 2 | 3 | 4 | 5;

export interface PUCRollupItem {
  code: string;
  level: PUCAccountLevel;
  levelName: 'CLASE' | 'GRUPO' | 'CUENTA' | 'SUBCUENTA' | 'AUXILIAR';
  name: string;
  parentCode: string | null;
  debit: number;
  credit: number;
  initialBalance: number;
  finalBalance: number;
  nature: 'DEBIT' | 'CREDIT';
}

export interface PUCBalanceSummary {
  byCode: Record<string, PUCRollupItem>;
  byLevel: Record<PUCAccountLevel, PUCRollupItem[]>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

/**
 * Determines PUC account level based on code length.
 * 1 digit = 1 (Clase)
 * 2 digits = 2 (Grupo)
 * 4 digits = 3 (Cuenta)
 * 6 digits = 4 (Subcuenta)
 * 8+ digits = 5 (Auxiliar)
 */
export function getPUCAccountLevel(code: string): PUCAccountLevel {
  const cleanCode = code.trim().replace(/\D/g, '');
  const len = cleanCode.length;
  if (len <= 1) return 1;
  if (len === 2) return 2;
  if (len <= 4) return 3;
  if (len <= 6) return 4;
  return 5;
}

/**
 * Returns human-readable name for PUC account level.
 */
export function getPUCAccountLevelName(level: PUCAccountLevel): 'CLASE' | 'GRUPO' | 'CUENTA' | 'SUBCUENTA' | 'AUXILIAR' {
  switch (level) {
    case 1: return 'CLASE';
    case 2: return 'GRUPO';
    case 3: return 'CUENTA';
    case 4: return 'SUBCUENTA';
    case 5: return 'AUXILIAR';
  }
}

/**
 * Returns the immediate parent account code in the PUC hierarchy.
 */
export function getPUCParentCode(code: string): string | null {
  const cleanCode = code.trim().replace(/\D/g, '');
  const len = cleanCode.length;
  if (len <= 1) return null;
  if (len === 2) return cleanCode.substring(0, 1);
  if (len <= 4) return cleanCode.substring(0, 2);
  if (len <= 6) return cleanCode.substring(0, 4);
  return cleanCode.substring(0, 6);
}

/**
 * Determines standard nature ('DEBIT' or 'CREDIT') for a PUC account based on its Clase (first digit).
 * Clases 1, 5, 6, 7, 8 -> DEBIT
 * Clases 2, 3, 4, 9 -> CREDIT
 */
export function getPUCAccountNature(code: string): 'DEBIT' | 'CREDIT' {
  const firstDigit = code.trim().replace(/\D/g, '').charAt(0);
  switch (firstDigit) {
    case '1': // Activo
    case '5': // Gastos
    case '6': // Costos de Ventas
    case '7': // Costos de Producción
    case '8': // Cuentas de Orden Deudoras
      return 'DEBIT';
    case '2': // Pasivo
    case '3': // Patrimonio
    case '4': // Ingresos
    case '9': // Cuentas de Orden Acreedoras
      return 'CREDIT';
    default:
      return 'DEBIT';
  }
}

/**
 * Calculates net balance based on initial balance, debits, credits, and account nature.
 */
export function calculateNetBalance(
  code: string,
  debit: number,
  credit: number,
  initialBalance = 0
): number {
  const nature = getPUCAccountNature(code);
  if (nature === 'DEBIT') {
    return roundCOP(initialBalance + debit - credit);
  } else {
    return roundCOP(initialBalance + credit - debit);
  }
}

/**
 * Computes PUC hierarchy rollup aggregating balances dynamically from Auxiliaries up to Clase level.
 */
export function rollupPUCHierarchy(
  lines: Array<{ account_code: string; account_name?: string; debit: number; credit: number; initial_balance?: number }>
): PUCBalanceSummary {
  const byCode: Record<string, PUCRollupItem> = {};

  // Helper to ensure an account item exists in byCode
  const ensureItem = (code: string, name?: string): PUCRollupItem => {
    const cleanCode = code.trim().replace(/\D/g, '');
    if (!byCode[cleanCode]) {
      const level = getPUCAccountLevel(cleanCode);
      const levelName = getPUCAccountLevelName(level);
      const parentCode = getPUCParentCode(cleanCode);
      const nature = getPUCAccountNature(cleanCode);
      byCode[cleanCode] = {
        code: cleanCode,
        level,
        levelName,
        name: name || `Cuenta ${cleanCode}`,
        parentCode,
        debit: 0,
        credit: 0,
        initialBalance: 0,
        finalBalance: 0,
        nature,
      };
    }
    return byCode[cleanCode];
  };

  // 1. Process explicit inputs
  for (const line of lines) {
    const code = line.account_code.trim().replace(/\D/g, '');
    if (!code) continue;

    const deb = roundCOP(line.debit || 0);
    const cred = roundCOP(line.credit || 0);
    const initBal = roundCOP(line.initial_balance || 0);

    let currentCode: string | null = code;
    let isLeaf = true;

    while (currentCode) {
      const item = ensureItem(currentCode, isLeaf ? line.account_name : undefined);
      item.debit = roundCOP(item.debit + deb);
      item.credit = roundCOP(item.credit + cred);
      item.initialBalance = roundCOP(item.initialBalance + initBal);

      currentCode = getPUCParentCode(currentCode);
      isLeaf = false;
    }
  }

  // 2. Calculate final balance for each code
  for (const code in byCode) {
    const item = byCode[code];
    item.finalBalance = calculateNetBalance(item.code, item.debit, item.credit, item.initialBalance);
  }

  // 3. Group by level
  const byLevel: Record<PUCAccountLevel, PUCRollupItem[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  for (const code in byCode) {
    const item = byCode[code];
    byLevel[item.level].push(item);
  }

  // Sort each level by account code
  for (const lvl of [1, 2, 3, 4, 5] as PUCAccountLevel[]) {
    byLevel[lvl].sort((a, b) => a.code.localeCompare(b.code));
  }

  // 4. Calculate total debits/credits at Clase level (level 1)
  const totalDebit = roundCOP(byLevel[1].reduce((sum, item) => sum + item.debit, 0));
  const totalCredit = roundCOP(byLevel[1].reduce((sum, item) => sum + item.credit, 0));
  const isBalanced = compareCOP(totalDebit, totalCredit, 0.01);

  return {
    byCode,
    byLevel,
    totalDebit,
    totalCredit,
    isBalanced,
  };
}

/**
 * Applies annual closing resets for nominal accounts (Classes 4, 5, 6, 7 reset to zero balance).
 */
export function applyAnnualClosingResets(
  balances: Record<string, { debit: number; credit: number; balance: number }>
): Record<string, { debit: number; credit: number; balance: number }> {
  const result: Record<string, { debit: number; credit: number; balance: number }> = {};

  for (const code in balances) {
    const firstDigit = code.trim().replace(/\D/g, '').charAt(0);
    const isNominal = ['4', '5', '6', '7'].includes(firstDigit);
    if (isNominal) {
      result[code] = { debit: 0, credit: 0, balance: 0 };
    } else {
      result[code] = { ...balances[code] };
    }
  }

  return result;
}

// ============================================================================
// 4. FLOATING POINT COP COMPARISON HELPER (tolerance <= 0.01)
// ============================================================================

export const DEFAULT_COP_TOLERANCE = 0.01;

/**
 * Rounds a monetary amount in COP to 2 decimal places to prevent float precision errors.
 */
export function roundCOP(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Compares two COP numerical values with precision tolerance (default <= 0.01 COP).
 */
export function compareCOP(actual: number, expected: number, tolerance = DEFAULT_COP_TOLERANCE): boolean {
  const normActual = roundCOP(actual);
  const normExpected = roundCOP(expected);
  return Math.abs(normActual - normExpected) <= tolerance;
}

/**
 * Calculates absolute difference between two COP monetary values.
 */
export function diffCOP(actual: number, expected: number): number {
  return roundCOP(Math.abs(roundCOP(actual) - roundCOP(expected)));
}

/**
 * Asserts equality of two COP amounts within tolerance <= 0.01.
 * Throws a detailed error message if comparison fails.
 */
export function assertCOPEquals(
  actual: number,
  expected: number,
  tolerance = DEFAULT_COP_TOLERANCE,
  message?: string
): void {
  const isMatch = compareCOP(actual, expected, tolerance);
  if (!isMatch) {
    const diff = diffCOP(actual, expected);
    const defaultMsg = `COP Amount Mismatch: Actual ${actual} vs Expected ${expected} (Diff: ${diff}, Max Tolerance: ${tolerance})`;
    throw new Error(message ? `${message} -> ${defaultMsg}` : defaultMsg);
  }
}

export interface TrialBalanceRowMatch {
  code: string;
  field: string;
  generatedVal: number;
  expectedVal: number;
  diff: number;
}

export interface TrialBalanceComparisonResult {
  isMatch: boolean;
  mismatches: TrialBalanceRowMatch[];
  missingInGenerated: string[];
  missingInExpected: string[];
  summary: string;
}

/**
 * Compares a generated Trial Balance dataset against historical benchmark values within specified COP tolerance.
 */
export function compareTrialBalances(
  generated: Array<{ code: string; debit: number; credit: number; balance?: number }>,
  expected: Array<{ code: string; debit: number; credit: number; balance?: number }>,
  tolerance = DEFAULT_COP_TOLERANCE
): TrialBalanceComparisonResult {
  const mismatches: TrialBalanceRowMatch[] = [];
  const missingInGenerated: string[] = [];
  const missingInExpected: string[] = [];

  const genMap = new Map<string, { code: string; debit: number; credit: number; balance?: number }>();
  for (const g of generated) {
    genMap.set(g.code.trim(), g);
  }

  const expMap = new Map<string, { code: string; debit: number; credit: number; balance?: number }>();
  for (const e of expected) {
    expMap.set(e.code.trim(), e);
  }

  // Check expected accounts
  for (const [code, expRow] of expMap.entries()) {
    const genRow = genMap.get(code);
    if (!genRow) {
      missingInGenerated.push(code);
      continue;
    }

    if (!compareCOP(genRow.debit, expRow.debit, tolerance)) {
      mismatches.push({
        code,
        field: 'debit',
        generatedVal: genRow.debit,
        expectedVal: expRow.debit,
        diff: diffCOP(genRow.debit, expRow.debit),
      });
    }

    if (!compareCOP(genRow.credit, expRow.credit, tolerance)) {
      mismatches.push({
        code,
        field: 'credit',
        generatedVal: genRow.credit,
        expectedVal: expRow.credit,
        diff: diffCOP(genRow.credit, expRow.credit),
      });
    }

    if (expRow.balance !== undefined && genRow.balance !== undefined) {
      if (!compareCOP(genRow.balance, expRow.balance, tolerance)) {
        mismatches.push({
          code,
          field: 'balance',
          generatedVal: genRow.balance,
          expectedVal: expRow.balance,
          diff: diffCOP(genRow.balance, expRow.balance),
        });
      }
    }
  }

  // Check generated accounts missing in expected
  for (const code of genMap.keys()) {
    if (!expMap.has(code)) {
      missingInExpected.push(code);
    }
  }

  const isMatch = mismatches.length === 0 && missingInGenerated.length === 0 && missingInExpected.length === 0;
  const summary = isMatch
    ? `TRIAL BALANCE MATCH: All ${expMap.size} accounts matched within tolerance ${tolerance} COP.`
    : `TRIAL BALANCE MISMATCH: ${mismatches.length} field discrepancies, ${missingInGenerated.length} missing in generated, ${missingInExpected.length} unexpected accounts.`;

  return {
    isMatch,
    mismatches,
    missingInGenerated,
    missingInExpected,
    summary,
  };
}
