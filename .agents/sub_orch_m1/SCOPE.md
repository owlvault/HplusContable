# Scope: Milestone 1 (Data Ingestion Engine)

## Architecture
- Excel Ingestion Engine (TypeScript / Node.js utility in `src/lib/ingestion/` or `scripts/`) using `exceljs` library (`^4.4.0`) to parse Excel sheets in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
- Infrastructure Read-Only Guard preventing any file write/edit/delete operations on `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
- Batch Database Loader populating `journal_entries` and `journal_lines` in Supabase PostgreSQL using client-side generated UUIDs (`crypto.randomUUID()`).
- Verification acceptance test script verifying historical `[YEAR] Libro diario-*.xlsx` files read and parse without errors.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Historical Excel Ingestion Parser | Parse `[YEAR] Libro diario-*.xlsx` files in Backup folder with header auto-detection, date ISO formatting, fuzzy column matching | M1 | Survey |
| 2 | Infrastructure Read-Only Guard | Strict read-only mode for `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` preventing any write/delete/mutation | M1 | Survey |
| 3 | Database Data Loader | Batch ingest parsed transactions into `journal_entries` and `journal_lines` tables | M1 | Survey |
| 4 | Acceptance Test Script | Script verifying Excel transactions read without parse errors and validating double-entry balance | M1 | Survey |

## Milestones & Work Items
| # | Work Item | Description | Status |
|---|-----------|-------------|--------|
| 1 | M1.1 Read-Only Guard & File Utilities | Utility for safe read-only access to backup directory | DONE |
| 2 | M1.2 Historical Excel Ingestion Parser | TypeScript parser for Excel Libros Diarios | DONE |
| 3 | M1.3 Database Batch Loader | Database loader into journal_entries and journal_lines | DONE |
| 4 | M1.4 Ingestion Acceptance Test Script | Acceptance test script verifying data read and batch load | DONE |

## Interface Contracts
### Excel Parser ↔ Data Loader
- `parseLibroDiario(filePath: string): Promise<ParsedJournalEntry[]>`
- Input: `.xlsx` file path in Backup directory.
- Output: Array of parsed entries with entry details (fecha, comprobante, numero, concepto) and lines (account_code, account_name, third_party_doc, third_party_name, debit, credit).

### Data Loader ↔ Database
- `loadJournalEntries(entries: ParsedJournalEntry[]): Promise<IngestionResult>`
- Populates `journal_entries` and `journal_lines` with double-entry balance validation.
