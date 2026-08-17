# Milestone 1 Exploration & Design Report — Data Ingestion Engine

**Author**: Explorer Subagent (m1_explorer_1)  
**Date**: 2026-08-03  
**Target Milestone**: Milestone 1 (Data Ingestion Engine)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_explorer_1`

---

## 1. Observation

### 1.1 Codebase & Dependency Analysis
- **`package.json`**:
  - Current production dependencies: `@supabase/supabase-js` (`^2.90.1`), `@supabase/ssr` (`^0.8.0`), `pg` (`^8.22.0`), `next` (`15.1.0`), `react` (`^19.0.0`), `vitest` (`^4.0.17`).
  - **Missing Dependency**: Neither `exceljs` nor `xlsx` is currently listed in `package.json`. Parsing historical Excel files (`.xlsx`) in the ingestion script will require installing an Excel parsing library (e.g. `xlsx` or `exceljs`).

- **`src/types/database.ts`**:
  - Defines TypeScript definitions for `puc_accounts`, `third_parties`, `company_settings`, `journal_entries`, and `journal_lines`.

### 1.2 Database Schema & Migration Analysis (`supabase/migrations/`)
- **`journal_entries`** (Header table, `0000_initial_schema.sql:44-53`):
  - `id`: `uuid primary key default uuid_generate_v4()`
  - `date`: `timestamp with time zone not null` (ISO 8601 string in TS interface)
  - `description`: `text not null`
  - `sequence_number`: `serial` (auto-incrementing sequence)
  - `state`: `entry_state default 'BORRADOR'` (enum values: `'BORRADOR'`, `'APROBADO'`, `'ANULADO'`)
  - `created_by`: `uuid references auth.users(id)` (nullable)
  - `created_at`: `timestamp with time zone default timezone('utc'::text, now()) not null`
  - `updated_at`: `timestamp with time zone default timezone('utc'::text, now()) not null`
  - *Trigger immutability* (`0007_fase5_document_sequences_immutability.sql:50-74`): Trigger `trg_prevent_approved_entry_changes` raises an exception if any attempt is made to update `description` or `date` or delete an entry with state `'APROBADO'`.

- **`journal_lines`** (Detail table, `0000_initial_schema.sql:56-67`):
  - `id`: `uuid primary key default uuid_generate_v4()`
  - `entry_id`: `uuid references journal_entries(id) on delete cascade not null`
  - `account_code`: `text references puc_accounts(code) not null`
  - `third_party_id`: `uuid references third_parties(id)` (nullable)
  - `debit`: `numeric(20, 2) default 0` with constraint `check (debit >= 0)`
  - `credit`: `numeric(20, 2) default 0` with constraint `check (credit >= 0)`
  - `description`: `text` (nullable)
  - *Trigger immutability* (`0007_fase5_document_sequences_immutability.sql:77-95`): Trigger `trg_prevent_approved_line_changes` blocks UPDATE or DELETE on lines linked to an entry with state `'APROBADO'`.

- **Foreign Key & Period Dependencies**:
  - `puc_accounts`: Primary key is `code` (`text`). `journal_lines.account_code` references `puc_accounts.code`. Foreign key constraint will fail if an account code in an entry is not present in `puc_accounts`.
  - `third_parties`: Primary key is `id` (`uuid`). Unique constraint on `(document_type, document_number)`. `journal_lines.third_party_id` references `third_parties.id`.
  - `accounting_periods`: Table exists for tracking closed periods (`src/actions/cierre.ts:6-16`), but there is **no direct foreign key constraint** on `journal_entries` or `journal_lines`. The accounting period for an entry is dynamically evaluated using `journal_entries.date`.

### 1.3 Double-Entry Validation Analysis
- **`src/actions/accounting.ts`** (`createJournalEntry`):
  ```typescript
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (isApproved && Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Partida Doble invalida: Debito ${totalDebit} vs Credito ${totalCredit}`);
  }
  ```
  - Standard double-entry tolerance is set to **0.01 COP** (`Math.abs(totalDebit - totalCredit) <= 0.01`).

- **`supabase/migrations/0001_rpc_journal.sql`** (`create_journal_entry`):
  - Iterates through `p_lines` jsonb array and inserts header + lines. In the database RPC, balance validation is soft because entries start as `'BORRADOR'`.

- **`src/actions/cierre.ts`** (`validatePeriodForClosing`):
  - Aggregates debits and credits per `entry_id` and flags entries where `Math.abs(totalDebit - totalCredit) > 0.01` as unbalanced.

### 1.4 Backup Directory Structure (`C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`)
- Contains 29 Excel `.xlsx` files:
  - `[YEAR] Libro diario-*.xlsx` (2016 through 2026)
  - `[YEAR] Balance de prueba por tercero-*.xlsx` (2020 through 2026)
  - `[YEAR] Movimiento auxiliar por cuenta contable.xlsx` (2016 through 2026)

---

## 2. Logic Chain

1. **Dependency Requirement**:
   - Observation: `package.json` lacks an Excel parsing library.
   - Deduction: Before implementing the parser (M1.2), `exceljs` or `xlsx` must be added to dependencies. `xlsx` or `exceljs` provides low-memory stream/sheet reading for large files.

2. **Schema & Foreign Key Alignment**:
   - Observation: `journal_lines` requires `account_code` referencing `puc_accounts(code)` and nullable `third_party_id` referencing `third_parties(id)`.
   - Deduction: The Ingestion Data Loader cannot blindly insert raw Excel rows. It must:
     a. Cache existing `puc_accounts` codes in memory; fail or auto-create missing accounts.
     b. Resolve third party document numbers from Excel against `third_parties`. If a third party does not exist, auto-upsert it into `third_parties` to retrieve its `uuid` before inserting `journal_lines`.

3. **Double-Entry Balance Enforcement**:
   - Observation: `accounting.ts` and `cierre.ts` both enforce `Math.abs(totalDebit - totalCredit) <= 0.01`.
   - Deduction: The Ingestion Engine MUST perform an in-memory double-entry balance check per journal entry before submitting batch database writes. Any unbalanced entry must be rejected or reported without breaking valid entries.

4. **Insertion Strategy & Performance Choice**:
   - Observation: Single entry RPC calls (`createJournalEntry`) perform HTTP/RPC network overhead per entry, which is slow for thousands of historical transactions. `pg` is already in `package.json` (`pg: ^8.22.0`).
   - Deduction: A **batch database insertion strategy** using either direct PostgreSQL pool (`pg`) or Supabase JS batch `.insert([...])` with client-side UUID generation (`crypto.randomUUID()`) is necessary.
   - Executing insertions within an explicit SQL transaction block (`BEGIN ... COMMIT`) guarantees atomicity so that invalid batches roll back completely.

---

## 3. Caveats

1. **Environment Variables**:
   - Direct `pg` execution requires a valid database connection string (`DATABASE_URL` or `SUPABASE_DB_URL`). If running via `@supabase/supabase-js`, `SUPABASE_SERVICE_ROLE_KEY` is required to bypass RLS during administrative batch loads.
2. **Missing PUC Accounts**:
   - Historical files may reference legacy auxiliary PUC accounts (8 digits) that are not present in `puc_accounts`. The loader must handle auto-creation of missing accounts or operate with a flexible PUC seed.
3. **Read-Only Directory Constraint**:
   - All parser operations on `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` MUST use read-only file streams (`fs.createReadStream` or buffer reading) and must NEVER open files in write/append mode.

---

## 4. Conclusion & Recommendations

### 4.1 Recommended TypeScript Interfaces for Data Ingestion Engine

Place these interfaces in `src/lib/ingestion/types.ts`:

```typescript
export interface ParsedJournalLine {
    account_code: string;
    account_name?: string;
    third_party_doc?: string | null;
    third_party_name?: string | null;
    debit: number;
    credit: number;
    description?: string | null;
}

export interface ParsedJournalEntry {
    date: string; // ISO 8601 YYYY-MM-DD
    voucher_type?: string; // e.g., 'CI', 'CE', 'NC', 'DS'
    voucher_number?: string | number;
    description: string;
    lines: ParsedJournalLine[];
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
}

export interface IngestionOptions {
    batchSize?: number; // default: 500 headers per batch
    autoCreateThirdParties?: boolean; // default: true
    autoCreatePucAccounts?: boolean; // default: false (warnings generated)
    toleranceCOP?: number; // default: 0.01
    defaultState?: 'BORRADOR' | 'APROBADO'; // default: 'APROBADO' for historical data
}

export interface IngestionResult {
    success: boolean;
    totalEntriesProcessed: number;
    totalLinesProcessed: number;
    entriesInserted: number;
    linesInserted: number;
    thirdPartiesCreated: number;
    errors: Array<{ entryIndex?: number; voucherRef?: string; message: string }>;
    warnings: string[];
    executionTimeMs: number;
}
```

### 4.2 Recommended Database Insertion Strategy

1. **Pre-Processing Step (In-Memory)**:
   - Group raw lines into entries by Date + Voucher/Concept.
   - Verify `Math.abs(total_debit - total_credit) <= 0.01`.
   - Pre-fetch third-party mappings `(document_type, document_number) -> id`. Bulk insert any missing third parties and cache their UUIDs.

2. **Batch Transaction Pipeline**:
   - Generate `id` for each `journal_entries` row using `crypto.randomUUID()`.
   - Map each line to `entry_id` (using generated UUID), `account_code`, `third_party_id`, `debit`, `credit`, `description`.
   - Execute batch inserts in chunks:
     - Header chunk size: 500 rows (`INSERT INTO journal_entries ...`)
     - Detail chunk size: 2,000 rows (`INSERT INTO journal_lines ...`)
   - Direct `pg` transaction (`BEGIN; ... COMMIT;`) or Supabase Service Role client bulk queries guarantee high throughput (>1,000 entries/sec) and strict rollback on error.

---

## 5. Verification Method

1. **File Inspection**:
   - Verify `handoff.md` exists at `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_explorer_1\handoff.md`.
2. **Schema Alignment Verification**:
   - Run `npx vitest run` or test suite once ingestion script M1.3 is implemented to confirm zero foreign key constraint violations against `puc_accounts` and `third_parties`.
3. **Double-Entry Test**:
   - Execute test entries with unbalanced amounts (e.g. debit 100, credit 90) to confirm rejection by tolerance check (`<= 0.01`).
