# Handoff Report — explorer_m2_2

**Agent Identity**: teamwork_preview_explorer (PUC Dynamic Hierarchy Rollup & Account Nature Sign Rules Expert)  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_2`  
**Date**: 2026-08-03  

---

## 1. Observation

1. **Scope and Requirement Files**:
   - `ORIGINAL_REQUEST.md`: Requires processing historical transactions from Backup Excel files into Trial Balances and verifying against historical `Balance de prueba por tercero-*.xlsx` files.
   - `PROJECT.md`: Feature 3 (PUC Dynamic Hierarchy Rollup 8 -> 6 -> 4 -> 2 -> 1 digit), Feature 4 (Initial Balance & Movement Carry-Over), Feature 5 (`getTrialBalance` engine upgrade).
   - `sub_orch_m2/SCOPE.md`: Detailed technical specifications for initial balance carry-over, account nature sign rules, dynamic PUC hierarchy rollup, third-party breakdown, and fiscal year closure.

2. **Existing Implementation Analysis**:
   - `src/actions/reportes.ts` (lines 151–217):
     ```ts
     const balance = account.nature === 'DEBITO' 
         ? bal.debit - bal.credit 
         : bal.credit - bal.debit;
     ```
     - **Deficiency 1**: Operates purely on `journal_lines` within a single period without computing `saldo_inicial` (prior movements).
     - **Deficiency 2**: Filters by `accounts` existing in `puc_accounts` table, dropping lines posted to subcuentas or auxiliaries if their explicit codes or parent codes are absent from the database.
     - **Deficiency 3**: Does not calculate dynamic hierarchical rollup levels (Subcuenta 6-digit, Cuenta 4-digit, Grupo 2-digit, Clase 1-digit).
     - **Deficiency 4**: Does not support third-party breakdown (`third_party_id`, `document_number`, `full_name`).

   - `src/actions/puc.ts` (lines 44–69):
     - `validateAccountHierarchy` enforces that level matches digit length (1-digit = level 1, 2-digit = level 2, 4-digit = level 3, 6-digit = level 4) and `code.startsWith(parent_code)`.
     - Seed file `supabase/seeds/puc.sql` contains only 44 basic accounts (e.g. 1, 11, 1105, 110505, 1110, 111005, etc.). Real historical backup entries contain 8-digit auxiliary codes (e.g., `11050501`, `13050501`) or non-seeded 6-digit codes.

   - `supabase/migrations/0000_initial_schema.sql` (lines 4–17):
     - Enums: `account_nature` ('DEBITO', 'CREDITO') and `account_type` ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO_VENTAS', 'COSTO_PRODUCCION', 'CUENTAS_ORDEN').

---

## 2. Logic Chain

1. **Requirement Analysis**:
   - Colombian PUC accounting standards (Decreto 2650/1993 / NIIF) structure account codes hierarchically by length:
     - Level 1: 1 digit (Clase)
     - Level 2: 2 digits (Grupo)
     - Level 3: 4 digits (Cuenta)
     - Level 4: 6 digits (Subcuenta)
     - Level 5: 8+ digits (Auxiliar)
   - To match historical Trial Balance reports ("Balance de prueba por tercero"), every journal line must be correctly signed according to its account nature, carried forward across prior periods, broken down by third party when requested, and rolled up level-by-level up to Level 1.

2. **Nature Sign Rules Specification**:
   - **DEBITO Nature**: Classes 1 (ACTIVO), 5 (GASTO), 6 (COSTO_VENTAS), 7 (COSTO_PRODUCCION), 8 (CUENTAS_ORDEN DEUDORAS).
     $$\text{Saldo Final} = \text{Saldo Inicial} + \text{Movimiento Débito} - \text{Movimiento Crédito}$$
   - **CREDITO Nature**: Classes 2 (PASIVO), 3 (PATRIMONIO), 4 (INGRESO), 9 (CUENTAS_ORDEN ACREEDORAS).
     $$\text{Saldo Final} = \text{Saldo Inicial} + \text{Movimiento Crédito} - \text{Movimiento Débito}$$

3. **Period Carry-Over & Year-End Rules**:
   - **Real Accounts (Classes 1–3)**: `saldo_inicial` is the cumulative sum of all transactions before `startDate` from system inception.
   - **Nominal Accounts (Classes 4–7)**: `saldo_inicial` is the cumulative sum of transactions within the **current fiscal year** prior to `startDate` (from Jan 1 of the query year up to `startDate - 1 ms`). Transactions from prior fiscal years reset to $0.00$ because they are closed into Equity (`360505`/`361005`).

4. **Dynamic Parent PUC Account Synthesis Solution**:
   - In real-world Excel data, journal lines contain 8-digit auxiliary codes (e.g. `11100501`) or custom subcuentas (e.g. `13050599`) that may NOT exist as explicit rows in `puc_accounts`.
   - If missing parents are not dynamically synthesized:
     - Strict DB queries drop transactions, causing trial balances to fail mathematical identity ($\sum \text{Debits} \ne \sum \text{Credits}$).
     - Parent aggregations miss child balances.
   - **Synthesis Solution**:
     - When building the trial balance tree, for any leaf code $C$, extract its mandatory prefix hierarchy:
       - Level 1: $C[0..1]$ (1 digit)
       - Level 2: $C[0..2]$ (2 digits)
       - Level 3: $C[0..4]$ (4 digits)
       - Level 4: $C[0..6]$ (6 digits)
       - Level 5: $C$ (8+ digits)
     - For each prefix level code $P$:
       - Check if $P$ exists in `puc_accounts` database map.
       - If $P$ exists, use `puc_accounts[P].name`.
       - If $P$ does NOT exist in `puc_accounts`:
         - Synthesize node dynamically!
         - `nature`: If 1st digit $P[0] \in \{'1','5','6','7','8'\}$, nature = `'DEBITO'`; else nature = `'CREDITO'`.
         - `type`: Deduced from 1st digit (1->ACTIVO, 2->PASIVO, 3->PATRIMONIO, 4->INGRESO, 5->GASTO, 6->COSTO_VENTAS, 7->COSTO_PRODUCCION).
         - `name`: Fallback to standard PUC dictionary lookup or default `"CUENTA " + P`.
         - `is_synthesized`: `true`.

5. **Dynamic Rollup Tree Invariants**:
   - At every level $L \in \{1, 2, 3, 4, 5\}$, for every parent account:
     $$\text{Parent.saldo\_inicial} = \sum_{c \in \text{children}} \text{Child}_c.\text{saldo\_inicial}$$
     $$\text{Parent.debito} = \sum_{c \in \text{children}} \text{Child}_c.\text{debito}$$
     $$\text{Parent.credito} = \sum_{c \in \text{children}} \text{Child}_c.\text{credito}$$
     $$\text{Parent.saldo\_final} = \sum_{c \in \text{children}} \text{Child}_c.\text{saldo\_final}$$
   - Global Conservation: Total Level 1 Debits must equal Total Level 1 Credits across the balance sheet and P&L.

---

## 3. Caveats

- **Third-Party Level Granularity**: In Colombian accounting reports, third-party details are typically attached at the leaf level (Level 5 or Level 4). Summary parent rows (Levels 1–3) aggregate across all third parties. The data structure must cleanly support both row types.
- **Fiscal Year Boundary Querying**: When querying a date range that spans across Jan 1 (e.g. Dec 15 to Jan 15), nominal account initial balances must respect the Jan 1 reset threshold.
- **Non-Standard Code Lengths**: If an imported code has odd length (e.g. 5 digits or 7 digits), prefix extraction handles length safely by taking prefixes at lengths 1, 2, 4, 6.

---

## 4. Conclusion & Recommended Architecture

We recommend creating a pure calculation module `src/lib/utils/trial-balance-calc.ts` and upgrading `src/actions/reportes.ts` (`getTrialBalance`).

### Data Structures

```ts
export type AccountNature = 'DEBITO' | 'CREDITO';
export type AccountType = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN';

