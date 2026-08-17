# Project: CFO-AI Production Data Ingestion & Verification

## Architecture
- Monolithic Next.js 15 App Router (TypeScript) + Supabase PostgreSQL + Vitest.
- Backup Excel data ingestion engine (TypeScript/Node) to parse historical `Libros Diarios` in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` (Read-Only).
- Upgraded Trial Balance engine (`src/actions/reportes.ts`) with initial balances, PUC rollups, and third-party breakdown.
- Automated programmatic verification suite with Vitest comparison runner.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Excel Parser & Data Ingester | Read `Libros diarios` from backup Excel without errors and ingest into journal_entries / journal_lines | M1 | Survey |
| 2 | Read-Only Infrastructure Guard | Ensure zero write/delete operations in backup directory | M1 | Survey |
| 3 | PUC Account Hierarchy & Dynamic Rollup | Roll up auxiliary transactions (8 digits) to Subcuenta (6), Cuenta (4), Grupo (2), Clase (1) | M2 | Survey |
| 4 | Initial Balance & Movement Carry-Over | Carry forward previous period balances and handle year-end closing entries (Classes 4-7 reset to 0) | M2 | Survey |
| 5 | Trial Balance Engine (`getTrialBalance`) | Generate trial balance per period with third-party details matching historical format | M2 | Survey |
| 6 | Automated Comparison Verification Script | Compare generated trial balance vs historical `Balance de prueba por tercero` report ($\le 0.01$ COP tolerance) | M3 | Survey |
| 7 | Dual-Track E2E Test Suite (Tiers 1-5) | Opaque-box requirement-driven testing + white-box adversarial hardening | M-E2E | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Ingestion Engine | Excel parser script + read-only safety guard + batch database loader | none | DONE |
| M2 | Movement Processing & Closure Engine | Upgraded `getTrialBalance`, PUC rollup, initial balance carry-over, annual closing mechanics | M1 | DONE |
| M3 | Automated Verification & Comparison Suite | Programmatic comparison runner comparing generated vs backup historical trial balances | M2 | DONE |
| M-E2E | E2E Testing & Hardening | Opaque-box requirement-driven E2E test suite (Tiers 1-4) + Tier 5 adversarial hardening | M1, M2, M3 | DONE |

## Interface Contracts
### Ingestion Engine ↔ Database
- Input: `.xlsx` file path in `Backup` directory
- Output: `journal_entries` and `journal_lines` populated in database

### Trial Balance Engine ↔ Verification Suite
- `getTrialBalance(year, month, options)` -> `TrialBalanceReport` with `saldo_inicial`, `debito`, `credito`, `saldo_final` per account & third-party.
- Verification Runner reads historical Excel `Balance de prueba por tercero-*.xlsx` and compares against `TrialBalanceReport`.

## Code Layout
- `src/actions/` - Server action files (e.g. `reportes.ts`, `accounting.ts`, `puc.ts`)
- `src/lib/utils/` - Utility calculations, closing logic, Excel parsing utilities
- `scripts/` or `tests/` - Ingestion test script & verification comparison runner
