# Accounting Movement Logic & Verification Rules Analysis for CFO-AI

**Date**: 2026-08-03  
**Author**: teamwork_preview_explorer (Accounting & Verification Explorer)  
**Target Project**: CFO-AI (`C:\Users\ccarvajalino\OneDrive\Proyectos\Contable`)  
**Data Source (Read-Only)**: `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`

---

## Executive Summary

This report provides the detailed accounting logic, Plan Único de Cuentas (PUC) hierarchical aggregation rules, backup Excel data structure analysis, and automated comparison test specifications required for production readiness of CFO-AI.

The primary objective is to enable CFO-AI to ingest historical transaction data from Excel backup files, compute trial balances across single and multi-period closures, and verify generated balances programmatically against historical "Balance de Prueba por Tercero" reports.

---

## 1. Rules for Processing Ledger Transactions into Period Balances

### 1.1 Ledger Transaction Input Structure
Every accounting transaction (Comprobante Contable / Asiento) consists of:
- **Header (`journal_entries`)**: Date (`date`), Description (`description`), Voucher Type/Sequence (`sequence_number`), Status (`state`: APROBADO, BORRADOR, ANULADO).
- **Details (`journal_lines`)**: Account Code (`account_code`), Third Party (`third_party_id`), Debit Amount (`debit` $\ge 0$), Credit Amount (`credit` $\ge 0$), Description.

### 1.2 Fundamental Accounting Identity (Double-Entry / Partida Doble)
For every approved journal entry $E$:
$$\sum_{l \in E} \text{debit}_l = \sum_{l \in E} \text{credit}_l$$
Any unapproved draft entry (`BORRADOR`) or voided entry (`ANULADO`) must be excluded from period balance calculations.

### 1.3 Account Nature (Naturaleza Contable) & Sign Formulas
Colombian accounting (Decreto 2650/1993 / NIIF) defines account natures based on the 1-digit Class prefix:

| Class Code | Class Name | Account Type | Nature | Balance Formula |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Activo | ACTIVO | Débito (DB) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$ |
| **2** | Pasivo | PASIVO | Crédito (CR) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$ |
| **3** | Patrimonio | PATRIMONIO | Crédito (CR) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$ |
| **4** | Ingresos | INGRESO | Crédito (CR) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$ |
| **5** | Gastos | GASTO | Débito (DB) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$ |
| **6** | Costos de Ventas | COSTO_VENTAS | Débito (DB) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$ |
| **7** | Costos de Producción | COSTO_PRODUCCION | Débito (DB) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$ |
| **8** | Cuentas de Orden Deudoras | CUENTAS_ORDEN | Débito (DB) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$ |
| **9** | Cuentas de Orden Acreedoras | CUENTAS_ORDEN | Crédito (CR) | $\text{Saldo} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$ |

### 1.4 Period Balance Components
For a given target period $P = [T_{\text{start}}, T_{\text{end}}]$ (e.g., Month $M$ of Year $Y$):
1. **Saldo Inicial (Initial Balance)**: Accumulated balance of all approved transactions from company inception (or initial data migration date) up to $T_{\text{start}} - 1 \text{ second}$.
2. **Movimiento Débito (Period Debit Movement)**: Sum of all debits posted to the account between $T_{\text{start}}$ and $T_{\text{end}}$.
3. **Movimiento Crédito (Period Credit Movement)**: Sum of all credits posted to the account between $T_{\text{start}}$ and $T_{\text{end}}$.
4. **Saldo Final (Final Balance)**: Resulting balance at $T_{\text{end}}$ after combining Saldo Inicial with period movements.

### 1.5 Multi-Period Carry-over & Annual Closures
- **Balance Sheet Accounts (Classes 1, 2, 3)**:
  $$\text{Saldo Inicial}(P_{t}) = \text{Saldo Final}(P_{t-1})$$
  Balances accumulate indefinitely across fiscal years.
- **Income Statement / Nominal Accounts (Classes 4, 5, 6, 7)**:
  - Within a fiscal year (Jan 1 to Dec 31), movements accumulate month-over-month.
  - At fiscal year-end (Dec 31), an **Asiento de Cierre Anual** (closing entry) is executed:
    - Debits total income (Class 4) to bring accounts to $0.00$.
    - Credits total expenses/costs (Classes 5, 6, 7) to bring accounts to $0.00$.
    - Posts the net difference to Equity account `360505` (Utilidad del Ejercicio) or `361005` (Pérdida del Ejercicio).
  - Consequently, on **Jan 1 of Year $Y+1$**, initial balances for nominal accounts (Classes 4–7) MUST reset to **$0.00$**.

---

## 2. PUC (Plan Único de Cuentas) Account Rollups & Hierarchy Logic

