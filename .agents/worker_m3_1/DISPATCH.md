# Task Assignment: worker_m3_1

**Role**: teamwork_preview_worker
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_1`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)

## Exclusive File Ownership
- `src/lib/verification/trial-balance-comparator.ts`
- `scripts/verify-trial-balance-backup.ts`
- `tests/verification/trial-balance-comparator.test.ts` (or `src/lib/verification/trial-balance-comparator.test.ts`)

## Context & Objectives
You are implementing Feature 6 (Automated Verification & Comparison Suite) for Milestone 3.

Read the following mandatory reference documents before starting work:
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`
- Explorer 1 Handoff: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_1\handoff.md` and Analysis: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_1\analysis.md`
- Explorer 2 Handoff: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\handoff.md` and Analysis: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\analysis.md`
- Explorer 3 Handoff: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_3\handoff.md` and Analysis: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_3\analysis.md`

## Detailed Work Requirements
1. **Benchmark Parser & Comparator Library (`src/lib/verification/trial-balance-comparator.ts`)**:
   - Safely read historical trial balance reports `[YEAR] Balance de prueba por tercero-*.xlsx` from `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` using `withReadOnlyGuard` / `readBackupFileBuffer`.
   - Parse `BenchmarkTrialBalanceRow[]` extracting dynamic header columns, PUC summary rows, third-party detail rows, initial balances, debits, credits, and final balances.
   - Implement `compareTrialBalances(generatedReport, benchmarkRows, options)`:
     - Composite key matching (`ACC::<code` or `TP::<code>::<nit>`).
     - Floating-point numerical float tolerance assertion $\le 0.01$ COP across all 4 balance fields (`saldo_inicial`, `debito`, `credito`, `saldo_final`).
     - Standardized discrepancy taxonomy (`MISSING_IN_GENERATED`, `UNEXPECTED_IN_GENERATED`, `SALDO_INICIAL_MISMATCH`, `DEBITO_MISMATCH`, `CREDITO_MISMATCH`, `SALDO_FINAL_MISMATCH`).
     - Return strongly typed `ComparisonResult` with `passed: boolean`, `total_discrepancies`, `stats`, and `discrepancies[]`.
2. **CLI Runner Script (`scripts/verify-trial-balance-backup.ts`)**:
   - Programmatic verification runner script. Accepts `--year`, `--backup-dir`, `--tolerance`.
   - Executes 3-layer read-only infrastructure safety checks (pre/post snapshot comparison verifying zero file modifications, zero truncations, zero intermediate files in `Backup` folder).
   - Generates trial balance using engine for target period (e.g., 2024), parses historical benchmark Excel, performs comparison, prints formatted summary table.
   - Exits with Code 0 on clean verification pass (zero discrepancies) or Code 1 on mismatch/error.
3. **Automated Test Suite (`tests/verification/trial-balance-comparator.test.ts` or `src/lib/verification/trial-balance-comparator.test.ts`)**:
   - Comprehensive Vitest test suite testing Excel benchmark parser, read-only safety guard, composite key matching, exact matches, tolerance boundaries ($0.005$ vs $0.010$ vs $0.011$), missing/unexpected account handling, and synthetic/real comparison runner execution.
   - Ensure `npx vitest run tests/verification/trial-balance-comparator.test.ts` (or `npx vitest run src/lib/verification/trial-balance-comparator.test.ts`) passes cleanly.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Deliverables
Write your handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_1\handoff.md` documenting:
- Implementation details and file paths.
- Verified build and test commands and exact execution outputs.
- Send a message when finished.
