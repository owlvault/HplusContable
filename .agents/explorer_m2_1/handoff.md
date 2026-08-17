# Technical Design & Handoff Report — Explorer M2-1
**Milestone**: Milestone 2 — Movement Processing & Closure Engine  
**Task**: Trial Balance (`getTrialBalance`) Engine & Database Query Architecture Analysis  
**Agent Identity**: `teamwork_preview_explorer` (Explorer 1)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_1`  
**Date**: 2026-08-03  

---

## 1. Observation

1. **Existing `getTrialBalance` Action**:
   - Location: `src/actions/reportes.ts` (lines 151–217).
   - Current implementation queries `journal_lines` in period `[startDate, endDate]` where `journal_entries.state != 'ANULADO'`.
   - Aggregates `debit` and `credit` per `account_code`.
   - Missing features:
     * No initial balance (`saldo_inicial`) calculation prior to `startDate`.
     * No dynamic parent PUC account hierarchy rollup (8/6-digit children -> 4 -> 2 -> 1-digit parent accounts).
     * No third-party breakdown (`third_party_id`, `document_number`, `full_name`).
     * Hardcoded period calculation (`year, month`) without arbitrary `[startDate, endDate]` range support.

2. **Database Schema**:
   - Migration file: `supabase/migrations/0000_initial_schema.sql` (lines 44–67).
   - `journal_entries`: `id` (UUID), `date` (TIMESTAMPTZ), `state` (`BORRADOR` | `APROBADO` | `ANULADO`).
   - `journal_lines`: `id` (UUID), `entry_id` (FK to `journal_entries`), `account_code` (FK to `puc_accounts`), `third_party_id` (FK to `third_parties`), `debit` (NUMERIC), `credit` (NUMERIC).
   - `puc_accounts`: `code` (TEXT PK), `name` (TEXT), `type` (`account_type` ENUM), `nature` (`account_nature` ENUM: `'DEBITO'` | `'CREDITO'`), `level` (INT), `parent_code` (FK to `puc_accounts`).
   - `third_parties`: `id` (UUID), `document_type`, `document_number` (TEXT), `full_name` (TEXT).

3. **Data Ingestion Engine Behavior**:
   - Location: `src/lib/ingestion/db-loader.ts` (lines 84, 239–257).
   - Historical entries are loaded with `state = 'APROBADO'`.
   - Unregistered third parties are auto-created and mapped to UUIDs in `third_parties`.
   - Missing PUC accounts are inferred with `inferPucAccountDetails` (lines 4–64) and auto-inserted.

4. **Annual Closing Mechanics**:
   - Location: `src/actions/cierre-anual.ts` (lines 67–139) & `src/lib/utils/closing-calc.ts` (lines 40–71).
   - Cancels nominal accounts (Classes 4–7) at year-end (Dec 31) against equity account `360505` (Utilidad) or `361005` (Pérdida).

---

## 2. Logic Chain

1. **Step 1 — Dual-Bucket Temporal Query Architecture**:
   - To compute a complete Trial Balance for any range `[startDate, endDate]`, movements must be divided into two temporal buckets:
     * **Bucket A (Prior Movements)**: Lines with `journal_entries.date < startDate` and `journal_entries.state = 'APROBADO'`.
     * **Bucket B (Period Movements)**: Lines with `journal_entries.date >= startDate` AND `journal_entries.date <= endDate` and `journal_entries.state = 'APROBADO'`.

2. **Step 2 — Real vs Nominal Account Initial Balance Rules**:
   - **Real Accounts (Classes 1, 2, 3)**: Assets, Liabilities, Equity.
     * Carry balances continuously across all fiscal years.
     * `saldo_inicial` sums ALL prior lines from inception up to `startDate` (`date < startDate`).
   - **Nominal Accounts (Classes 4, 5, 6, 7)**: Revenue, Expenses, Cost of Sales, Production Costs.
     * Reset to `$0.00$` at the start of each fiscal year (Jan 1).
     * `startOfYear = new Date(startDate.getFullYear(), 0, 1)`.
     * `saldo_inicial` sums prior lines ONLY within the SAME fiscal year (`date >= startOfYear` AND `date < startDate`).
     * Lines prior to `startOfYear` (`date < startOfYear`) MUST BE EXCLUDED from nominal accounts' `saldo_inicial`. (Their net result has been transferred to equity `360505`/`361005` via annual closing or belongs to previous closed periods).
     * If `startDate` is Jan 1 (`startDate.getTime() === startOfYear.getTime()`), `saldo_inicial` for all nominal accounts is strictly `$0.00$`.

3. **Step 3 — Nature-Signed Balance Formulas**:
   - **DEBITO Nature Accounts** (Classes 1, 5, 6, 7, 8/9):
     * $\text{Saldo Inicial} = \text{Prior Debit} - \text{Prior Credit}$
     * $\text{Debito} = \text{Period Debit}$
     * $\text{Credito} = \text{Period Credit}$
     * $\text{Saldo Final} = \text{Saldo Inicial} + \text{Debito} - \text{Credito}$
   - **CREDITO Nature Accounts** (Classes 2, 3, 4):
     * $\text{Saldo Inicial} = \text{Prior Credit} - \text{Prior Debit}$
     * $\text{Debito} = \text{Period Debit}$
     * $\text{Credito} = \text{Period Credit}$
     * $\text{Saldo Final} = \text{Saldo Inicial} + \text{Credito} - \text{Debito}$

4. **Step 4 — Third-Party Breakdown (`includeThirdParty`) Architecture**:
   - **When `includeThirdParty = false`**:
     * Aggregation Key: `account_code`.
     * Leaf rows represent individual PUC accounts. `third_party_id`, `document_number`, `third_party_name` remain `null`.
   - **When `includeThirdParty = true`**:
     * Aggregation Key for leaf accounts: `(account_code, third_party_id)`.
     * For each leaf account with movements, sub-rows are generated per third party.
     * Lines with missing/null `third_party_id` are grouped under default generic third party (`document_number: '0'`, `third_party_name: 'CUANTIAS MENORES / GENERAL'`).
     * Parent account rollup rows (1, 2, 4, 6 digits) aggregate all balances across all child third-parties.

5. **Step 5 — Dynamic PUC Hierarchy Aggregation (1, 2, 4, 6, 8 Digits)**:
   - Leaf transactions (posted at 6 or 8 digits) are aggregated first.
   - Parent accounts are auto-discovered by prefix truncation:
     * 8-digit `11050501` -> Subcuenta `110505` -> Cuenta `1105` -> Grupo `11` -> Clase `1`.
   - Parent rows aggregate `saldo_inicial`, `debito`, `credito`, and `saldo_final` from all descendant accounts.
   - Account metadata is fetched from `puc_accounts` or auto-inferred if missing via `inferPucAccountDetails(code)`.

---

## 3. Caveats

1. **Large Dataset Performance**:
   - If the database contains >10,000 journal lines, standard PostgREST queries may hit pagination limits.
   - Mitigation: Implement chunked pagination in Supabase server queries or deploy a dedicated Postgres RPC function `get_trial_balance_data` for DB-side aggregation.
2. **Read-Only Infrastructure Guard**:
   - Investigation did not modify any source code or backup files.
3. **Legacy Balance Discrepancies**:
   - Historical trial balances from Excel may have legacy rounding differences ($\le 0.01$ COP). All internal calculations must maintain cent precision (`Math.round(val * 100) / 100`).

---

## 4. Conclusion & Recommended Technical Design

### Recommended Architecture & Code Layout

We recommend splitting the Trial Balance engine into two clean modules:

1. **Pure Calculation Utility**: `src/lib/utils/trial-balance-calc.ts`
   - Pure functional unit-testable module. No database connection required.
   - Accepts raw array of journal lines with date metadata, options, and PUC account list.
   - Performs dual-bucket temporal filtering (real vs nominal), nature signed calculations, third-party grouping, and parent PUC dynamic rollup.

2. **Server Action & DB Query Layer**: `src/actions/reportes.ts`
   - Entry point: `getTrialBalance(yearOrStartDate, monthOrEndDate?, options?)`.
   - Queries `journal_lines` joined with `journal_entries` and `third_parties`.
   - Passes fetched data to `trial-balance-calc.ts` to construct `TrialBalanceReport`.

### Proposed Data Contracts & Interfaces

```typescript
// Interfaces for src/lib/utils/trial-balance-calc.ts

