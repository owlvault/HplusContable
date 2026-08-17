import ExcelJS from 'exceljs';
import { withReadOnlyGuard } from '../ingestion/readonly-guard';
import { TrialBalanceReport, TrialBalanceItem } from '../utils/trial-balance-calc';

export interface BenchmarkTrialBalanceRow {
  account_code: string;
  account_name: string;
  document_number?: string | null;
  third_party_name?: string | null;
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;
  level?: number;
  is_third_party_detail?: boolean;
}

export interface ParsedBenchmarkReport {
  filePath?: string;
  fiscalYear?: number;
  period?: string;
  rows: BenchmarkTrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isControlBalanced: boolean;
}

export interface ComparisonOptions {
  /** Numerical float tolerance threshold in COP (default: 0.01) */
  tolerance?: number;
  /** Whether to compare third-party detail rows (default: true) */
  compareThirdPartyDetails?: boolean;
  /** Whether to compare account summary rows (default: true) */
  compareAccountSummaries?: boolean;
  /** Ignore unexpected 0-balance rows in generated data (default: true) */
  ignoreZeroBalanceUnmatched?: boolean;
  /** Specific account levels to inspect, e.g. [1, 2, 3, 4, 5] (default: all) */
  accountLevels?: number[];
}

export type DiscrepancyType =
  | 'MISSING_IN_GENERATED'
  | 'UNEXPECTED_IN_GENERATED'
  | 'SALDO_INICIAL_MISMATCH'
  | 'DEBITO_MISMATCH'
  | 'CREDITO_MISMATCH'
  | 'SALDO_FINAL_MISMATCH'
  | 'TOTALS_MISMATCH';

export interface FieldDiff {
  expected: number; // Value from Benchmark Excel
  actual: number;   // Value from Generated Trial Balance
  diff: number;     // actual - expected
}

export interface Discrepancy {
  key: string;
  account_code: string;
  account_name?: string;
  document_number?: string | null;
  third_party_name?: string | null;
  type: DiscrepancyType;
  details: {
    saldo_inicial?: FieldDiff;
    debito?: FieldDiff;
    credito?: FieldDiff;
    saldo_final?: FieldDiff;
  };
}

export interface MatchStats {
  total_benchmark_rows: number;
  total_generated_rows: number;
  matched_keys: number;
  exact_matches: number;
  tolerance_matches: number;
  mismatched_rows: number;
  missing_in_generated: number;
  unexpected_in_generated: number;
  total_discrepancies: number;
}

export interface ComparisonResult {
  passed: boolean;
  tolerance: number;
  stats: MatchStats;
  discrepancies: Discrepancy[];
  totals_comparison?: {
    expected: { total_debito: number; total_credito: number };
    actual: { total_debito: number; total_credito: number };
    passed: boolean;
  };
}

function getCellValueString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue instanceof Date) return cellValue.toISOString();
    if (cellValue.result !== undefined && cellValue.result !== null) return getCellValueString(cellValue.result);
    if (cellValue.text !== undefined) return cellValue.text.toString();
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((rt: any) => rt.text || '').join('');
    }
  }
  return String(cellValue).trim();
}

