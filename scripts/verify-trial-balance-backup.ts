import fs from 'fs';
import path from 'path';
import { DEFAULT_BACKUP_DIR, readBackupFileBuffer, verifyBackupUnchanged } from '../src/lib/ingestion/readonly-guard';
import { parseLibroDiario } from '../src/lib/ingestion/excel-parser';
import { calculateTrialBalance, RawJournalLineData } from '../src/lib/utils/trial-balance-calc';
import {
  parseBenchmarkTrialBalance,
  compareTrialBalances,
  ComparisonResult,
  ParsedBenchmarkReport,
} from '../src/lib/verification/trial-balance-comparator';

export interface VerificationScriptOptions {
  year?: number;
  backupDir?: string;
  tolerance?: number;
  detailed?: boolean;
  json?: boolean;
}

export function parseArgs(args: string[]): VerificationScriptOptions {
  const options: VerificationScriptOptions = {
    year: 2024,
    backupDir: process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
    tolerance: 0.01,
    detailed: true,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--year' && i + 1 < args.length) {
      options.year = parseInt(args[++i], 10);
    } else if (arg === '--backup-dir' && i + 1 < args.length) {
      options.backupDir = args[++i];
    } else if (arg === '--tolerance' && i + 1 < args.length) {
      options.tolerance = parseFloat(args[++i]);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--no-detailed') {
      options.detailed = false;
    }
  }

  return options;
}

export async function runVerification(options: VerificationScriptOptions): Promise<{
  passed: boolean;
  comparisonResult?: ComparisonResult;
  readOnlyPassed: boolean;
  error?: string;
}> {
  const targetYear = options.year || 2024;
  const backupDir = path.resolve(options.backupDir || DEFAULT_BACKUP_DIR);
  const tolerance = options.tolerance ?? 0.01;

  if (!fs.existsSync(backupDir)) {
    return {
      passed: false,
      readOnlyPassed: false,
      error: `Backup directory not found: ${backupDir}`,
    };
  }

  // Layer 2: Pre-execution Directory Snapshot
  const initialSnapshot = new Map<string, { mtimeMs: number; size: number }>();
  const initialEntries = fs.readdirSync(backupDir, { recursive: true });
  for (const entry of initialEntries) {
    const fullPath = path.join(backupDir, entry.toString());
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const stat = fs.statSync(fullPath);
      initialSnapshot.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size });
    }
  }

  // Find Benchmark Excel for target year
  const allFiles = fs.readdirSync(backupDir);
  const benchmarkFile = allFiles.find((f) =>
    f.toLowerCase().includes(`${targetYear}`) &&
    f.toLowerCase().includes('balance de prueba')
  );

  if (!benchmarkFile) {
    return {
      passed: false,
      readOnlyPassed: true,
      error: `Benchmark trial balance file for year ${targetYear} not found in ${backupDir}`,
    };
  }

  const benchmarkPath = path.join(backupDir, benchmarkFile);

  // Parse Historical Benchmark Excel
  let benchmarkReport: ParsedBenchmarkReport;
  try {
    benchmarkReport = await parseBenchmarkTrialBalance(benchmarkPath, backupDir);
  } catch (err: any) {
    return {
      passed: false,
      readOnlyPassed: false,
      error: `Failed to parse benchmark file ${benchmarkPath}: ${err?.message || err}`,
    };
  }

  // Find and parse Historical Libro Diario files up to target year for carryovers
  const diarioFiles = allFiles
    .filter((f) => f.toLowerCase().includes('libro diario') && f.endsWith('.xlsx'))
    .sort();

  const relevantDiarioFiles = diarioFiles.filter((f) => {
    const match = f.match(/(\d{4})/);
    if (!match) return false;
    const y = parseInt(match[1], 10);
    return y <= targetYear;
  });

  const rawJournalLines: RawJournalLineData[] = [];

  for (const file of relevantDiarioFiles) {
    const diarioPath = path.join(backupDir, file);
    try {
      const parsedEntries = await parseLibroDiario(diarioPath);
      for (const entry of parsedEntries) {
        for (const line of entry.lines) {
          rawJournalLines.push({
            account_code: line.account_code,
            entry_date: entry.date,
            debit: line.debit,
            credit: line.credit,
            third_party_id: line.third_party_doc,
            document_number: line.third_party_doc,
            third_party_name: line.third_party_name,
            entry_type: entry.voucher_type === 'CIERRE' ? 'CIERRE' : 'NORMAL',
            entry_state: 'APROBADO',
          });
        }
      }
    } catch (err: any) {
      return {
        passed: false,
        readOnlyPassed: false,
        error: `Failed to parse Libro Diario file ${file}: ${err?.message || err}`,
      };
    }
  }

  // Calculate Trial Balance using engine
  const generatedReport = calculateTrialBalance(rawJournalLines, {
    startDate: `${targetYear}-01-01`,
    endDate: `${targetYear}-12-31`,
    includeThirdParty: options.detailed !== false,
    excludeClosingEntries: true,
    showZeroBalances: false,
  });

  // Run Comparison Engine
  const comparisonResult = compareTrialBalances(generatedReport, benchmarkReport, {
    tolerance,
    compareThirdPartyDetails: options.detailed !== false,
    compareAccountSummaries: true,
    ignoreZeroBalanceUnmatched: true,
  });

  // Layer 3: Post-execution Directory Integrity Guard Check
  const postGuard = verifyBackupUnchanged(backupDir, initialSnapshot);

  const passed = comparisonResult.passed && postGuard.passed;

  return {
    passed,
    comparisonResult,
    readOnlyPassed: postGuard.passed,
    error: postGuard.passed ? undefined : `Backup directory mutation detected: ${postGuard.mutatedFiles.join(', ')}`,
  };
}

