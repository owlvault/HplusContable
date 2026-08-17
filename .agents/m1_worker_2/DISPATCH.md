## 2026-08-03T19:09:43Z
You are Worker 2 for Milestone 1 (Data Ingestion Engine) Remediation.
Your working directory is C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_worker_2. Create this folder if it does not exist.

Context and Inputs:
- Read ORIGINAL_REQUEST.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
- Read PROJECT.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
- Read SCOPE.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\SCOPE.md
- Read Gate Status at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\GATE_STATUS.md
- Read Reviewer 1 Handoff at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_reviewer_1\handoff.md
- Read Challenger 1 Handoff at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_challenger_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You exclusively own and may modify:
- `src/lib/ingestion/readonly-guard.ts`
- `src/lib/ingestion/excel-parser.ts`
- `src/lib/ingestion/db-loader.ts`
- `src/lib/ingestion/readonly-guard.test.ts`
- `src/lib/ingestion/excel-parser.test.ts`
- `src/lib/ingestion/db-loader.test.ts`
- `scripts/test-ingestion-parser.ts`

Specific Fix Instructions:
1. **Path Traversal Security Fix in `readonly-guard.ts`**:
   - In `validateBackupPath` and `normalizePathForComparison`: Ensure `normalizedBase` ends with `path.sep` (e.g. `normalizedBase = normalizedBase.endsWith(path.sep) ? normalizedBase : normalizedBase + path.sep`), or check `path.relative(baseDir, resolvedPath)` to strictly block sibling directories like `Backup_Malicious`.
   - Update `readonly-guard.test.ts` with test cases verifying `Backup_Malicious/file.xlsx` is rejected with `PathTraversalError`.

2. **Concept String False-Positive Line Drop Fix in `excel-parser.ts`**:
   - In `parseLibroDiario` (row filtering loop): DO NOT check `.includes('total')` on concatenated text containing `rawConcepto`. Only check summary keywords (`total`, `subtotal`, `van`, `vienen`) on `rawCodigo` and `rawNombreCuenta` (or when `rawCodigo` is empty).
   - Add unit test in `excel-parser.test.ts` with description `"Pago total factura #102"` and ensure it is parsed cleanly and NOT dropped.

3. **Monetary Truncation & Currency Formatting Fix in `excel-parser.ts`**:
   - In `parseNumericCell`:
     - Clean currency symbols (`$`), spaces, non-breaking spaces (`\u00A0`).
     - Support negative accounting format with parentheses, e.g. `"(1,500.00)"` or `"(1.500,00)"` -> extract inner number and multiply by `-1`.
     - Handle dot thousands vs comma decimals AND comma thousands vs dot decimals:
       If string has multiple dots (e.g. `"1.500.000"` or `"1.500.000,00"`): replace all dots with `""` and replace comma with `"."`.
       If string has dot and comma (e.g. `"1,500,000.00"` or `"1.500.000,00"`): determine decimal character based on last separator.
     - Add unit tests in `excel-parser.test.ts` for `"1.500.000"`, `"1.500.000,50"`, `"(1,500.00)"`, `"($ 1.500.000)"` confirming exact numeric values.

4. **Column Header Priority Fix in `excel-parser.ts`**:
   - In `detectHeaderRow`: Check third-party document keywords (`'identificacion'`, `'nit'`, `'documento'`, `'cedula'`, `'numero de identificacion'`, `'nro identificacion'`) BEFORE checking standalone `'numero'`, `'num'`, `'consecutivo'`.
   - Add unit test in `excel-parser.test.ts` with header `"Número de Identificación"` and verify `identificacionIdx` is correctly assigned to third-party document column.

5. **Database Upsert Conflict Constraint Fix in `db-loader.ts`**:
   - In `loadJournalEntries`: Fix `onConflict` for `third_parties` from `'document_number'` to `'document_type,document_number'`.

6. **Database Query Filtering Optimization in `db-loader.ts`**:
   - In `loadJournalEntries`: Collect all unique non-null `document_number` values and `account_code` values from batch entries, and query `.in('document_number', documentNumbers)` and `.in('code', accountCodes)` instead of unbounded `.select()`.

Run builds and tests (`npx vitest run src/lib/ingestion/` and `npx tsx scripts/test-ingestion-parser.ts`) to verify all unit tests pass. Document all changes in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_worker_2\handoff.md`. Send message to parent when done.
