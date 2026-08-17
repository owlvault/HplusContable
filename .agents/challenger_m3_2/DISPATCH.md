# Task Assignment: challenger_m3_2

**Role**: teamwork_preview_challenger
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)

## Objectives
1. Read `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`, and Worker handoff `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_1\handoff.md`.
2. Conduct adversarial edge-case stress testing on `src/lib/verification/trial-balance-comparator.ts`:
   - Empty/missing third party document numbers.
   - Non-standard account code lengths.
   - Zero-balance unmatched account filtering (`ignoreZeroBalanceUnmatched`).
   - Read-only infrastructure protection under simulated file access errors.
3. Record execution results in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2\analysis.md` and handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2\handoff.md`.
4. Clearly state your final verdict: **APPROVE** or **REQUEST_CHANGES**.
5. Send a message referencing your handoff file when finished.