function parseNumericCell(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  let str = getCellValueString(val);
  if (!str) return 0;

  str = str.replace(/[$]/g, '').replace(/\u00A0/g, ' ').trim();
  if (!str) return 0;

  let isNegative = false;
  if (str.includes('(') && str.includes(')')) {
    isNegative = true;
    str = str.replace(/[()]/g, '').trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1).trim();
  }

  str = str.replace(/\s+/g, '');
  if (!str) return 0;

  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  if (dotCount > 1) {
    str = str.replace(/\./g, '');
    if (commaCount > 0) {
      str = str.replace(',', '.');
    }
  } else if (commaCount > 1) {
    str = str.replace(/,/g, '');
  } else if (dotCount === 1 && commaCount === 1) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (dotCount === 1 && commaCount === 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  } else if (commaCount === 1 && dotCount === 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (isNegative) num = -num;

  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function normalizeHeaderString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Normalizes account codes by trimming and stripping non-alphanumeric punctuation.
 */
export function normalizeAccountCode(code: string): string {
  if (!code) return '';
  return code.trim().replace(/[^\w]/g, '');
}

/**
 * Normalizes document numbers / NITs by uppercasing and stripping non-alphanumeric formatting characters.
 */
export function normalizeDocumentNumber(doc?: string | null): string {
  if (!doc) return '0';
  const trimmed = doc.trim();
  if (trimmed === '' || trimmed === '0' || trimmed.toUpperCase() === 'GENERAL' || trimmed.toUpperCase() === 'CUANTIAS MENORES') {
    return '0';
  }
  const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean || '0';
}

/**
 * Constructs a unique composite key for summary or detail row matching.
 * Includes third party name in key for generic document numbers to prevent key collisions.
 */
export function buildCompositeKey(
  accountCode: string,
  docNum?: string | null,
  isDetail?: boolean,
  thirdPartyName?: string | null
): string {
  const code = normalizeAccountCode(accountCode);
  const normDoc = normalizeDocumentNumber(docNum);

  if (isDetail || (docNum && normDoc !== '0' && normDoc !== code)) {
    if (normDoc === '0') {
      const normName = thirdPartyName
        ? thirdPartyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
        : '';
      return normName ? `TP::${code}::0::${normName}` : `TP::${code}::0`;
    }
    return `TP::${code}::${normDoc}`;
  }
  return `ACC::${code}`;
}

interface BenchmarkHeaderMapping {
  codigo: number;
  nombreCuenta: number;
  identificacion: number;
  terceroNombre: number;
  saldoInicial: number;
  debito: number;
  credito: number;
  saldoFinal: number;
}

function detectBenchmarkHeaderRow(worksheet: ExcelJS.Worksheet): { headerRowNumber: number; mapping: BenchmarkHeaderMapping } | null {
  const maxRowsToScan = Math.min(30, worksheet.rowCount);

  for (let r = 1; r <= maxRowsToScan; r++) {
    const row = worksheet.getRow(r);
    let codigoIdx = -1;
    let nombreCuentaIdx = -1;
    let identificacionIdx = -1;
    let terceroNombreIdx = -1;
    let saldoInicialIdx = -1;
    let debitoIdx = -1;
    let creditoIdx = -1;
    let saldoFinalIdx = -1;

    row.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
      const val = normalizeHeaderString(getCellValueString(cell.value));
      if (!val) return;

      if (val.includes('codigo') || val.includes('cod. cuenta') || (val.includes('cuenta') && !val.includes('nombre') && !val.includes('descripcion'))) {
        if (codigoIdx === -1) codigoIdx = colNumber;
      } else if (val.includes('nombre cuenta') || val.includes('descripcion cuenta') || val === 'nombre' || val === 'descripcion' || val.includes('concepto')) {
        if (nombreCuentaIdx === -1) nombreCuentaIdx = colNumber;
      } else if (val.includes('identificacion') || val.includes('nit') || val.includes('documento') || val.includes('cedula') || val.includes('tercero')) {
        if (val.includes('nombre tercero') || val.includes('razon social')) {
          if (terceroNombreIdx === -1) terceroNombreIdx = colNumber;
        } else {
          if (identificacionIdx === -1) identificacionIdx = colNumber;
        }
      } else if (val.includes('inicial') || val.includes('anterior')) {
        if (saldoInicialIdx === -1) saldoInicialIdx = colNumber;
      } else if (val.includes('debito') || val.includes('debitos') || val === 'debit') {
        if (debitoIdx === -1) debitoIdx = colNumber;
      } else if (val.includes('credito') || val.includes('creditos') || val === 'credit') {
        if (creditoIdx === -1) creditoIdx = colNumber;
      } else if (val.includes('final') || val.includes('nuevo saldo')) {
        if (saldoFinalIdx === -1) saldoFinalIdx = colNumber;
      }
    });

    const hasDebitOrCredit = debitoIdx !== -1 || creditoIdx !== -1;
    const hasAccountOrCode = codigoIdx !== -1 || nombreCuentaIdx !== -1;

    if (hasDebitOrCredit && hasAccountOrCode) {
      return {
        headerRowNumber: r,
        mapping: {
          codigo: codigoIdx !== -1 ? codigoIdx : 1,
          nombreCuenta: nombreCuentaIdx !== -1 ? nombreCuentaIdx : 2,
          identificacion: identificacionIdx !== -1 ? identificacionIdx : 3,
          terceroNombre: terceroNombreIdx !== -1 ? terceroNombreIdx : (identificacionIdx !== -1 ? identificacionIdx : 3),
          saldoInicial: saldoInicialIdx !== -1 ? saldoInicialIdx : 4,
          debito: debitoIdx !== -1 ? debitoIdx : 5,
          credito: creditoIdx !== -1 ? creditoIdx : 6,
          saldoFinal: saldoFinalIdx !== -1 ? saldoFinalIdx : 7,
        },
      };
    }
  }

  return null;
}

