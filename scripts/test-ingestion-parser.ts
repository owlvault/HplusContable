import fs from 'fs';
import path from 'path';
import { parseLibroDiario } from '../src/lib/ingestion/excel-parser';
import { verifyBackupUnchanged, DEFAULT_BACKUP_DIR } from '../src/lib/ingestion/readonly-guard';

async function main() {
  console.log('=== CFO-AI Ingestion Engine Verification Script ===');

  const backupDir = process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
  console.log(`Target Backup Directory: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    console.error(`Error: Backup directory does not exist: ${backupDir}`);
    process.exit(1);
  }

  // Find all [YEAR] Libro diario-*.xlsx files
  const files = fs.readdirSync(backupDir).filter((f) => f.includes('Libro diario') && f.endsWith('.xlsx'));

  if (files.length === 0) {
    console.warn(`Warning: No "Libro diario" Excel files found in ${backupDir}. Searching for any .xlsx file...`);
    const allXlsx = fs.readdirSync(backupDir).filter((f) => f.endsWith('.xlsx'));
    if (allXlsx.length === 0) {
      console.error(`Error: No .xlsx files found in backup directory.`);
      process.exit(1);
    }
    files.push(...allXlsx);
  }

  console.log(`Found ${files.length} Excel file(s) to verify.`);

  // Take snapshot of file timestamps before parsing
  const fileSnapshots = new Map<string, { mtimeMs: number; size: number }>();
  for (const file of files) {
    const fullPath = path.join(backupDir, file);
    const stat = fs.statSync(fullPath);
    fileSnapshots.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size });
  }

  let totalEntriesCount = 0;
  let totalLinesCount = 0;
  let totalDebitsOverall = 0;
  let totalCreditsOverall = 0;
  let hasErrors = false;

  for (const file of files) {
    const fullPath = path.join(backupDir, file);
    console.log(`\nParsing: ${file}...`);

    try {
      const startTime = Date.now();
      const entries = await parseLibroDiario(fullPath);
      const elapsed = Date.now() - startTime;

      console.log(`  Parsed ${entries.length} journal entry(ies) in ${elapsed} ms.`);

      let fileDebits = 0;
      let fileCredits = 0;
      let fileLines = 0;
      let unbalancedCount = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        fileLines += entry.lines.length;
        fileDebits += Math.round(entry.total_debit * 100);
        fileCredits += Math.round(entry.total_credit * 100);

        if (!entry.is_balanced) {
          unbalancedCount++;
          console.warn(
            `  [Warning] Entry #${i + 1} (${entry.voucher_type}-${entry.voucher_number}) is unbalanced! Debits: ${entry.total_debit}, Credits: ${entry.total_credit}`
          );
        }
      }

      const fileDebitsRounded = fileDebits / 100;
      const fileCreditsRounded = fileCredits / 100;

      totalEntriesCount += entries.length;
      totalLinesCount += fileLines;
      totalDebitsOverall += fileDebits;
      totalCreditsOverall += fileCredits;

      console.log(`  File Summary: ${fileLines} lines, Debits = $${fileDebitsRounded.toLocaleString()}, Credits = $${fileCreditsRounded.toLocaleString()}`);

      const batchImbalanceCents = Math.abs(fileDebits - fileCredits);
      if (batchImbalanceCents > 1) {
        console.error(`  [ERROR] File batch imbalance exceeded tolerance (0.01 COP): Delta = $${(batchImbalanceCents / 100).toFixed(2)}`);
        hasErrors = true;
      } else {
        console.log(`  [PASS] Double-entry balance check passed (Delta <= 0.01 COP).`);
      }
    } catch (err: any) {
      console.error(`  [ERROR] Failed to parse file ${file}: ${err?.message || err}`);
      hasErrors = true;
    }
  }

  // Verify read-only safety (post-flight check)
  console.log('\n--- Verifying Read-Only Directory Integrity ---');
  let readOnlyPassed = true;
  for (const [fullPath, snap] of fileSnapshots.entries()) {
    const check = verifyBackupUnchanged(fullPath, fileSnapshots);
    if (!check.passed) {
      readOnlyPassed = false;
      console.error(`[CRITICAL] File mutation detected in backup directory: ${fullPath}`);
    }
  }

  if (readOnlyPassed) {
    console.log('[PASS] Backup directory zero-mutation check verified successfully.');
  } else {
    hasErrors = true;
  }

  console.log('\n================ VERIFICATION SUMMARY ================');
  console.log(`Total Entries Parsed: ${totalEntriesCount}`);
  console.log(`Total Lines Parsed: ${totalLinesCount}`);
  console.log(`Overall Batch Debits: $${(totalDebitsOverall / 100).toLocaleString()}`);
  console.log(`Overall Batch Credits: $${(totalCreditsOverall / 100).toLocaleString()}`);
  console.log(`Status: ${hasErrors ? 'FAILED' : 'SUCCESS'}`);
  console.log('======================================================');

  if (hasErrors) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
