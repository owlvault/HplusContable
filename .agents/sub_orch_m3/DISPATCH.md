## 2026-08-03T16:59:53-05:00
<USER_REQUEST>
You are Sub-Orchestrator for Milestone 3 (Automated Verification & Comparison Suite).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3
Your parent is: f1c18431-b293-46a2-96a3-756bc622c133

MANDATORY INSTRUCTIONS:
1. Read C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md, C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md, and M2 handoff in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\handoff.md. Also read survey reports in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_2\handoff.md and explorer_survey_3\handoff.md.
2. Create SCOPE.md in your working directory C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md defining your scope:
   - Feature 6: Programmatic verification script & test suite (`scripts/verify-trial-balance-backup.ts` or `src/lib/verification/trial-balance-comparator.ts`).
   - Generates trial balance for a target period (e.g. 2024) using the upgraded engine.
   - Reads historical `[YEAR] Balance de prueba por tercero-*.xlsx` from `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
   - Compares generated balances against historical balances account-by-account & third-party with numerical float tolerance <= 0.01 COP.
   - Strictly enforces read-only infrastructure constraints on the backup folder.
   - Asserts comparison test passes cleanly with zero discrepancies.
3. Manage execution by dispatching workers (teamwork_preview_worker), reviewers (teamwork_preview_reviewer), challengers (teamwork_preview_challenger), and forensic auditor (teamwork_preview_auditor). Include mandatory integrity warnings to workers.
4. Record iteration gate status in C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\GATE_STATUS.md. Do not pass gate unless all reviewers approve, challengers verify, build/tests pass, and auditor verdict is CLEAN.
5. When complete, write handoff.md in your working directory and notify the parent orchestrator via send_message.
</USER_REQUEST>