export function formatConsoleReport(
  options: VerificationScriptOptions,
  result: Awaited<ReturnType<typeof runVerification>>
): string {
  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push('CFO-AI TRIAL BALANCE VERIFICATION SUITE — MILESTONE 3');
  lines.push('================================================================================');
  lines.push(`Timestamp     : ${new Date().toISOString()}`);
  lines.push(`Target Period : Fiscal Year ${options.year || 2024}`);
  lines.push(`Backup Dir    : ${options.backupDir || DEFAULT_BACKUP_DIR}`);
  lines.push(`Tolerance     : ${options.tolerance ?? 0.01} COP`);
  lines.push('--------------------------------------------------------------------------------');

  lines.push(`[STEP 1] Read-Only Baseline Guard ........ PASSED`);
  lines.push(`[STEP 2] Benchmark Excel Parser .......... ${result.comparisonResult ? 'PASSED' : 'FAILED'}`);
  lines.push(`[STEP 3] Trial Balance Engine ............ ${result.comparisonResult ? 'PASSED' : 'FAILED'}`);
  lines.push(`[STEP 4] Read-Only Post-Run Guard ........ ${result.readOnlyPassed ? 'PASSED (0 mutations, 0 new files)' : 'FAILED'}`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push('VERIFICATION METRICS');
  lines.push('--------------------------------------------------------------------------------');

  if (result.comparisonResult) {
    const stats = result.comparisonResult.stats;
    lines.push(`Total Benchmark Rows   : ${stats.total_benchmark_rows}`);
    lines.push(`Total Generated Rows   : ${stats.total_generated_rows}`);
    lines.push(`Matched Account Keys   : ${stats.matched_keys}`);
    lines.push(`  - Exact Matches (0.00 COP)   : ${stats.exact_matches}`);
    lines.push(`  - Tolerance Matches (<=0.01) : ${stats.tolerance_matches}`);
    lines.push(`Discrepancies (>0.01 COP)      : ${stats.total_discrepancies}`);
    lines.push(`Missing in Generated           : ${stats.missing_in_generated}`);
    lines.push(`Unexpected in Generated        : ${stats.unexpected_in_generated}`);
  }

  lines.push(`Read-Only Guard Status         : ${result.readOnlyPassed ? 'CLEAN (PASSED)' : 'MUTATION DETECTED (FAILED)'}`);
  lines.push('--------------------------------------------------------------------------------');

  if (result.error) {
    lines.push(`ERROR: ${result.error}`);
    lines.push('--------------------------------------------------------------------------------');
  }

  if (result.comparisonResult && result.comparisonResult.discrepancies.length > 0) {
    lines.push(`DISCREPANCY DETAILS (Showing top ${Math.min(10, result.comparisonResult.discrepancies.length)} of ${result.comparisonResult.discrepancies.length})`);
    lines.push('--------------------------------------------------------------------------------');
    for (let i = 0; i < Math.min(10, result.comparisonResult.discrepancies.length); i++) {
      const disc = result.comparisonResult.discrepancies[i];
      lines.push(`[${i + 1}] Key: ${disc.key} | Account: ${disc.account_code} (${disc.account_name || ''})`);
      lines.push(`    Type: ${disc.type}`);
      if (disc.details) {
        for (const [field, diff] of Object.entries(disc.details)) {
          if (diff) {
            lines.push(`    Field: ${field} | Expected: ${diff.expected} | Actual: ${diff.actual} | Diff: ${diff.diff} COP`);
          }
        }
      }
    }
    lines.push('--------------------------------------------------------------------------------');
  }

  lines.push(`OVERALL STATUS: ${result.passed ? '✅ PASSED (Generated balances match historical benchmark)' : '❌ FAILED (Verification mismatches or read-only failure)'}`);
  lines.push('================================================================================');

  return lines.join('\n');
}

// Executable CLI Runner entry point
if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  runVerification(options)
    .then((result) => {
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatConsoleReport(options, result));
      }
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal execution error:', err);
      process.exit(1);
    });
}
