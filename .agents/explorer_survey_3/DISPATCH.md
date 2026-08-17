## 2026-08-03T18:52:42Z
You are teamwork_preview_explorer (Accounting & Verification Explorer).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_3

MANDATORY INSTRUCTIONS:
1. Read the user request at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md before starting.
2. Analyze accounting movement logic and verification rules required for CFO-AI:
   - Rules for processing ledger transactions (débitos, créditos, comprobantes) into period balances (saldo inicial, movimiento débito, movimiento crédito, saldo final).
   - PUC (Plan Único de Cuentas) account rollups and hierarchy logic (1-digit Clase, 2-digit Grupo, 4-digit Cuenta, 6-digit Subcuenta, 8-digit Auxiliar).
   - How historical trial balance reports in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` present initial balances vs movements vs final balances.
   - Precise logic needed for automated comparison test script (matching account numbers, handling rounding/floats, missing accounts, multi-period closures).
3. Write your detailed findings to C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_3\analysis.md.
4. Write your handoff report to C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_3\handoff.md following the Handoff Protocol.
5. Send a message to the orchestrator (parent) via send_message with a brief summary and the path to your handoff report.
