## 2026-08-03T19:01:00Z
<USER_REQUEST>
You are a Worker subagent for Milestone 1 (Data Ingestion Engine).
Your working directory is C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_worker_1. Create this folder if it does not exist.

Context and Inputs:
- Read ORIGINAL_REQUEST.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
- Read PROJECT.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
- Read SCOPE.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\SCOPE.md
- Read Explorer & Spec Miner Reports at:
  - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_explorer_1\handoff.md
  - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_explorer_2\handoff.md
  - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_spec_miner_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You exclusively own and may create/modify:
- `package.json` (to add `exceljs` dependency)
- `src/lib/ingestion/types.ts`
- `src/lib/ingestion/readonly-guard.ts`
- `src/lib/ingestion/excel-parser.ts`
- `src/lib/ingestion/db-loader.ts`
- `src/lib/ingestion/readonly-guard.test.ts`
- `src/lib/ingestion/excel-parser.test.ts`
- `src/lib/ingestion/db-loader.test.ts`
- `scripts/test-ingestion-parser.ts`

Tasks:
1. Install `exceljs` (`npm install exceljs` or update package.json & install).
2. Implement `src/lib/ingestion/types.ts` with types for ParsedJournalLine, ParsedJournalEntry, IngestionOptions, IngestionResult.
3. Implement `src/lib/ingestion/readonly-guard.ts`: Strict infrastructure read-only guard for `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`. Enforce zero write/create/delete/modify ops in backup dir, canonical path resolution, buffer file reading (`'r'`), and mtime timestamp verification.
4. Implement `src/lib/ingestion/excel-parser.ts`: `parseLibroDiario(filePath: string): Promise<ParsedJournalEntry[]>`. Auto-detect header rows (Fecha, Comprobante, Número, Código Cuenta, Nombre Cuenta, Identificación, Tercero, Concepto, Débito, Crédito). ISO date formatting, integer-cent numeric rounding (2 decimals), string whitespace trimming, missing third-party fallback (doc: "0", name: "CUANTIAS MENORES / GENERAL"), and double-entry balance validation (|sum debit - sum credit| <= 0.01 COP).
5. Implement `src/lib/ingestion/db-loader.ts`: `loadJournalEntries(entries: ParsedJournalEntry[], options?: IngestionOptions): Promise<IngestionResult>`. Upsert third parties in `third_parties`, verify/upsert PUC accounts in `puc_accounts`, and batch insert `journal_entries` & `journal_lines` in Supabase PostgreSQL using crypto.randomUUID().
6. Implement `scripts/test-ingestion-parser.ts` and unit tests in `src/lib/ingestion/`.
7. Run builds and tests (`npm run test` / vitest and script execution) to verify all tests pass and Excel data parses cleanly without errors.
8. Document all commands run, build/test results, and changes in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_worker_1\handoff.md following Handoff Protocol. Send message to parent when done.
</USER_REQUEST>
