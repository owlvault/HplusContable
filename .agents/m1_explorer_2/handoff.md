# Handoff Report — Historical Excel Parsing Analysis & Ingestion Strategy

**Agent Name**: `m1_explorer_2` (Excel Parsing & Ingestion Analyst)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_explorer_2`  
**Date**: 2026-08-03  
**Target Module**: Milestone 1 (Data Ingestion Engine — `parseLibroDiario`)  
**Target Source Directory (Read-Only)**: `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`

---

## 1. Observation

1. **User Request & Requirements**:
   - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md` (lines 16–23): Ingest real accounting transaction data from older periods in Excel files located in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`. The source folder MUST be treated as strictly read-only.
   - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\SCOPE.md` (lines 26–29): Contract for Excel Parser: `parseLibroDiario(filePath: string): Promise<ParsedJournalEntry[]>`.

2. **Package Dependency Inspection (`package.json`)**:
   - Inspected `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\package.json` (lines 12–41):
     ```json
     "dependencies": {
       "@radix-ui/react-dialog": "^1.1.20",
       "@supabase/ssr": "^0.8.0",
       "@supabase/supabase-js": "^2.90.1",
       "next": "15.1.0",
       "pg": "^8.22.0",
       "react": "^19.0.0",
       "vitest": "^4.0.17"
     }
     ```
   - **Result**: No binary Excel parsing library (`exceljs` or `xlsx`/`sheetjs`) is currently installed in `dependencies` or `devDependencies`. `src/lib/utils/excel-export.ts` is only a lightweight client-side CSV generator.

3. **Backup Directory File Structure**:
   - Source directory contains historical files matching `[YEAR] Libro diario-*.xlsx` spanning fiscal years 2016 through 2026.
   - Key layout characteristics observed from previous survey reports (`.agents/explorer_survey_2/analysis.md` lines 38–64):
     - Top metadata block spanning rows 1 to 4–6 (Company Name, NIT, Report Title: "LIBRO DIARIO GENERAL", Period Range).
     - Table header row located dynamically between rows 4 and 8.
     - Expected target columns: `Fecha`, `Comprobante`, `Número`, `Código Cuenta`, `Nombre Cuenta`, `Identificación`, `Tercero`, `Concepto`, `Débito`, `Crédito`.
     - Subtotal and total summary rows interspersed throughout the sheet.

---

## 2. Logic Chain

1. **Premise**: Milestone 1 requires a robust, zero-panic TypeScript function `parseLibroDiario(filePath: string)` that reads historical `[YEAR] Libro diario-*.xlsx` files and produces typed, validated accounting entry structures for database ingestion.

2. **Step 1 — Package Selection Rationale (`exceljs`)**:
   - Comparing `exceljs` vs `xlsx` (SheetJS):
     - `exceljs` provides official TypeScript types out-of-the-box, supports standard stream/file path loading (`workbook.xlsx.readFile`), handles native Excel dates cleanly, and has a permissive MIT license without commercial registry friction.
     - **Conclusion**: `exceljs` should be added to dependencies via `npm install exceljs`.

3. **Step 2 — Header Auto-Detection Algorithm**:
   - Excel export headers vary across software versions (e.g. `Fecha` vs `Fecha Cbte`, `Número` vs `Consecutivo`, `Identificación` vs `NIT`).
   - Strategy: Scan rows 1 through 30. Normalize cell strings (lowercase, remove accents).
   - Match a row as header if it simultaneously contains:
     1. Date term (`fecha`) OR Voucher term (`comprobante` / `tipo`)
     2. Debit term (`debito` / `debitos`) OR Credit term (`credito` / `creditos`)
     3. Account term (`cuenta` / `codigo cuenta`)
   - Build dynamic column index mapping dictionary.

4. **Step 3 — Data Cleaning & Normalization Rules**:
   - **Date Parsing**:
     - Excel Serial Numbers (e.g. `45366.0`): convert using `new Date(Math.round((serial - 25569) * 86400 * 1000))`.
     - Strings (`DD/MM/YYYY`, `YYYY-MM-DD`): standardize to ISO `YYYY-MM-DD`.
     - Propagate `lastSeenDate` for multi-line entries with empty date cells.
   - **Numeric Formatting**:
     - Strip currency symbols (`$`), thousands separators (`.`), replace decimal commas (`,`) with dots (`.`).
     - Round to 2 decimal places: `Math.round((val + Number.EPSILON) * 100) / 100`.
   - **String Cleaning**:
     - Trim whitespace, remove hidden non-printable characters.
     - Uppercase account codes and voucher types.
   - **Missing Data Handling**:
     - Missing Third-Party document: default to `"0"` / `null` and set name to `"CUANTIAS MENORES / GENERAL"`.
     - Missing Account Name: auto-generate standard label `"Cuenta Auxiliar " + accountCode`.

5. **Step 4 — Algorithm & Boundary Grouping**:
   - Iterate over rows after header.
   - Skip empty or subtotal rows (rows containing `"Total"`, `"Subtotal"`, `"Van"`, `"Vienen"`).
   - Group lines by voucher key (`date + voucherType + sequenceNumber`).
   - Validate double-entry balance for each entry: `Math.abs(totalDebit - totalCredit) <= 0.01`. Flag unbalanced entries in output summary.

---

## 3. Caveats

- **Package Installation Required**: `exceljs` is not installed yet; `npm install exceljs` must be run by the implementer.
- **Read-Only Enforcement**: The parser MUST ONLY read files (`workbook.xlsx.readFile`) and NEVER invoke save/write methods against files in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
- **Large Excel Files**: Some multi-year or full-year Libros Diarios contain tens of thousands of rows. `exceljs` streaming reader or buffer loading should be used to minimize memory usage during processing.

---

## 4. Conclusion

A complete, production-grade Excel parsing design and algorithm specification has been formulated for `parseLibroDiario(filePath: string)`.

### Summary Specification Table

| Aspect | Specification |
| :--- | :--- |
| **Package** | `exceljs` (`npm install exceljs`) |
| **Input** | Absolute file path to `[YEAR] Libro diario-*.xlsx` |
| **Header Detection** | Dynamic scanning of rows 1–30 with normalized fuzzy keyword matching |
| **Date Output** | Standard ISO string `YYYY-MM-DD` |
| **Numeric Precision** | Rounded floats to 2 decimal places (`Math.round((v + EPS) * 100) / 100`) |
| **String Normalization**| Trimmed whitespace, uppercase account codes, stripped non-printable chars |
| **Missing Third-Party**| Default doc `"0"`, name `"CUANTIAS MENORES / GENERAL"` |
| **Validation** | Double-entry balance check per journal entry ($\le 0.01$ COP tolerance) |

---

## 5. Verification Method

1. **Package Verification**:
   Inspect `package.json` after implementer adds `exceljs` to verify presence in `dependencies`.

2. **Algorithm Execution Verification**:
   Run Vitest test suite on `parseLibroDiario` against historical backup files (e.g. `2024 Libro diario-*.xlsx`):
   ```bash
   npx vitest run tests/ingestion/excel-parser.test.ts
   ```

3. **Read-Only Safety Verification**:
   Verify modified timestamps on `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` remain completely unchanged.

4. **Invalidation Conditions**:
   The specification would be invalidated if historical Excel files contain encrypted/password-protected sheets or non-standard multi-sheet layouts where transactions are split across separate monthly tabs without a unified structure.
