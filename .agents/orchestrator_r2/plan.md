# Plan: Architecture & UX Refinement for Contable Implementation Plan

## Objective
Evaluate and comprehensively refine `IMPLEMENTATION_PLAN.md` across 4 core dimensions:
1. **User Experience (UX)**: Zero-accounting jargon, simplified & bulletproof UX flows, In-Context Action Cards for errors, seamless offline/timeout handling.
2. **Backend Architecture**: Asynchronous queues, idempotency keys, compensation transactions, event-driven ledger posting.
3. **Data Integrity & Consistency**: Explicit transaction boundaries, multi-step saga/rollback (Sale -> Invoice -> DIAN transmission), concurrent ledger updates, immutable audit trail.
4. **Security & Compliance**: Multi-tenant data isolation, Row-Level Security (RLS) policies, role-based authorization, DIAN credential/certificate security, audit logging.

## Execution Topology
1. **Phase 1: Multi-Dimensional Exploration (3 Explorers)**
   - `explorer_ux`: Evaluates UX flows, jargon abstraction, In-Context Action Cards, error states, and offline/optimistic UI.
   - `explorer_backend_integrity`: Evaluates backend transactions, saga patterns, idempotency, concurrent ledger updates, compensation mechanisms.
   - `explorer_security_dian`: Evaluates multi-tenant isolation, RLS, auth, DIAN API timeouts/retry queues, and certificate handling.
2. **Phase 2: Synthesis & Document Refinement (Worker)**
   - Worker applies consolidated recommendations directly into `IMPLEMENTATION_PLAN.md`.
3. **Phase 3: Rigorous Verification Gate**
   - 2 Reviewers (`reviewer_1`, `reviewer_2`) checking architectural completeness, jargon abstraction, and robustness.
   - 2 Challengers (`challenger_1`, `challenger_2`) checking failure scenarios, edge cases, race conditions, DIAN timeout behavior.
   - 1 Forensic Auditor (`auditor_1`) checking integrity, genuine implementation, and absence of shortcuts.
4. **Phase 4: Gate Evaluation & Final Reporting**
   - Evaluate `GATE_STATUS.md` and report to parent.