/**
 * Parses an Excel Buffer containing a benchmark trial balance report (`Balance de prueba por tercero-*.xlsx`).
 */
export async function parseBenchmarkTrialBalanceBuffer(
  buffer: Buffer,
  filePath?: string
): Promise<ParsedBenchmarkReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  let worksheet = workbook.worksheets[0];
  for (const ws of workbook.worksheets) {
    if (ws.name.toUpperCase().includes('BALANCE') || ws.name.toUpperCase().includes('PRUEBA')) {
      worksheet = ws;
      break;
    }
  }

  if (!worksheet) {
    return {
      filePath,
      rows: [],
      totalDebit: 0,
      totalCredit: 0,
      isControlBalanced: true,
    };
  }

  const headerInfo = detectBenchmarkHeaderRow(worksheet);

  let startRow = 2;
  let mapping: BenchmarkHeaderMapping = {
    codigo: 1,
    nombreCuenta: 2,
    identificacion: 3,
    terceroNombre: 3,
    saldoInicial: 4,
    debito: 5,
    credito: 6,
    saldoFinal: 7,
  };

  if (headerInfo) {
    startRow = headerInfo.headerRowNumber + 1;
    mapping = headerInfo.mapping;
  }

  const rows: BenchmarkTrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let r = startRow; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const getCellVal = (colIdx: number) => (colIdx > 0 ? row.getCell(colIdx).value : null);

    const rawCodigo = getCellVal(mapping.codigo);
    const rawNombre = getCellVal(mapping.nombreCuenta);
    const rawDoc = getCellVal(mapping.identificacion);
    const rawTerceroNombre = getCellVal(mapping.terceroNombre);
    const rawSaldoInicial = getCellVal(mapping.saldoInicial);
    const rawDebito = getCellVal(mapping.debito);
    const rawCredito = getCellVal(mapping.credito);
    const rawSaldoFinal = getCellVal(mapping.saldoFinal);

    const strCodigo = getCellValueString(rawCodigo).replace(/[^\w]/g, '').trim();
    const strNombre = getCellValueString(rawNombre).trim();
    const strDoc = getCellValueString(rawDoc).trim();
    const strTercero = getCellValueString(rawTerceroNombre).trim();

    const rowText = normalizeHeaderString(`${strCodigo} ${strNombre} ${strDoc}`);
    if (rowText.includes('total') || rowText.includes('sumas iguales') || rowText.includes('van') || rowText.includes('vienen')) {
      continue;
    }

    const saldo_inicial = parseNumericCell(rawSaldoInicial);
    const debito = parseNumericCell(rawDebito);
    const credito = parseNumericCell(rawCredito);
    const saldo_final = parseNumericCell(rawSaldoFinal);

    if (!strCodigo && saldo_inicial === 0 && debito === 0 && credito === 0 && saldo_final === 0) {
      continue;
    }

    const codeLen = strCodigo.length;
    let level = 5;
    if (codeLen === 1) level = 1;
    else if (codeLen === 2) level = 2;
    else if (codeLen <= 4) level = 3;
    else if (codeLen <= 6) level = 4;
    else level = 5;

    const isThirdPartyDetail =
      (!!strDoc && strDoc !== '0' && strDoc !== strCodigo) || (codeLen >= 8 && !!strDoc);

    rows.push({
      account_code: strCodigo,
      account_name: strNombre || `Cuenta ${strCodigo}`,
      document_number: strDoc || null,
      third_party_name: strTercero || strNombre || null,
      saldo_inicial,
      debito,
      credito,
      saldo_final,
      level,
      is_third_party_detail: isThirdPartyDetail,
    });

    if (level === 1 && !isThirdPartyDetail) {
      totalDebit = Math.round((totalDebit + debito) * 100) / 100;
      totalCredit = Math.round((totalCredit + credito) * 100) / 100;
    }
  }

  // Extract year from filename if available
  let fiscalYear: number | undefined;
  if (filePath) {
    const match = filePath.match(/(\d{4})/);
    if (match) {
      fiscalYear = parseInt(match[1], 10);
    }
  }

  return {
    filePath,
    fiscalYear,
    rows,
    totalDebit,
    totalCredit,
    isControlBalanced: Math.abs(totalDebit - totalCredit) <= 0.01,
  };
}

/**
 * Safely parses a historical trial balance Excel file using the read-only infrastructure guard.
 */
export async function parseBenchmarkTrialBalance(
  filePath: string,
  customBackupDir?: string
): Promise<ParsedBenchmarkReport> {
  return withReadOnlyGuard(filePath, async (buffer: Buffer) => {
    return parseBenchmarkTrialBalanceBuffer(buffer, filePath);
  }, customBackupDir);
}

