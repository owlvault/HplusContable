## 2026-08-03T19:26:19Z
You are teamwork_preview_worker (Worker 1 for Milestone 2: Movement Processing & Closure Engine).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m2_1

MANDATORY INSTRUCTIONS:
1. Read the specification, scope, and explorer handoff reports:
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\SCOPE.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_1\handoff.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_2\handoff.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_3\handoff.md

2. MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

3. Implementation Tasks:
   a. Create pure calculation module `src/lib/utils/trial-balance-calc.ts` implementing:
      - `calculateTrialBalance(lines: RawJournalLineData[], options: TrialBalanceOptions)`:
        * Dual-bucket temporal query math: Prior Movements (`date < startDate`) vs Period Movements (`startDate <= date <= endDate`).
        * `saldo_inicial` calculation:
          - Real accounts (Classes 1, 2, 3): Cumulative prior movements across all previous years up to `startDate`.
          - Nominal accounts (Classes 4, 5, 6, 7): Prior movements ONLY within the current fiscal year (`Jan 1` of `startDate.getFullYear()` up to `startDate`). Nominal accounts reset `saldo_inicial` to $0.00$ on Jan 1.
          - Carry forward prior fiscal years' net profit/loss (Income 4 - Expenses/Costs 5-7) into Equity account `360505` (Utilidad) if >= 0 or `361005` (Pérdida) if < 0.
        * Account nature sign formulas:
          - Débito Nature (Classes 1, 5, 6, 7): `Saldo Final = Saldo Inicial + Débito - Crédito`
          - Crédito Nature (Classes 2, 3, 4): `Saldo Final = Saldo Inicial + Crédito - Débito`
        * Dynamic PUC hierarchy rollup across 5 levels: Level 5 (8-digit Auxiliar) -> Level 4 (6-digit Subcuenta) -> Level 3 (4-digit Cuenta) -> Level 2 (2-digit Grupo) -> Level 1 (1-digit Clase). Automatically synthesize missing parent rows if needed.
        * Third-party breakdown toggle (`includeThirdParty: true` vs `false`), grouping leaf rows by `(account_code, third_party_id)` with fallback third-party `document_number: '0'`, `third_party_name: 'CUANTIAS MENORES / GENERAL'`.
        * `excludeClosingEntries` toggle (default `true`) filtering out `CIERRE` entries from monthly movements when true.
        * Report total summary object with `saldo_inicial_debito`, `saldo_inicial_credito`, `total_debito`, `total_credito`, `saldo_final_debito`, `saldo_final_credito`, and `is_balanced` (Delta <= 0.01 COP).
   b. Upgrade `getTrialBalance` in `src/actions/reportes.ts` to query `journal_lines`, `journal_entries`, `puc_accounts`, `third_parties` from Supabase and use `calculateTrialBalance`.
   c. Create comprehensive unit tests in `src/lib/utils/trial-balance-calc.test.ts` and server action integration tests in `src/actions/reportes.test.ts`.
   d. Run build/type check (`npx tsc --noEmit`) and run Vitest (`npx vitest run src/lib/utils/trial-balance-calc.test.ts src/actions/reportes.test.ts tests/e2e/tier3-multi-period-closures.test.ts`). Ensure 100% pass.

4. Write your implementation handoff to `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m2_1\handoff.md`. Send your summary back via send_message to the parent orchestrator.
