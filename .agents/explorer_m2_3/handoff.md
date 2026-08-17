# Handoff Report — Explorer 3 (Annual Closure Mechanics & Testing Strategy)

**Agent Identity**: teamwork_preview_explorer (Explorer 3 for Milestone 2: Movement Processing & Closure Engine)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_3`  
**Target Milestone**: Milestone 2 — Movement Processing & Closure Engine  
**Date**: 2026-08-03  

---

## 1. Observation

1. **Scope & Technical Requirements (`.agents/sub_orch_m2/SCOPE.md`)**:
   - `getTrialBalance` engine upgrade requires:
     - Real accounts (Classes 1, 2, 3) carry cumulative initial balances across all previous years.
     - Nominal accounts (Classes 4, 5, 6, 7) carry forward prior period balances *within the same fiscal year*, but reset to $0.00$ initial balance on Jan 1 of a new fiscal year.
     - Net annual profit/loss (Ingresos - Gastos/Costos) transfers to Equity account `360505` (Utilidad del ejercicio) when Net Result $\ge 0$, or `361005` (Pérdida del ejercicio) when Net Result $< 0$.
     - Dynamic PUC rollup across levels 1 (Clase), 2 (Grupo), 3 (Cuenta 4d), 4 (Subcuenta 6d), 5 (Auxiliar 8d).
     - Third-party breakdown option (`includeThirdParty: true`).

2. **Existing Annual Closure Engine (`src/lib/utils/closing-calc.ts` & `src/actions/cierre-anual.ts`)**:
   - `computeClosingEntry` takes an array of `ResultAccountBalance` for types `'INGRESO'`, `'GASTO'`, `'COSTO_VENTAS'`, `'COSTO_PRODUCCION'`.
   - Calculates `totalIncome`, `totalExpense`, and `netResult = totalIncome - totalExpense`.
   - Generates closing lines: debits Class 4 accounts, credits Class 5, 6, 7 accounts, and posts `netResult` to `360505` (credit) if $\ge 0$, or `361005` (debit) if $< 0$.
   - `closeFiscalYear(year)` in `cierre-anual.ts` queries approved transactions for year $Y$, generates the closing journal entry via RPC `create_journal_entry` on Dec 31, approves it, and inserts a row into `year_end_closings`.

3. **Current Trial Balance Implementation (`src/actions/reportes.ts`)**:
   - Lines 151–217: `getTrialBalance(year, month)` currently only queries `journal_lines` within a single month `[startDate, endDate]`.
   - **Gaps identified**:
     - Does not calculate initial balances (`saldo_inicial`).
     - Does not perform PUC parent aggregation (only lists raw account lines).
     - Does not handle fiscal year boundary resets for nominal accounts (Classes 4–7).
     - Does not support third-party breakdown.
     - Does not allow toggling `excludeClosingEntries` for pre-close vs post-close trial balance reporting.

4. **Existing Test Suite (`src/lib/utils/closing-calc.test.ts` & `tests/e2e/tier3-multi-period-closures.test.ts`)**:
   - `closing-calc.test.ts` verifies pure closing calculation functions.
   - `tier3-multi-period-closures.test.ts` contains E2E tests for multi-month roll-forward, annual closure resets, profit/loss equity assignment, and 3-year propagation.

---

## 2. Logic Chain

1. **Step 1 — Interaction between Fiscal Year Closures & `getTrialBalance`**:
   To compute `getTrialBalance` accurately across period transitions, the engine must support two operational realities:
   - **Case A: Physical Closing Entry Present**: If `closeFiscalYear(Y)` was executed, a physical journal entry exists on Dec 31, $Y$. Cumulative queries on `journal_lines` prior to Jan 1, $Y+1$ naturally include this entry, bringing Class 4–7 cumulative balances to $0.00$ and transferring net income to `360505`/`361005`.
   - **Case B: Implicit / Dynamic Year Reset**: If no physical closing entry exists for year $Y$ (e.g., historical ingestion before formal year-end close), `getTrialBalance` must dynamically isolate nominal account queries to the current fiscal year $Y_{\text{start}}$ (range $[\text{Jan 1, } Y_{\text{start}}, \text{startDate})$) so nominal accounts start at $0.00$ on Jan 1, AND dynamically add unclosed prior-year net result to `360505`/`361005` initial balance. This guarantees double-entry balance ($\sum \text{Debits} = \sum \text{Credits}$) under all circumstances.

2. **Step 2 — Pre-Closing vs Post-Closing Trial Balance Reporting**:
   - Users viewing the Trial Balance for Month 12 (December) need to inspect operating revenue and expenses **before** they are zeroed out by the year-end closing entry.
   - We introduce an optional parameter `excludeClosingEntries: boolean = true` (default `true` for regular monthly queries, `false` for post-close audits). When `true`, lines belonging to journal entries of type `CIERRE` or listed in `year_end_closings` are filtered out of the monthly movement calculations.

3. **Step 3 — Sign and Nature Rules**:
   - **Debit Nature** (Classes 1, 5, 6, 7): $\text{Saldo Final} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$
   - **Credit Nature** (Classes 2, 3, 4): $\text{Saldo Final} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$

4. **Step 4 — Comprehensive Test Architecture**:
   To guarantee complete verification, tests must be organized across three distinct tiers:
   - **Unit Tests**: Pure calculation tests (`trial-balance-calc.test.ts`, `closing-calc.test.ts`).
   - **Server Action Integration Tests**: Database-backed tests verifying `getTrialBalance` with real DB schemas (`reportes.test.ts`).
   - **E2E & Historical Comparison Tests**: Multi-period roll-forward and baseline comparison against historical backup Excel files (`tier3-multi-period-closures.test.ts` & `tier4-real-world-comparison.test.ts`).

---

## 3. Caveats

1. **Unclosed Legacy Periods**: When processing historical Excel data spanning 2016–2026, some prior years may lack explicit annual closing journal entries. The dynamic virtual closure mechanism in `getTrialBalance` handles this seamlessly, but generating formal financial statements for closed years will require calling `closeFiscalYear(year)`.
2. **Account 360505 vs 361005 Routing**: Colombian PUC specifies `360505` (Utilidad del ejercicio) for positive net results and `361005` (Pérdida del ejercicio) for negative net results. In subsequent years, retained earnings are typically transferred to `370505` (Utilidades acumuladas) or `371005` (Pérdidas acumuladas). The initial implementation focuses on `360505`/`361005` as specified in M2 scope.
3. **Rounding in COP**: All calculations must use `Math.round(amount * 100) / 100` (or integer COP rounding) to prevent floating-point cumulative drift over multi-year roll-forwards.

---

## 4. Conclusion & Recommended Implementation Plan

### 4.1 Recommended Implementation Architecture (`src/lib/utils/trial-balance-calc.ts`)

Create a core pure calculation module `src/lib/utils/trial-balance-calc.ts` to separate pure accounting math from database queries:

```typescript
export interface BalanceQueryOptions {
  year: number;
  month: number;
  includeThirdParty?: boolean;
  excludeClosingEntries?: boolean; // Default true
}

