# E2E Test Infra: Contable CFO-AI Production Ingestion & Verification

## Test Philosophy
- Opaque-box, requirement-driven E2E testing based on `ORIGINAL_REQUEST.md`.
- No direct dependency on internal implementation design details; tests exercise system entry points and contracts.
- Read-Only Infrastructure Protection: Verification that the source directory `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` is never written to, overwritten, or modified.
- Multi-tier opaque-box test strategy:
  - **Tier 1**: Ingestion & Trial Balance Feature Coverage (≥5 tests per feature)
  - **Tier 2**: Boundary & Corner Cases (empty data, missing accounts, zero balances, float rounding COP precision)
  - **Tier 3**: Multi-period transitions & annual closures (monthly roll-forward, Dec->Jan class 4-7 resets)
  - **Tier 4**: Real-World trial balance verification scenario (2024 trial balance comparison against historical backup file)

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | Excel Data Ingestion & Parser | R1 / Data Ingestion | 5 | 5 | ✓ | ✓ |
| 2 | Read-Only Infrastructure Guard | R3 / Read-Only Guard | 5 | 5 | ✓ | ✓ |
| 3 | PUC Account Hierarchy & Rollup | R2 / Accounting | 5 | 5 | ✓ | ✓ |
| 4 | Initial Balance & Annual Closures | R2 / Closures | 5 | 5 | ✓ | ✓ |
| 5 | Trial Balance Engine (`getTrialBalance`) | R2 / Trial Balance | 5 | 5 | ✓ | ✓ |
| 6 | Automated Backup Comparison | Acceptance Criteria | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Framework**: Vitest (`npx vitest run tests/e2e`)
- **Assertion Semantics**: 100% pass rate required for exit code 0.
- **Directory Layout**:
  - `tests/e2e/helpers/test-harness.ts` — Common test context, fixture generators, backup read-only guard hooks.
  - `tests/e2e/tier1-ingestion-trial-balance.test.ts` — Tier 1 test cases.
  - `tests/e2e/tier2-boundary-corner-cases.test.ts` — Tier 2 test cases.
  - `tests/e2e/tier3-multi-period-closures.test.ts` — Tier 3 test cases.
  - `tests/e2e/tier4-real-world-comparison.test.ts` — Tier 4 test cases.

## Coverage Goals & Minimum Thresholds
- Tier 1: ≥30 test cases across ingestion, read-only verification, PUC hierarchy, trial balance, and baseline comparison.
- Tier 2: ≥30 test cases across empty datasets, zero balances, missing accounts, float precision ($\le 0.01$ COP), corrupted formats.
- Tier 3: ≥10 test cases covering multi-month sequences, roll-forwards, annual closing entries (Class 4-7 reset to 0).
- Tier 4: ≥5 test cases validating actual historical backup 2024 trial balance comparison against generated trial balance reports.
