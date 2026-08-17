# Scope: Milestone 3 — Automated Verification & Comparison Suite

## Architecture
- Target Verification Script / Library: `scripts/verify-trial-balance-backup.ts` and/or `src/lib/verification/trial-balance-comparator.ts` + associated test harness in `tests/verification/trial-balance-comparator.test.ts`.
- Data Source: Historical `[YEAR] Balance de prueba por tercero-*.xlsx` files located in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` (Strictly Read-Only).
- Engine Integration: Calls upgraded trial balance engine (`getTrialBalance` in `src/actions/reportes.ts` / calculation engine in `src/lib/utils/trial-balance-calc.ts`).
- Verification Logic:
  - Parses historical trial balance report Excel for target year/period (e.g., 2024).
  - Generates trial balance using engine for the same period.
  - Compares balances account-by-account and third-party-by-third-party (initial balance, debits, credits, final balance).
  - Enforces float tolerance $\le 0.01$ COP.
  - Asserts clean pass with zero discrepancies.
  - Read-Only Infrastructure Guard: Zero write, delete, or modify operations on backup directory.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 6 | Automated Comparison Verification Script | Programmatic comparison runner comparing generated vs backup historical trial balances ($\le 0.01$ COP tolerance, strictly read-only backup) | M3 | User Request / PROJECT.md |

## Milestones / Sub-tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M3.1 | Historical Excel Parser & Trial Balance Benchmark Extractor | Utility/lib to parse historical `Balance de prueba por tercero-*.xlsx` reports safely | none | DONE |
| M3.2 | Programmatic Comparator & Verification Runner Script/Tests | Comparator function and runnable verification test suite matching generated vs benchmark balances with $\le 0.01$ COP float tolerance | M3.1, M2 | DONE |

## Interface Contracts
### Comparator ↔ Excel Benchmark Reader
- Input: `filePath` of historical trial balance report (e.g. `2024 Balance de prueba por tercero-*.xlsx` in backup directory).
- Output: `BenchmarkTrialBalanceRow[]` containing account code, account name, third-party doc/name, initial balance, debit, credit, final balance.

### Comparator ↔ Trial Balance Engine
- Input: `year: 2024`, `month?: 12`
- Output: `TrialBalanceReport` from `getTrialBalance` or `calculateTrialBalance`.

### Verification Assertions
- Account matching: match by account code and third-party document/NIT (if detailed row) or account code (if summary row).
- Numerical Float Tolerance: `Math.abs(generated - historical) <= 0.01`.
- Clean Pass: 0 missing accounts, 0 balance mismatches, 0 unhandled discrepancies.
- Read-Only Compliance: Backup directory files accessed via read-only stream/file handles without write flags.

## Code Layout
- `src/lib/verification/trial-balance-comparator.ts` — Benchmark Excel parser and trial balance comparator engine.
- `scripts/verify-trial-balance-backup.ts` — Executable verification runner script.
- `tests/verification/trial-balance-comparator.test.ts` or `src/lib/verification/trial-balance-comparator.test.ts` — Automated test suite executable via Vitest.