### 2.1 PUC Digit Structure & Naming Standard
Colombian PUC is structured hierarchically by code string length:

| Level | Name | Digit Length | Example Code | Example Name |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | Clase | 1 digit | `1` | ACTIVO |
| **Level 2** | Grupo | 2 digits | `11` | DISPONIBLE |
| **Level 3** | Cuenta | 4 digits | `1105` | CAJA |
| **Level 4** | Subcuenta | 6 digits | `110505` | CAJA GENERAL |
| **Level 5/6** | Auxiliar | 8+ digits | `11050501` | CAJA GENERAL PRINCIPAL |

### 2.2 Dynamic Rollup / Aggregation Algorithm
Transactions are strictly posted to **Auxiliary / Leaf accounts** (e.g. 8-digit or 6-digit codes). Parent accounts (Subcuenta, Cuenta, Grupo, Clase) do not receive direct transaction postings; their values are calculated by aggregating child accounts.

#### Rollup Rules:
1. **Parent-Child Association**: Account $C$ is a descendant of parent $P$ if `C.code.startsWith(P.code)`.
2. **Aggregation Formula for Parent Node $P$**:
   $$\text{MovDeb}(P) = \sum_{C \in \text{LeafDescendants}(P)} \text{MovDeb}(C)$$
   $$\text{MovCred}(P) = \sum_{C \in \text{LeafDescendants}(P)} \text{MovCred}(C)$$
   $$\text{SaldoInicial}(P) = \sum_{C \in \text{LeafDescendants}(P)} \text{SaldoInicial}(C)$$
   $$\text{SaldoFinal}(P) = \sum_{C \in \text{LeafDescendants}(P)} \text{SaldoFinal}(C)$$
3. **Parent Node Auto-Creation**: If an auxiliary account (e.g. `11050501`) is imported but parent nodes (`110505`, `1105`, `11`, `1`) do not exist in `puc_accounts`, the system must auto-populate the missing parent metadata to prevent broken hierarchy trees in financial reports.

---

## 3. Analysis of Historical Backup Files in `Backup` Directory

### 3.1 Directory Survey (`C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`)
The directory contains 29 Excel files spanning 2016 through 2026:
1. **Libro Diario (Daily Transaction Journal)**: Files named `[YEAR] Libro diario-[TIMESTAMP].xlsx` (2016–2026).
   - Contains raw transactional lines (Date, Document/Voucher Number, Account Code, Account Description, Third Party Document/Name, Concept, Debit, Credit).
2. **Movimiento Auxiliar por Cuenta Contable**: Files named `[YEAR] Movimiento auxiliar por cuenta contable.xlsx` (2016–2026).
   - Details historical postings grouped per account code, showing initial balance, period detail rows, and running balances.
3. **Balance de Prueba por Tercero (Historical Source of Truth Trial Balances)**: Files named `[YEAR] Balance de prueba por tercero-[TIMESTAMP].xlsx` (2020–2026).
   - Serves as the **official source of truth** for trial balance verification.

### 3.2 Trial Balance Sheet Layout & Data Presentation
Historical Trial Balance reports (`Balance de prueba por tercero-*.xlsx`) display accounting balances with the following structure:
- **Grouping**: Grouped by Account Code (PUC) and Sub-grouped by Third Party (NIT / Identification Number & Name).
- **Columns**:
  1. `Código / Cuenta`: Account code string (1, 2, 4, 6, 8 digits).
  2. `Nombre / Descripción`: Account title or Third party full name.
  3. `Identificación / Tercero`: Third party NIT/CC (when broken down by third party).
  4. `Saldo Inicial`: Initial balance (expressed as signed float or split into Initial Debit / Initial Credit).
  5. `Débitos`: Total debit transactions in the period.
  6. `Créditos`: Total credit transactions in the period.
  7. `Saldo Final`: Net ending balance (expressed as signed float or split into Final Debit / Final Credit).

---

## 4. Precise Logic for Automated Comparison & Verification Test Script

### 4.1 Verification Workflow Architecture
The automated verification script must execute a end-to-end audit:
1. **Ingest Raw Transactions**: Parse `Libro Diario` Excel files for period $P$ into a clean transaction structure.
2. **Compute Trial Balance Programmatically**: Run CFO-AI calculation logic to produce generated trial balance records for period $P$.
3. **Parse Historical Benchmark**: Read `Balance de prueba por tercero-*.xlsx` for period $P$ as benchmark.
4. **Compare Generated vs Historical**: Perform row-by-row and rollup-by-rollup reconciliation.

```
[ Excel Backup: Libro Diario ] ──> [ CFO-AI Calculation Engine ] ──> [ Generated Trial Balance ]
                                                                             │
                                                                       (Compare)
                                                                             │
[ Excel Backup: Balance de Prueba ] ─────────────────────────────────────────┘
```

