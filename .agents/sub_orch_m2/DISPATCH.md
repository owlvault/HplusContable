# Sub-Orchestrator M2 Dispatch Instructions

## 2026-08-03T14:21:31-05:00

You are Sub-Orchestrator for Milestone 2 (Movement Processing & Closure Engine).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2
Your parent is: f1c18431-b293-46a2-96a3-756bc622c133

MANDATORY INSTRUCTIONS:
1. Read C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md, C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md, and M1 handoff in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\handoff.md. Also read survey reports in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_3\handoff.md.
2. Create SCOPE.md in your working directory C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\SCOPE.md defining your scope:
   - Upgrade `getTrialBalance` engine (`src/actions/reportes.ts` / calculation utils):
     * Carry over initial balances (`saldo_inicial`) from previous period.
     * Dynamic PUC hierarchy rollup (8-digit -> 6-digit -> 4-digit -> 2-digit -> 1-digit).
     * Account nature sign calculations (Debit: Cl 1,5,6,7; Credit: Cl 2,3,4).
     * Third-party breakdown matching "Balance de prueba por tercero" format.
     * Fiscal year-end annual closure mechanics (reset nominal accounts 4-7 to 0 on Jan 1, carry profit/loss into equity account 360505/361005).
3. Manage execution by dispatching workers (teamwork_preview_worker), reviewers (teamwork_preview_reviewer), challengers (teamwork_preview_challenger), and forensic auditor (teamwork_preview_auditor). Include mandatory integrity warnings to workers.
4. Record iteration gate status in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\GATE_STATUS.md. Do not pass gate unless all reviewers approve, challengers verify, build/tests pass, and auditor verdict is CLEAN.
5. When complete, write handoff.md in your working directory and notify the parent orchestrator via send_message.

## 2026-08-03T16:48:51-05:00

You are Sub-Orchestrator for Milestone 2 (Movement Processing & Closure Engine - Gen2).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2
Your parent is: f1c18431-b293-46a2-96a3-756bc622c133

MANDATORY INSTRUCTIONS:
1. Read SCOPE.md and GATE_STATUS.md in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\.
2. In Iteration 1, challenger_m2_2 reported a comparator bug in `src/lib/utils/trial-balance-calc.ts` line 562:
   - Existing line: `if (a.third_party_id && !a.third_party_id) return 1;`
   - Required fix: `if (a.third_party_id && !b.third_party_id) return 1;`
3. Dispatch a worker (teamwork_preview_worker) to remediate line 562 in `src/lib/utils/trial-balance-calc.ts`, run builds (`npm run build`), and run unit tests (`npx vitest run src/lib/utils/trial-balance-calc.test.ts`). Include mandatory integrity warnings to workers.
4. Dispatch 2 reviewers (teamwork_preview_reviewer), 2 challengers (teamwork_preview_challenger), and forensic auditor (teamwork_preview_auditor).
5. Update GATE_STATUS.md for Iteration 2. When all reviewers approve, challengers verify, build/tests pass, and auditor verdict is CLEAN, mark GATE PASS.
6. Write handoff.md in your working directory and notify the parent orchestrator via send_message.
