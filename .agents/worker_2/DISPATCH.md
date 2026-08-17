## 2026-08-17T11:45:37Z
You are Lead Systems Architect Worker (worker_2).
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_2

MANDATORY FIRST STEP: You MUST read ORIGINAL_REQUEST.md at:
C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
and read the Adversarial Hardening Blueprint at:
C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\orchestrator_r2\ADVERSARIAL_PATCHES.md
and challenger reports at:
- Challenger 1: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_1\analysis.md
- Challenger 2: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_2\analysis.md
- Current Implementation Plan: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\IMPLEMENTATION_PLAN.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You have exclusive write ownership of `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\IMPLEMENTATION_PLAN.md`.

YOUR MISSION:
Directly apply all 12 adversarial hardening patches from ADVERSARIAL_PATCHES.md into `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\IMPLEMENTATION_PLAN.md`:
1. Patch 1: DIAN Mid-Flight Drop Reconciliation (`GetStatusZip` check before compensation).
2. Patch 2: Outbox Worker Zombie Event Lease Recovery (`status = 'PROCESSING' AND locked_until < NOW()`).
3. Patch 3: Credit Note Concept Matrix (Concept 3 discounts no restock) & Kardex Frozen Historical Cost (`unit_cost`).
4. Patch 4: Colombian Tax Regime Matrix & Dynamic UVT Engine (`tax_configurations` table + RST Estatuto Tributario Art. 911 rules).
5. Patch 5: Offline POS Leased Consecutive Range Chunks & Negative Stock Reconciliation.
6. Patch 6: DDL DIAN Resolution Renewal Constraint (`UNIQUE(organization_id, prefix, resolution_number)`).
7. Patch 7: Timezone Boundary Fix in `get_next_invoice_number_secure` (`America/Bogota`).
8. Patch 8: Decoupled Outbox Polling & DB Connection Pool Protection.
9. Patch 9: Distributed Circuit Breaker (Redis / Shared State) & Error Classification (5xx vs 4xx).
10. Patch 10: Two-Phase `payment_intents` FSM & Automatic Gateway Reversal.
11. Patch 11: Contingencia Tipo 03 Manual Paper Book Ingestion Pipeline (`TC`).
12. Patch 12: Merkle Audit Hash Chain Concurrency Serialization (`pg_advisory_xact_lock`).

Once you have updated `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\IMPLEMENTATION_PLAN.md`, write your summary handoff report to:
`C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\worker_2\handoff.md`
and notify the orchestrator via send_message.
