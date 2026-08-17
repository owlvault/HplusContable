# Task Assignment: challenger_m3_1

**Role**: teamwork_preview_challenger
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_1`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)

## Objectives
1. Read `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`, and Worker handoff `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_1\handoff.md`.
2. Execute empirical verification:
   - Run Vitest suite: `npx vitest run tests/verification/trial-balance-comparator.test.ts`
   - Run CLI script: `npx tsx scripts/verify-trial-balance-backup.ts --year 2024`
   - Verify zero modification or creation of files in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`.
3. Challenge boundary float math ($\le 0.01$ COP tolerance limit: test 0.005 vs 0.010 vs 0.011 COP).
4. Record execution results in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_1\analysis.md` and handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_1\handoff.md`.
5. Clearly state your final verdict: **APPROVE** or **REQUEST_CHANGES**.
6. Send a message referencing your handoff file when finished.
