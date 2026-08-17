# Handoff Report: Script Runner, Vitest Suite & Read-Only Guard Analysis

**Author**: explorer_m3_3  
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_3`  
**Date**: 2026-08-03  

---

## 1. Observation

1. **Original User Request (`.agents/ORIGINAL_REQUEST.md`, lines 22-34)**:
   - R3 Infrastructure Constraint: "The source folder `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` MUST be treated as completely Read-Only. You must not modify, overwrite, or delete any files in this directory."
   - Verification AC: "A programmatic verification script must generate a trial balance for a specific period and automatically compare it against the actual trial balance report saved in the backup folder for that same period. The comparison test must pass (the generated balances must match the historical balances without errors)."
2. **Project Architecture (`PROJECT.md`, lines 5-18)**:
   - Feature 6: "Automated Comparison Verification Script: Compare generated trial balance vs historical `Balance de prueba por tercero` report ($\le 0.01$ COP tolerance)."
3. **Sub-Orchestrator Scope (`.agents/sub_orch_m3/SCOPE.md`, lines 40-45)**:
   - File locations: `scripts/verify-trial-balance-backup.ts` (CLI runner script) and `tests/verification/trial-balance-comparator.test.ts` (Vitest test suite).
4. **Existing Read-Only Infrastructure Guard (`src/lib/ingestion/readonly-guard.ts`, lines 81-184)**:
   - `readBackupFileBuffer(filePath)` loads file into RAM using `'r'` flag and asserts `mtimeMs` and `size` before/after read.
   - `verifyBackupUnchanged(targetPath, snapshotMap)` verifies file stats against baseline snapshot.
5. **Existing Trial Balance Engine (`src/lib/utils/trial-balance-calc.ts`, lines 244-630)**:
   - Implements `calculateTrialBalance(lines, options)` returning `TrialBalanceReport` with `items` and `totals`.
6. **Package Dependencies (`package.json`, lines 10, 15, 41)**:
   - `"scripts": { "test": "vitest" }`
   - `"exceljs": "^4.4.0"`
   - `"vitest": "^4.0.17"`

---

## 2. Logic Chain

1. **Premise 1**: The user request and sub-orchestrator scope require an executable script `scripts/verify-trial-balance-backup.ts` and automated test suite `tests/verification/trial-balance-comparator.test.ts`.
2. **Premise 2**: Backup Excel data in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` is on OneDrive and must be protected against all file mutations, intermediate output creation, or file handle locks.
3. **Deduction 1**: Enforcing read-only infrastructure constraints requires a 3-layer protection model: (a) in-memory buffer reading via `'r'` flag (`readBackupFileBuffer`), (b) pre and post execution directory snapshot map comparison (`takeDirectorySnapshot`), and (c) no-new-files validation (`verifyBackupDirectoryUnchanged`).
4. **Deduction 2**: Numerical comparison must evaluate 4 financial balance fields (`saldo_inicial`, `debito`, `credito`, `saldo_final`) across accounts and third-party rows, enforcing float tolerance $\le 0.01$ COP.
5. **Deduction 3**: The CLI runner script (`scripts/verify-trial-balance-backup.ts`) must format a human-readable console summary table and return exit code `0` on clean verification or exit code `1` if any discrepancy or read-only violation occurs.
6. **Deduction 4**: The Vitest test suite (`tests/verification/trial-balance-comparator.test.ts`) must test exact matches, tolerance boundaries ($0.005$ vs $0.010$ vs $0.011$ COP), account key matching, missing accounts, and safety guard enforcement.

---

## 3. Caveats

1. **Vitest Configuration File**: `vitest.config.ts` does not currently exist at the root level (Vitest uses default resolution). A dedicated `vitest.config.ts` may be added if custom test aliases or timeout configs are required.
2. **CLI Runner Database Connection**: `scripts/verify-trial-balance-backup.ts` will need database access or direct call to `getTrialBalance` when executed outside Vitest. Environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) must be supplied or mocked during offline execution.

---

## 4. Conclusion

The script runner `scripts/verify-trial-balance-backup.ts` and automated test suite `tests/verification/trial-balance-comparator.test.ts` have been designed to satisfy all Milestone 3 requirements:
- **Read-Only Safety**: Guaranteed by pre/post directory snapshot hashing, in-memory Excel buffer parsing (`'r'` flag), and no-new-files validation in `Backup`.
- **Assertion Mechanics**: Standardized float tolerance ($\le 0.01$ COP) across `saldo_inicial`, `debito`, `credito`, `saldo_final`, with structured discrepancy classification.
- **Reporting & Exit Codes**: Formatted console summary output table with exit code `0` for clean pass and `1` for any discrepancy or guard violation.
- Full design specs documented in `.agents/explorer_m3_3/analysis.md`.

---

## 5. Verification Method

To verify the design specs independently once implemented:

1. **Run Vitest Test Suite**:
   ```bash
   npx vitest tests/verification/trial-balance-comparator.test.ts
   ```
   *Expected Result*: All tests pass (safety guard, float tolerance assertions $\le 0.01$ COP, missing account flags).

2. **Run Executable CLI Runner**:
   ```bash
   npx tsx scripts/verify-trial-balance-backup.ts --year 2024
   ```
   *Expected Result*: Formatted console output displayed. Returns exit code 0 on match.

3. **Verify Backup Directory Unchanged**:
   Check `mtime` and file list of `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
   *Expected Result*: Zero files modified, zero temporary files created.

4. **Invalidation Conditions**:
   - Backup directory file created, modified, or deleted during test run.
   - Script exits with `0` when balance difference exceeds `0.01` COP.
   - Script exits with `1` when balance difference is within `0.01` COP.
