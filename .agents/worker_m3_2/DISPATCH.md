# Task Assignment: worker_m3_2 (Iteration 2 Remediation)

**Role**: teamwork_preview_worker
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_2`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite - Iteration 2)

## Exclusive File Ownership
- `src/lib/verification/trial-balance-comparator.ts`
- `scripts/verify-trial-balance-backup.ts`
- `tests/verification/trial-balance-comparator.test.ts`

## Context & Objectives
In Iteration 1, Challenger 2 (`challenger_m3_2`) identified 5 specific defects in `src/lib/verification/trial-balance-comparator.ts` that caused Iteration 1 Gate Failure. You are dispatched to remediate all 5 findings.

Read the following mandatory reference documents before starting work:
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`
- `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`
- Gate Status Iteration 1: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\GATE_STATUS.md`
- Challenger 2 Handoff: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2\handoff.md` and Analysis: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2\analysis.md`

## Mandatory Remediation Tasks
1. **Fix Composite Key Collision for Generic Third Parties**:
   - Update `buildCompositeKey` in `src/lib/verification/trial-balance-comparator.ts`: when document number is generic (`null`, `undefined`, `""`, `"0"`, `"GENERAL"`, `"CUANTIAS MENORES"`), include third-party name (or third party ID) in the composite key: `TP::<account_code>::<normDoc>::<normName>` (or `TP::<account_code>::<normName>`). This prevents multiple third parties on the same account from overwriting each other in `Map.set()`.
2. **Fix Account Code Normalization Mismatch**:
   - Update `normalizeAccountCode` in `trial-balance-comparator.ts` to strip non-alphanumeric punctuation: `.replace(/[^\w]/g, '')` so `"1105.05"` becomes `"110505"` consistently across both engine and benchmark parser.
3. **Fix Asymmetric Zero-Balance Benchmark Account Filtering**:
   - Update `compareTrialBalances`: when `ignoreZeroBalanceUnmatched: true`, if a benchmark row is absent in generated rows (`bench && !gen`), check if all 4 balance fields (`saldo_inicial`, `debito`, `credito`, `saldo_final`) are zero (`Math.abs(val) <= tolerance`). If all zero, suppress the discrepancy instead of logging false `MISSING_IN_GENERATED`.
4. **Fix Discrepancy Taxonomy Multi-Column Overwriting**:
   - Fix sequential `if` assignment so multi-column mismatches on a row don't overwrite each other. Populate `fieldDiffs[]` for all mismatching fields.
5. **Add Vitest Tests for all 5 Remediation Scenarios**:
   - Add test cases in `tests/verification/trial-balance-comparator.test.ts` verifying key collisions are resolved (multiple generic third parties), account codes with dots/dashes match cleanly, zero-balance inactive benchmark accounts are ignored when option is set, and multi-field diffs are preserved.
   - Run `npx vitest run tests/verification/trial-balance-comparator.test.ts` and verify all tests pass.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Deliverables
Write your handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_2\handoff.md` documenting:
- Exact changes made for each of the 5 remediation items.
- Verified test suite execution output (`npx vitest run tests/verification/trial-balance-comparator.test.ts`).
- Send a message when finished.