/**
 * Programmatically compares generated trial balance report against historical benchmark rows.
 */
export function compareTrialBalances(
  generatedInput: TrialBalanceReport | TrialBalanceItem[],
  benchmarkInput: BenchmarkTrialBalanceRow[] | ParsedBenchmarkReport,
  options?: ComparisonOptions
): ComparisonResult {
  const tolerance = options?.tolerance ?? 0.01;
  const compareThirdPartyDetails = options?.compareThirdPartyDetails ?? true;
  const compareAccountSummaries = options?.compareAccountSummaries ?? true;
  const ignoreZeroBalanceUnmatched = options?.ignoreZeroBalanceUnmatched ?? true;
  const allowedLevels = options?.accountLevels;

  const generatedItems: TrialBalanceItem[] = Array.isArray(generatedInput)
    ? generatedInput
    : generatedInput.items;

  const benchmarkRows: BenchmarkTrialBalanceRow[] = Array.isArray(benchmarkInput)
    ? benchmarkInput
    : benchmarkInput.rows;

  const benchmarkMap = new Map<string, BenchmarkTrialBalanceRow>();
  for (const bRow of benchmarkRows) {
    const isDetail = !!bRow.is_third_party_detail;
    if (isDetail && !compareThirdPartyDetails) continue;
    if (!isDetail && !compareAccountSummaries) continue;
    if (allowedLevels && bRow.level && !allowedLevels.includes(bRow.level)) continue;

    const key = buildCompositeKey(
      bRow.account_code,
      bRow.document_number,
      isDetail,
      bRow.third_party_name
    );
    benchmarkMap.set(key, bRow);
  }

  const generatedMap = new Map<string, TrialBalanceItem>();
  for (const gItem of generatedItems) {
    const isDetail = !!gItem.third_party_id;
    if (isDetail && !compareThirdPartyDetails) continue;
    if (!isDetail && !compareAccountSummaries) continue;
    if (allowedLevels && !allowedLevels.includes(gItem.level)) continue;

    const key = buildCompositeKey(
      gItem.code,
      gItem.document_number,
      isDetail,
      gItem.third_party_name || gItem.third_party_id
    );
    generatedMap.set(key, gItem);
  }

  const allKeys = new Set<string>([...benchmarkMap.keys(), ...generatedMap.keys()]);

  const discrepancies: Discrepancy[] = [];
  let matched_keys = 0;
  let exact_matches = 0;
  let tolerance_matches = 0;
  let mismatched_rows = 0;
  let missing_in_generated = 0;
  let unexpected_in_generated = 0;

  const isWithinTolerance = (val1: number, val2: number): boolean => {
    return Math.abs(val1 - val2) <= tolerance + 1e-9;
  };

  const roundCOP = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

  for (const key of allKeys) {
    const bench = benchmarkMap.get(key);
    const gen = generatedMap.get(key);

    if (bench && gen) {
      matched_keys++;

      const initMatch = isWithinTolerance(gen.saldo_inicial, bench.saldo_inicial);
      const debMatch = isWithinTolerance(gen.debito, bench.debito);
      const credMatch = isWithinTolerance(gen.credito, bench.credito);
      const finalMatch = isWithinTolerance(gen.saldo_final, bench.saldo_final);

      if (initMatch && debMatch && credMatch && finalMatch) {
        const initDiff = Math.abs(gen.saldo_inicial - bench.saldo_inicial);
        const debDiff = Math.abs(gen.debito - bench.debito);
        const credDiff = Math.abs(gen.credito - bench.credito);
        const finalDiff = Math.abs(gen.saldo_final - bench.saldo_final);

        if (initDiff < 1e-6 && debDiff < 1e-6 && credDiff < 1e-6 && finalDiff < 1e-6) {
          exact_matches++;
        } else {
          tolerance_matches++;
        }
      } else {
        mismatched_rows++;

        const fieldDetails: Discrepancy['details'] = {};
        let primaryType: DiscrepancyType | null = null;

        if (!initMatch) {
          if (!primaryType) primaryType = 'SALDO_INICIAL_MISMATCH';
          fieldDetails.saldo_inicial = {
            expected: bench.saldo_inicial,
            actual: gen.saldo_inicial,
            diff: roundCOP(gen.saldo_inicial - bench.saldo_inicial),
          };
        }
        if (!debMatch) {
          if (!primaryType) primaryType = 'DEBITO_MISMATCH';
          fieldDetails.debito = {
            expected: bench.debito,
            actual: gen.debito,
            diff: roundCOP(gen.debito - bench.debito),
          };
        }
        if (!credMatch) {
          if (!primaryType) primaryType = 'CREDITO_MISMATCH';
          fieldDetails.credito = {
            expected: bench.credito,
            actual: gen.credito,
            diff: roundCOP(gen.credito - bench.credito),
          };
        }
        if (!finalMatch) {
          if (!primaryType) primaryType = 'SALDO_FINAL_MISMATCH';
          fieldDetails.saldo_final = {
            expected: bench.saldo_final,
            actual: gen.saldo_final,
            diff: roundCOP(gen.saldo_final - bench.saldo_final),
          };
        }

        discrepancies.push({
          key,
          account_code: bench.account_code,
          account_name: bench.account_name,
          document_number: bench.document_number,
          third_party_name: bench.third_party_name,
          type: primaryType || 'SALDO_FINAL_MISMATCH',
          details: fieldDetails,
        });
      }
    } else if (bench && !gen) {
      const isZeroBalance =
        Math.abs(bench.saldo_inicial) <= tolerance + 1e-9 &&
        Math.abs(bench.debito) <= tolerance + 1e-9 &&
        Math.abs(bench.credito) <= tolerance + 1e-9 &&
        Math.abs(bench.saldo_final) <= tolerance + 1e-9;

      if (isZeroBalance && ignoreZeroBalanceUnmatched) {
        continue;
      }

      missing_in_generated++;
      discrepancies.push({
        key,
        account_code: bench.account_code,
        account_name: bench.account_name,
        document_number: bench.document_number,
        third_party_name: bench.third_party_name,
        type: 'MISSING_IN_GENERATED',
        details: {
          saldo_inicial: { expected: bench.saldo_inicial, actual: 0, diff: -bench.saldo_inicial },
          debito: { expected: bench.debito, actual: 0, diff: -bench.debito },
          credito: { expected: bench.credito, actual: 0, diff: -bench.credito },
          saldo_final: { expected: bench.saldo_final, actual: 0, diff: -bench.saldo_final },
        },
      });
    } else if (!bench && gen) {
      const isZeroBalance =
        Math.abs(gen.saldo_inicial) <= tolerance + 1e-9 &&
        Math.abs(gen.debito) <= tolerance + 1e-9 &&
        Math.abs(gen.credito) <= tolerance + 1e-9 &&
        Math.abs(gen.saldo_final) <= tolerance + 1e-9;

      if (isZeroBalance && ignoreZeroBalanceUnmatched) {
        continue;
      }

      unexpected_in_generated++;
      discrepancies.push({
        key,
        account_code: gItemCode(gen),
        account_name: gen.name,
        document_number: gen.document_number,
        third_party_name: gen.third_party_name,
        type: 'UNEXPECTED_IN_GENERATED',
        details: {
          saldo_inicial: { expected: 0, actual: gen.saldo_inicial, diff: gen.saldo_inicial },
          debito: { expected: 0, actual: gen.debito, diff: gen.debito },
          credito: { expected: 0, actual: gen.credito, diff: gen.credito },
          saldo_final: { expected: 0, actual: gen.saldo_final, diff: gen.saldo_final },
        },
      });
    }
  }

  const total_discrepancies = discrepancies.length;
  const passed = total_discrepancies === 0;

  const stats: MatchStats = {
    total_benchmark_rows: benchmarkMap.size,
    total_generated_rows: generatedMap.size,
    matched_keys,
    exact_matches,
    tolerance_matches,
    mismatched_rows,
    missing_in_generated,
    unexpected_in_generated,
    total_discrepancies,
  };

  let totals_comparison: ComparisonResult['totals_comparison'] | undefined;
  if (!Array.isArray(generatedInput) && generatedInput.totals && !Array.isArray(benchmarkInput) && benchmarkInput.totalDebit !== undefined) {
    const expected = { total_debito: benchmarkInput.totalDebit, total_credito: benchmarkInput.totalCredit };
    const actual = { total_debito: generatedInput.totals.total_debito, total_credito: generatedInput.totals.total_credito };
    const totalsPassed = isWithinTolerance(actual.total_debito, expected.total_debito) && isWithinTolerance(actual.total_credito, expected.total_credito);
    totals_comparison = {
      expected,
      actual,
      passed: totalsPassed,
    };
  }

  return {
    passed,
    tolerance,
    stats,
    discrepancies,
    totals_comparison,
  };
}

function gItemCode(item: TrialBalanceItem): string {
  return item.code;
}
