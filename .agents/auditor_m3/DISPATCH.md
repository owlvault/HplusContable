# Task Assignment: auditor_m3

**Role**: teamwork_preview_auditor
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\auditor_m3`
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)

## Objectives
1. Read `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md`, `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md`, and Worker handoff `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_m3_1\handoff.md`.
2. Perform forensic integrity audit of the work product:
   - `src/lib/verification/trial-balance-comparator.ts`
   - `scripts/verify-trial-balance-backup.ts`
   - `tests/verification/trial-balance-comparator.test.ts`
3. Audit Checks:
   - Confirm logic performs genuine calculation and parsing (no hardcoded outputs, fake mocks, or facade stubs).
   - Confirm read-only infrastructure safety checks are strictly enforced.
   - Confirm float tolerance ($\le 0.01$ COP) is genuinely evaluated.
4. Record your audit report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\auditor_m3\analysis.md` and handoff report in `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\auditor_m3\handoff.md`.
5. Clearly state your final audit verdict: **CLEAN** or **INTEGRITY VIOLATION**.
6. Send a message referencing your handoff file when finished.
