# Task Assignment: explorer_m3_2

**Role**: teamwork_preview_explorer
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)

## Objectives
1. Read `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`, and M2 handoff `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\handoff.md`.
2. Inspect the current `getTrialBalance` engine in `src/actions/reportes.ts` and calculation logic in `src/lib/utils/trial-balance-calc.ts`.
3. Design the comparison logic algorithm:
   - Matching generated trial balance rows against historical benchmark rows account-by-account & third-party.
   - Handling float numerical tolerance $\le 0.01$ COP for initial balance, debits, credits, and final balance.
   - Structuring comparison result data types (`ComparisonResult`, `Discrepancy`, `MatchStats`).
4. Propose code implementation strategy for `src/lib/verification/trial-balance-comparator.ts`.
5. Write your detailed analysis in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\analysis.md` and handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\handoff.md`.
