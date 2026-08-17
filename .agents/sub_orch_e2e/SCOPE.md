# Scope: E2E Testing Track Orchestrator

## Architecture
- Vitest E2E Test Suite located in `tests/e2e/`.
- Harness utilities in `tests/e2e/helpers/test-harness.ts`.
- Opaque-box test files covering Tier 1 (Feature Coverage), Tier 2 (Boundary & Corner Cases), Tier 3 (Multi-Period Closures), Tier 4 (Real-World Backup Comparison).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M-E2E-1 | Test Infra & Harness Setup | `tests/e2e/helpers/test-harness.ts` | none | DONE |
| M-E2E-2 | Tier 1: Feature Coverage | `tests/e2e/tier1-ingestion-trial-balance.test.ts` | M-E2E-1 | DONE |
| M-E2E-3 | Tier 2: Boundary & Corner Cases | `tests/e2e/tier2-boundary-corner-cases.test.ts` | M-E2E-1 | DONE |
| M-E2E-4 | Tier 3: Multi-Period Closures | `tests/e2e/tier3-multi-period-closures.test.ts` | M-E2E-1 | DONE |
| M-E2E-5 | Tier 4: Real-World Backup Comparison | `tests/e2e/tier4-real-world-comparison.test.ts` | M-E2E-1 | DONE |
| M-E2E-6 | E2E Suite Verification & Publication | Run all tests, pass 100%, publish `TEST_READY.md` | M-E2E-2,3,4,5 | DONE |

## Code Layout
- `tests/e2e/helpers/test-harness.ts`
- `tests/e2e/tier1-ingestion-trial-balance.test.ts`
- `tests/e2e/tier2-boundary-corner-cases.test.ts`
- `tests/e2e/tier3-multi-period-closures.test.ts`
- `tests/e2e/tier4-real-world-comparison.test.ts`