export interface TrialBalanceOptions {
  includeThirdParty?: boolean;
  accountLevel?: number; // Optional level filter (1=Clase .. 5=Auxiliar)
  showZeroBalances?: boolean; // Include accounts with 0 initial and 0 movements
}

export interface RawJournalLineData {
  account_code: string;
  entry_date: string; // ISO date string (YYYY-MM-DD)
  debit: number;
  credit: number;
  third_party_id: string | null;
  document_number?: string | null;
  third_party_name?: string | null;
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  level: number;
  nature: 'DEBITO' | 'CREDITO';
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN';
  parent_code: string | null;
  
  // Third party fields (present when includeThirdParty = true for leaf rows)
  third_party_id?: string | null;
  document_number?: string | null;
  third_party_name?: string | null;
  
  // Numeric Balances (COP)
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;
}

export interface TrialBalanceReport {
  startDate: string;
  endDate: string;
  includeThirdParty: boolean;
  items: TrialBalanceItem[];
  totals: {
    saldo_inicial_debito: number;
    saldo_inicial_credito: number;
    total_debito: number;
    total_credito: number;
    saldo_final_debito: number;
    saldo_final_credito: number;
    is_balanced: boolean;
  };
}
```

---

## 5. Verification Method

1. **Unit Testing Utility Core (`src/lib/utils/trial-balance-calc.test.ts`)**:
   - Run `npx vitest run src/lib/utils/trial-balance-calc.test.ts`.
   - Test cases to include:
     * Multi-year real account balance carry-over (Classes 1-3).
     * Fiscal year-end nominal account reset on Jan 1 (Classes 4-7).
     * Mid-year nominal account initial balance calculation (`startDate = 2026-03-01` includes Jan-Feb 2026 movements only).
     * Dynamic rollup verification (Level 5 -> 4 -> 3 -> 2 -> 1).
     * Third-party breakdown toggle (`includeThirdParty: true` vs `false`).

2. **Integration Verification**:
   - Execute `getTrialBalance(2026, 1, { includeThirdParty: true })` against populated database and verify double-entry equality ($\sum \text{debito} === \sum \text{credito}$).

3. **Invalidation Conditions**:
   - The design is invalidated if nominal accounts carry initial balances across fiscal years without resetting to $0.00$ on Jan 1, or if parent PUC account rollups do not equal the sum of their child account rows.
