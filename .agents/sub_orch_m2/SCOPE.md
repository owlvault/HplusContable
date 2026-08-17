# Scope: Milestone 2 — Movement Processing & Closure Engine

## Architecture
- Sub-system within Next.js / Supabase accounting platform.
- Target files: `src/actions/reportes.ts`, calculation/closing utilities in `src/lib/utils/` (or `src/actions/cierre-anual.ts` / `src/actions/puc.ts`), and unit/integration tests.
- Core engine: Upgraded `getTrialBalance` supporting initial balance carry-over, dynamic PUC hierarchy rollup (8 -> 6 -> 4 -> 2 -> 1 digit), account nature signed math (Debit vs Credit classes), third-party breakdown, and fiscal year-end closing rules (Class 4-7 reset to 0 on Jan 1, carrying profit/loss to 360505/361005).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 3 | PUC Account Hierarchy & Dynamic Rollup | Roll up auxiliary transactions (8 digits) to Subcuenta (6), Cuenta (4), Grupo (2), Clase (1) | M2 | Survey |
| 4 | Initial Balance & Movement Carry-Over | Carry forward previous period balances and handle year-end closing entries (Classes 4-7 reset to 0) | M2 | Survey |
| 5 | Trial Balance Engine (`getTrialBalance`) | Generate trial balance per period with third-party details matching historical format | M2 | Survey |

## Milestones & Tasks
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2.1 | Engine Upgrade & PUC Rollup | Refactor `getTrialBalance` and calculation utils for initial balance, nature signs, dynamic rollup, third-party support, and fiscal year closure | M1 | DONE |


## Detailed Technical Requirements
1. **Initial Balances (`saldo_inicial`) Carry-Over**:
   - For a given query range `[startDate, endDate]`:
   - Prior transactions before `startDate` contribute to `saldo_inicial`.
   - Real accounts (Classes 1, 2, 3): Balances carry over across all previous years/periods cumulative.
   - Nominal accounts (Classes 4, 5, 6, 7): Prior period transactions within the SAME fiscal year contribute to `saldo_inicial`. Prior year nominal transactions are reset to $0.00$ at fiscal year start (Jan 1), with their net balance (Income - Expenses/Costs) transferred to Equity account `360505` (Utilidad del ejercicio) or `361005` (Pérdida del ejercicio).

2. **Account Nature Sign Calculations**:
   - Class 1 (Activo), Class 5 (Gastos), Class 6 (Costos de Ventas), Class 7 (Costos de Producción) -> Débito Nature:
     * $\text{Saldo Final} = \text{Saldo Inicial} + \text{Mov. Débito} - \text{Mov. Crédito}$
   - Class 2 (Pasivo), Class 3 (Patrimonio), Class 4 (Ingresos) -> Crédito Nature:
     * $\text{Saldo Final} = \text{Saldo Inicial} + \text{Mov. Crédito} - \text{Mov. Débito}$

3. **Dynamic PUC Hierarchy Rollup**:
   - Auxiliary transactions are recorded at 8-digit (or subcuenta 6-digit) account codes.
   - `getTrialBalance` must generate rollup levels dynamically:
     * Level 1: 1-digit (Clase)
     * Level 2: 2-digit (Grupo)
     * Level 3: 4-digit (Cuenta)
     * Level 4: 6-digit (Subcuenta)
     * Level 5: 8-digit (Auxiliar)
   - Parent accounts aggregate debit movements, credit movements, initial balances, and final balances from all child accounts.

4. **Third-Party Breakdown**:
   - Support `includeThirdParty` parameter in `getTrialBalance`.
   - When enabled, detail rows include `third_party_id`, `document_number`, `name` for leaf/auxiliary accounts.
   - Summary/rollup parent account rows sum child third-party balances.

5. **Fiscal Year-End Closing Mechanics**:
   - When moving from year $Y$ to year $Y+1$ (e.g. starting Jan 1, $Y+1$):
   - Nominal accounts (Classes 4-7) for year $Y$ sum to Net Result = Total Ingresos (Class 4) - Total Gastos/Costos (Classes 5-7).
   - If Net Result > 0: Profit credited to account `360505` (Utilidad del ejercicio).
   - If Net Result < 0: Loss debited to account `361005` (Pérdida del ejercicio).
   - Nominal accounts starting Jan 1, $Y+1$ have $0.00$ `saldo_inicial`.

## Code Layout
- `src/actions/reportes.ts`: Entry point for `getTrialBalance` server action.
- `src/lib/utils/trial-balance-calc.ts` (or relevant helper module): Math & dynamic rollup calculation core.
- `src/actions/cierre-anual.ts` / `src/lib/utils/closing-calc.ts`: Closing entry helpers.
- Unit/integration test suites verifying calculation correctness across multi-period scenarios.