export interface TrialBalanceRawLine {
    account_code: string;
    third_party_id?: string | null;
    third_party_name?: string | null;
    document_number?: string | null;
    debit: number;
    credit: number;
    entry_date: string;
}

export interface TrialBalanceItem {
    code: string;
    name: string;
    level: number;
    parent_code: string | null;
    nature: AccountNature;
    type: AccountType;
    third_party_id?: string | null;
    third_party_name?: string | null;
    document_number?: string | null;
    saldo_inicial: number;
    debito: number;
    credito: number;
    saldo_final: number;
    is_synthesized?: boolean;
}

export interface TrialBalanceReport {
    items: TrialBalanceItem[];
    totals: {
        saldo_inicial_debito: number;
        saldo_inicial_credito: number;
        debito: number;
        credito: number;
        saldo_final_debito: number;
        saldo_final_credito: number;
    };
}
```

### Complete Algorithm Pipeline

```
┌──────────────────────────────────────────────────────────┐
│ Step 1: Query journal_lines (Prior & Period Range)       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Step 2: Compute Raw Leaf Balances & Nature Signs         │
│ - Prior movements -> saldo_inicial                        │
│ - Current range -> debito, credito                       │
│ - Apply DEBITO/CREDITO sign formulas                     │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Step 3: Prefix Hierarchy Decomposition & Dynamic Synthesis│
│ - For code 11050501 -> prefixes: 110505, 1105, 11, 1      │
│ - Check DB puc_accounts map; if missing, synthesize node │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Step 4: Hierarchical Tree Aggregation                    │
│ - Roll up saldo_inicial, debito, credito, saldo_final    │
│ - Verify parent-child tree conservation invariants       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ Step 5: Format Final Report & Third-Party Rows           │
│ - Sort by account code & third-party                     │
│ - Compute Level 1 global totals                          │
└───────────────────────────┬──────────────────────────────┘
```

---

## 5. Verification Method

1. **Unit Test Verification**:
   - Create `src/lib/utils/trial-balance-calc.test.ts` to test:
     * Nature sign calculations (DEBITO vs CREDITO).
     * Nominal account reset on Jan 1 vs Real account cumulative carry-over.
     * Dynamic synthesis of missing parent accounts (e.g. testing input lines with 8-digit codes when DB map is empty).
     * Hierarchical rollup correctness (Level 5 -> 4 -> 3 -> 2 -> 1).
   - Execute command:
     `npx vitest run src/lib/utils/trial-balance-calc.test.ts`

2. **Integration Verification**:
   - Run existing Vitest tests:
     `npx vitest run`

3. **Invalidation Conditions**:
   - Failure of tree rollup totals matching leaf totals ($\sum \text{Level 1} \ne \sum \text{Leaf}$).
   - Discrepancy between signed final balance and nature formulas.