### 4.2 Account Code Normalization & Matching Rules
- **Formatting Cleanup**: Strip spaces, hyphens, non-numeric characters (except standard leading zeros if applicable).
- **Matching Level**:
  - Compare at detail/auxiliary level (matching `account_code` + `third_party_document`).
  - Compare at PUC rollup level (4-digit `Cuenta` and 2-digit `Grupo`).
- **Account Alignment Matrix**:
  - **Match**: Account exists in both Generated and Historical reports $\rightarrow$ Compare numbers.
  - **Missing in Generated**: Account exists in Historical but absent in Generated $\rightarrow$ Flag error if Historical balance $\neq 0.00$.
  - **Missing in Historical**: Account present in Generated but absent in Historical $\rightarrow$ Flag error if Generated balance $\neq 0.00$.

### 4.3 Floating-Point Precision & Rounding Rules
- **Monetary Unit**: Colombian Pesos (COP).
- **Fixed-Precision Rounding**: All intermediate and final calculations must round to 2 decimal places using standard round-half-up:
  $$\text{rounded\_val} = \text{Math.round}(\text{val} \times 100) / 100$$
- **Comparison Tolerance ($\epsilon$)**:
  - Exact match threshold: $\Delta = |\text{Generated} - \text{Historical}| \le 0.01$ COP.
  - Legacy Excel rounding tolerance: $\Delta \le 1.00$ COP for integer rounding differences in legacy ERP software.

### 4.4 Multi-Period Closure & Transition Verification
To verify multi-period continuity:
- The verification script must process Period $P_1$ (e.g. 2024-12) and Period $P_2$ (e.g. 2025-01).
- Verify that `SaldoInicial(2025-01)` for Class 1, 2, 3 accounts matches `SaldoFinal(2024-12)`.
- Verify that `SaldoInicial(2025-01)` for Class 4, 5, 6, 7 accounts resets to `0.00` after applying year-end closing entry (`360505` / `361005`).

---

## 5. Existing Codebase Audit & Gap Analysis

An audit of the existing codebase (`C:\Users\ccarvajalino\OneDrive\Proyectos\Contable`) reveals the following components and gaps:

| Component | Current Implementation Status | Identified Gaps for Production |
| :--- | :--- | :--- |
| **PUC Seed Data** | `supabase/seeds/puc.sql` contains a basic 44-line PUC seed (levels 1, 2, 4, 6). | Complete official Colombian PUC (with 8-digit auxiliaries and dynamic parent creation) is required for real backup files. |
| **Trial Balance Engine** | `getTrialBalance()` in `src/actions/reportes.ts` calculates debits/credits for a period. | **1.** Lacks initial balance (`saldo_inicial`) carry-over calculation.<br>**2.** Lacks parent PUC rollup aggregation.<br>**3.** Lacks third-party dimension breakdown. |
| **Annual Closing Engine** | `computeClosingEntry()` in `src/lib/utils/closing-calc.ts` and `closeFiscalYear()` in `src/actions/cierre-anual.ts`. | Functional for cancellation of result accounts, but needs integration with initial balance reset for new fiscal years. |
| **Excel Ingestion Module** | None found. | Needs dedicated Excel reader/parser for `.xlsx` backup files in `Backup/`. |
| **Automated Verification Script** | None found. | Needs automated test script comparing generated balances against historical `Balance de prueba por tercero` files. |

---

## 6. Actionable Implementation & Verification Plan

1. **Build Excel Data Ingestor (`scripts/ingest-backup.ts` or Python script)**:
   - Parse `Libro diario` Excel files from `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
   - Populate `puc_accounts`, `third_parties`, `journal_entries`, `journal_lines` in Supabase.
2. **Enhance Trial Balance Engine (`src/lib/utils/trial-balance-calc.ts`)**:
   - Implement complete formula: `Saldo Inicial`, `Mov Débito`, `Mov Crédito`, `Saldo Final`.
   - Implement hierarchical parent rollup (1, 2, 4, 6, 8 digits).
   - Support third-party breakdown (`Balance de Prueba por Tercero`).
3. **Develop Automated Comparison Test (`scripts/verify-trial-balance.ts` or PyTest)**:
   - Read historical `Balance de prueba por tercero-*.xlsx`.
   - Execute trial balance computation on ingested data for target period.
   - Run account-by-account comparison with tolerance $\le 0.01$ COP.
   - Report verification metrics (Total Accounts Checked, Mismatches, Difference Delta).

---

## Conclusion
The defined accounting movement rules, PUC rollup algorithms, file layout mappings, and comparison test specifications provide a complete blueprint for making CFO-AI functional and production-ready.