export interface RawJournalLine {
  account_code: string;
  third_party_id?: string | null;
  third_party_name?: string | null;
  debit: number;
  credit: number;
  entry_date: string;
  is_closing_entry?: boolean;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  level: number; // 1, 2, 3, 4, 5
  nature: 'DEBITO' | 'CREDITO';
  third_party_id?: string | null;
  third_party_name?: string | null;
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;
}
```

#### Core Calculation Functions:
1. `calculateInitialBalances(lines: RawJournalLine[], startDate: Date): Map<string, number>`:
   - For Classes 1, 2, 3: sums movements prior to `startDate`.
   - For Classes 4, 5, 6, 7: sums movements from `Jan 1 of year(startDate)` up to `startDate`.
   - Calculates prior unclosed years' net profit/loss and adjusts `360505`/`361005` initial balance accordingly.
2. `aggregateMovements(lines: RawJournalLine[], includeThirdParty: boolean): Map<string, { debit: number; credit: number }>`:
   - Aggregates debits and credits for lines within the query range `[startDate, endDate]`.
3. `rollupPUCTree(leafBalances: Map<string, TrialBalanceRow>): TrialBalanceRow[]`:
   - Dynamically rolls up 8-digit auxiliary balances to 6d, 4d, 2d, 1d parent accounts.

---

### 4.2 Recommended Test Plan

#### Suite 1: Pure Engine Unit Tests (`src/lib/utils/trial-balance-calc.test.ts`)
- **Single-Month Trial Balance**: Test correct initial balance, debit/credit movements, and final balance calculation for debit and credit nature accounts.
- **Multi-Month In-Year Accumulation**: Test Jan -> Feb -> Mar movement carry-over where nominal accounts accumulate YTD in initial balance for Feb and Mar.
- **Cross-Year Boundary Reset**:
  - Verify Jan 1 of year $Y+1$ resets Class 4-7 initial balances to $0.00$.
  - Verify Class 1-3 initial balances carry forward 100% of ending balance from Dec 31 of year $Y$.
- **Net Profit / Loss Equity Assignment**:
  - Test Net Profit > 0: credited to `360505`.
  - Test Net Loss < 0: debited to `361005`.
- **Pre-Close vs Post-Close Filter**:
  - Test `excludeClosingEntries = true` omits `CIERRE` entries from Dec movements.
  - Test `excludeClosingEntries = false` includes `CIERRE` entries, showing Class 4-7 ending balances as $0.00$.

#### Suite 2: Server Action Integration Tests (`src/actions/reportes.test.ts`)
- Database query integration using test seed data.
- Validate `getTrialBalance(year, month, options)` returns correct hierarchy structure and passes accounting identity test ($\sum \text{Debits} = \sum \text{Credits}$).
- Validate `includeThirdParty = true` includes leaf third-party rows whose total matches the parent account row balance.

#### Suite 3: Multi-Year & Closure E2E Tests (`tests/e2e/tier3-multi-period-closures.test.ts`)
- Full 12-month roll-forward verification.
- Annual closure execution via `closeFiscalYear`.
- 3-Year propagation test (2023 -> 2024 -> 2025).
- Infrastructure protection guard verification (zero modifications to `Backup/` directory).

---

## 5. Verification Method

1. **Verify Report Location**:
   - Inspect `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_3\handoff.md`.
2. **Run Existing Vitest Test Suite**:
   - Command: `npx vitest run src/lib/utils/closing-calc.test.ts tests/e2e/tier3-multi-period-closures.test.ts`
3. **Invalidation Conditions**:
   - The analysis would be invalidated if Colombian PUC rules permitted Class 4–7 balances to carry over across fiscal year boundaries without resetting to 0, or if debit/credit signed math failed to maintain $\sum \text{Debits} = \sum \text{Credits}$.
