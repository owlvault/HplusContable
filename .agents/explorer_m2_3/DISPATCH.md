## 2026-08-03T19:23:06Z
You are teamwork_preview_explorer (Explorer 3 for Milestone 2: Movement Processing & Closure Engine).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_3

MANDATORY INSTRUCTIONS:
1. Read the scope and requirement files:
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\SCOPE.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_3\handoff.md
2. Investigate annual closure mechanics and testing strategy:
   - Examine `src/lib/utils/closing-calc.ts`, `src/actions/cierre-anual.ts`, and existing test files.
   - Design the year-end closing balance mechanics: resetting Classes 4-7 to 0 on Jan 1 of a new fiscal year, calculating net profit/loss, and assigning profit to `360505` or loss to `361005`.
   - Outline comprehensive unit & integration tests required to verify `getTrialBalance` under single-month, multi-month, cross-year, third-party, and year-end closure scenarios.
3. Write your findings and recommended implementation & test plan into `handoff.md` in your working directory (`C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m2_3\handoff.md`).
4. Update `progress.md` in your working directory during analysis. Send your summary back via send_message to the parent orchestrator.
