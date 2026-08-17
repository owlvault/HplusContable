# Handoff & Review Report — Milestone 1 (Data Ingestion Engine)

**Author**: Reviewer Subagent (`m1_reviewer_1`)  
**Date**: 2026-08-03  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_reviewer_1`  
**Milestone**: Milestone 1 (Data Ingestion Engine)  
**Verdict**: REQUEST_CHANGES

---

## 1. Observation

### Codebase & Test Artifacts Inspected:
- `src/lib/ingestion/types.ts`
- `src/lib/ingestion/readonly-guard.ts` (lines 1-182)
- `src/lib/ingestion/excel-parser.ts` (lines 1-329)
- `src/lib/ingestion/db-loader.ts` (lines 1-285)
- `src/lib/ingestion/readonly-guard.test.ts`
- `src/lib/ingestion/excel-parser.test.ts`
- `src/lib/ingestion/db-loader.test.ts`
- `scripts/test-ingestion-parser.ts`
- `package.json`
- `supabase/migrations/0000_initial_schema.sql`

### Detailed Findings:

#### 1. CRITICAL BUG: `excel-parser.ts` concept string false-positive line drop
- **Location**: `src/lib/ingestion/excel-parser.ts`, lines 220-233
- **Verbatim Code**:
  ```typescript
  const rowTextCombined = normalizeHeaderString(
    [rawFecha, rawComprobante, rawNumero, rawCodigo, rawNombreCuenta, rawConcepto]
      .map(getCellValueString)
      .join(' ')
  );

  if (
    !rowTextCombined ||
    rowTextCombined.includes('total') ||
    rowTextCombined.includes('subtotal') ||
    rowTextCombined.includes('van ') ||
    rowTextCombined.includes('vienen')
  ) {
    continue;
  }
  ```
- **Problem**: `rowTextCombined` includes `rawConcepto` (the transaction description). If a legitimate accounting entry description contains words like `"total"` (e.g. `"Pago total factura #102"`, `"Abono total a proveedor"`, `"Liquidación total de nómina"`), `rowTextCombined.includes('total')` evaluates to `true` and the parser silently skips the row (`continue`). This causes loss of transaction lines and breaks entry balance ($\le 0.01$ COP).

#### 2. MAJOR BUG: Database Upsert OnConflict Mismatch in `db-loader.ts`
- **Location**: `src/lib/ingestion/db-loader.ts`, line 182
- **Verbatim Code**:
  ```typescript
  const { error: insertTpErr } = await client
    .from('third_parties')
    .upsert(thirdPartiesToInsert, { onConflict: 'document_number' });
  ```
- **Schema Specification** (`supabase/migrations/0000_initial_schema.sql`, line 38):
  ```sql
  unique(document_type, document_number)
  ```
- **Problem**: The database unique constraint is on `(document_type, document_number)`. Target `onConflict: 'document_number'` is invalid and will cause PostgreSQL runtime error (`ON CONFLICT DO UPDATE command cannot affect row...` / no matching constraint). It must be `'document_type,document_number'`.

#### 3. SECURITY / RIGOR FINDING: Path Traversal Check Flaw in `readonly-guard.ts`
- **Location**: `src/lib/ingestion/readonly-guard.ts`, line 67
- **Verbatim Code**:
  ```typescript
  const normalizedTarget = normalizePathForComparison(resolvedPath);
  const normalizedBase = normalizePathForComparison(baseDir);

  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new PathTraversalError(`Access denied: path ${filePath} escapes allowed backup directory ${baseDir}`);
  }
  ```
- **Problem**: If `baseDir` does not end with a path separator (`\`), `normalizedTarget.startsWith(normalizedBase)` passes for paths outside the backup folder (e.g., `C:\Users\...\BackupExtra\file.xlsx` starts with `C:\Users\...\Backup`). Using `path.relative` or appending `path.sep` to `normalizedBase` is required for strict containment.

#### 4. PERFORMANCE / SCALABILITY FINDING: Unbounded Database Selects in `db-loader.ts`
- **Location**: `src/lib/ingestion/db-loader.ts`, lines 155 and 197
- **Verbatim Code**:
  ```typescript
  const { data: existingThirdParties, error: tpError } = await client
    .from('third_parties')
    .select('id, document_number');

  const { data: existingAccounts, error: accError } = await client
    .from('puc_accounts')
    .select('code');
  ```
- **Problem**: Queries all records from `third_parties` and `puc_accounts` without filtering by the document numbers or account codes present in the batch (`.in('document_number', docNumbers)`). In production, this causes unbounded memory consumption and excessive network payload.

#### 5. Command Execution Status:
- `run_command` calls for `npx vitest run src/lib/ingestion/` and `npx tsx scripts/test-ingestion-parser.ts` timed out waiting for user interactive permission in the headless execution context. Thorough static code analysis was conducted instead.

---

## 2. Logic Chain

1. **Header/Row Filtering Logic**:
   - Checking `rowTextCombined` across all cell values (including description/concept) was intended to skip Excel summary rows (`TOTAL`, `SUBTOTAL`, `VAN`, `VIENEN`).
   - However, because `rawConcepto` is included in `rowTextCombined`, any description mentioning "total" triggers false-positive row rejection.
   - Conclusion: Summary row detection must inspect `rawCodigo` or `rawNombreCuenta` when empty, or explicitly match summary row structures, but NEVER match transaction concept text.

2. **Database Upsert Constraint Alignment**:
   - `0000_initial_schema.sql` explicitly establishes `unique(document_type, document_number)`.
   - `db-loader.ts` line 182 specifies `onConflict: 'document_number'`.
   - Supabase / Postgres driver requires exact match of constraint columns for ON CONFLICT resolution.
   - Conclusion: Fix conflict target to `'document_type,document_number'`.

3. **Read-Only Path Guard Hardening**:
   - Base directory containment checks using string prefixing must account for path boundaries (`path.sep`).
   - `path.relative(baseDir, targetPath)` is the standard secure pattern.

4. **Integrity Assessment**:
   - No evidence of hardcoded test outputs or fake facade implementations.
   - Code logic is genuine, but contains high-impact functional and database integration bugs that require correction before approval.

---

## 3. Caveats

- Interactive command permissions timed out in environment; test execution could not be run synchronously in shell.
- Unit tests in `excel-parser.test.ts` passed mock data without descriptions containing the word "total", obscuring the false-positive filtering bug during basic unit test runs.

---

## 4. Conclusion

**Verdict**: REQUEST_CHANGES

### Required Action Items for Implementer (`m1_worker_1`):
1. **Fix `excel-parser.ts` row filtering logic**:
   Do NOT check `rowTextCombined.includes('total')` on transaction descriptions. Limit subtotal/total row checking to `rawCodigo` / `rawNombreCuenta` when `rawCodigo` is missing or specifically identifies a total row.
2. **Fix `db-loader.ts` upsert constraint target**:
   Change `onConflict: 'document_number'` to `onConflict: 'document_type,document_number'`.
3. **Harden `readonly-guard.ts` containment check**:
   Use `path.relative` or append `path.sep` to `normalizedBase` to prevent prefix collision with sibling directories.
4. **Optimize `db-loader.ts` lookups**:
   Filter `third_parties` and `puc_accounts` queries using `.in('document_number', docNumbers)` and `.in('code', accountCodes)`.

---

## 5. Verification Method

1. **Verify Filtering Fix**:
   Add a unit test in `excel-parser.test.ts` with line concept `"Pago total factura 123"`. Ensure the entry is parsed and not skipped.
2. **Verify Database Upsert**:
   Run `db-loader.test.ts` and test against real/local Supabase instance to confirm upsert succeeds against `(document_type, document_number)`.
3. **Verify Read-Only Path Safety**:
   Run `readonly-guard.test.ts` including a test case for `mockBackupDir + '-evil/file.xlsx'`. Confirm it throws `PathTraversalError`.
