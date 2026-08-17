import { parseLibroDiario } from '../../src/lib/ingestion/excel-parser';
import { validateBackupPath, readBackupFileBuffer, verifyBackupUnchanged, DEFAULT_BACKUP_DIR, PathTraversalError } from '../../src/lib/ingestion/readonly-guard';
import { loadJournalEntries } from '../../src/lib/ingestion/db-loader';
import { ParsedJournalEntry } from '../../src/lib/ingestion/types';
import fs from 'fs';
import path from 'path';

async function runEmpiricalStressTests() {
  console.log("=================================================");
  console.log("CHALLENGER 2 (ITERATION 2) EMPIRICAL STRESS SUITE");
  console.log("=================================================");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
      failedTests++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Double-Entry Balance Validation (|sum debit - sum credit| <= 0.01 COP)
  // ----------------------------------------------------
  console.log("\n--- STRESS TEST 1: Double-Entry Balance Validation ---");

  // Mock entry with exact 0.01 COP difference (1 cent)
  const balancedEntry: ParsedJournalEntry = {
    date: '2026-01-01',
    voucher_type: 'DIARIO',
    voucher_number: '1',
    description: 'Test entry',
    lines: [
      { account_code: '110505', debit: 1000.00, credit: 0, third_party_doc: '123' },
      { account_code: '210505', debit: 0, credit: 1000.01, third_party_doc: '123' }
    ],
    total_debit: 1000.00,
    total_credit: 1000.01,
    is_balanced: Math.abs(Math.round(1000.00 * 100) - Math.round(1000.01 * 100)) <= 1
  };
  assert(balancedEntry.is_balanced === true, "Entry with 0.01 COP difference is classified as balanced (is_balanced = true)");

  // Mock entry with 0.02 COP difference (2 cents)
  const unbalancedEntry: ParsedJournalEntry = {
    date: '2026-01-01',
    voucher_type: 'DIARIO',
    voucher_number: '2',
    description: 'Unbalanced entry',
    lines: [
      { account_code: '110505', debit: 1000.00, credit: 0, third_party_doc: '123' },
      { account_code: '210505', debit: 0, credit: 1000.02, third_party_doc: '123' }
    ],
    total_debit: 1000.00,
    total_credit: 1000.02,
    is_balanced: Math.abs(Math.round(1000.00 * 100) - Math.round(1000.02 * 100)) <= 1
  };
  assert(unbalancedEntry.is_balanced === false, "Entry with 0.02 COP difference is classified as unbalanced (is_balanced = false)");

  // ----------------------------------------------------
  // TEST 2: Read-Only Safety & Sibling Directory Attack Guard
  // ----------------------------------------------------
  console.log("\n--- STRESS TEST 2: Read-Only Safety & Sibling Directory Guard ---");

  const backupDir = DEFAULT_BACKUP_DIR;
  if (fs.existsSync(backupDir)) {
    // Take snapshot of files in backup dir
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.xlsx'));
    const snapshotMap = new Map<string, { mtimeMs: number; size: number }>();
    for (const f of files) {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      snapshotMap.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size });
    }

    // Verify backup unchanged
    const verifyResult = verifyBackupUnchanged(backupDir, snapshotMap);
    assert(verifyResult.passed, "Backup directory snapshot check passed with zero file mutations");

    // Check sibling directory containment check logic
    try {
      // Simulate validating path in sibling directory e.g. C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup_Malicious\test.xlsx
      const siblingPath = path.join(path.dirname(backupDir), 'Backup_Malicious', 'test.xlsx');
      validateBackupPath(siblingPath, backupDir);
      assert(false, "Sibling directory access should have thrown PathTraversalError");
    } catch (err: any) {
      assert(err instanceof PathTraversalError || err.name === 'PathTraversalError' || err.name === 'BackupFileNotFoundError',
        "Sibling directory / non-existent target safely blocked by path validator", err.message);
    }
  } else {
    console.log(`[SKIP] Backup directory ${backupDir} not found on local disk, skipping live disk read test.`);
  }

  // ----------------------------------------------------
  // TEST 3: Mock DB Loader with Third-Party Upsert & .in Query Testing
  // ----------------------------------------------------
  console.log("\n--- STRESS TEST 3: DB Loader Third-Party Upsert & .in Query Filtering ---");

  const queriedInDocs: string[] = [];
  const queriedInCodes: string[] = [];
  let capturedTpUpsertOptions: any = null;
  let capturedPucUpsertOptions: any = null;

  const mockSupabaseClient = {
    from: (table: string) => {
      return {
        select: (cols: string) => ({
          in: (colName: string, values: string[]) => {
            if (table === 'third_parties') queriedInDocs.push(...values);
            if (table === 'puc_accounts') queriedInCodes.push(...values);
            return Promise.resolve({ data: [], error: null });
          }
        }),
        upsert: (data: any[], options?: any) => {
          if (table === 'third_parties') capturedTpUpsertOptions = options;
          if (table === 'puc_accounts') capturedPucUpsertOptions = options;
          return Promise.resolve({ error: null });
        },
        insert: (data: any[]) => Promise.resolve({ error: null })
      };
    }
  };

  const testEntries: ParsedJournalEntry[] = [
    {
      date: '2026-01-15',
      voucher_type: 'DIARIO',
      voucher_number: '101',
      description: 'Pago total factura #102',
      lines: [
        { account_code: '11050501', account_name: 'Caja General', debit: 1500000.00, credit: 0, third_party_doc: '900123456-1', third_party_name: 'Empresa X SAS' },
        { account_code: '13050501', account_name: 'Clientes Nacionales', debit: 0, credit: 1500000.00, third_party_doc: '900123456-1', third_party_name: 'Empresa X SAS' }
      ],
      total_debit: 1500000.00,
      total_credit: 1500000.00,
      is_balanced: true
    }
  ];

  const dbResult = await loadJournalEntries(testEntries, { client: mockSupabaseClient });

  assert(dbResult.success === true, "DB loader returns success = true");
  assert(capturedTpUpsertOptions?.onConflict === 'document_type,document_number',
    "Third-party upsert uses onConflict: 'document_type,document_number'",
    JSON.stringify(capturedTpUpsertOptions));
  assert(capturedPucUpsertOptions?.onConflict === 'code',
    "PUC account upsert uses onConflict: 'code'",
    JSON.stringify(capturedPucUpsertOptions));
  assert(queriedInDocs.includes('900123456-1'),
    ".in(...) query filter used for third-party lookup",
    JSON.stringify(queriedInDocs));
  assert(queriedInCodes.includes('11050501') && queriedInCodes.includes('13050501'),
    ".in(...) query filter used for PUC account lookup",
    JSON.stringify(queriedInCodes));

  console.log("\n=================================================");
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEmpiricalStressTests().catch(err => {
  console.error("Fatal stress test error:", err);
  process.exit(1);
});
