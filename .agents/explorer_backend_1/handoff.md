# Handoff Report — explorer_backend_1 (Senior Backend & Database Architect)

**Target Document**: `IMPLEMENTATION_PLAN.md`  
**Date**: 2026-08-17  
**Status**: Task Complete (Hard Handoff)  
**Detailed Report**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_backend_1\analysis.md`

---

## 1. Observation

Direct code and architectural observations in the current repository and `IMPLEMENTATION_PLAN.md`:

1. **Transaction Boundary Fragmentation in Current Code**:
   - In `src/actions/invoices.ts` (lines 397–462), `approveInvoice` performs fragmented database operations across multiple asynchronous queries without a unified transaction:
     - `createJournalEntryForInvoice` inserts into `journal_entries` and `journal_lines` (lines 417, 471, 638).
     - `createReceivableForInvoice` inserts into `receivables` (lines 421, 650).
     - `invoices.update` sets `state = 'APPROVED'` (line 429).
     If any step or network call fails halfway, orphaned records and severe ledger desynchronization occur.
2. **Synchronous DIAN Blocking Risk**:
   - `IMPLEMENTATION_PLAN.md` proposes FastAPI microservices communicating over Redis/RabbitMQ but lacks a **Transactional Outbox** table or formal Saga orchestrator. External HTTP calls to DIAN Web Services risk blocking database transactions or dropping events during network partitions (Dual-Write failure).
3. **Illegal Voiding/Anulación Mechanism**:
   - In `src/actions/invoices.ts` (lines 695–741) and `IMPLEMENTATION_PLAN.md` (line 267), invoice cancellation is executed simply by updating `state = 'CANCELLED'`. For documents approved by DIAN (`dian_status = 'APPROVED' / 'ACCEPTED'`), this violates Colombian tax law (Decreto 358 / Resolución 000042/000165), which mandates **Notas Crédito Electrónicas** with CUDE.
4. **Concurrency Race Conditions**:
   - Consecutive allocation in `src/actions/invoices.ts` (lines 65–144) uses an optimistic fallback query on `document_sequences` that fails under high burst concurrency.
   - Missing inventory models (`inventory_items`, `inventory_levels`, `inventory_movements`) in `IMPLEMENTATION_PLAN.md` to guarantee atomic stock deductions and prevent overselling.
5. **Absence of Enterprise Idempotency**:
   - No `idempotency_keys` table or request-hash deduplication exists to prevent duplicate invoice generation or double credit card / bank charges on network retries.

---

## 2. Logic Chain

1. **From Observation 1 & 2**: A financial ERP cannot rely on multi-call asynchronous JS or uncoordinated microservice HTTP requests for core financial entries.
   - **Reasoning**: A sale creation involves stock deduction, double-entry ledger posting, and receivable registration. These MUST be bound to a single local ACID transaction in PostgreSQL.
   - **Bridge to Async**: Communication with external third parties (DIAN, SMTP, Banks) must be decoupled via the **Transactional Outbox Pattern** in PostgreSQL (`outbox_events` table populated inside the ACID transaction) and processed by resilient background workers.
2. **From Observation 3**: Under Colombian fiscal regulations, emitted electronic invoices are immutable once accepted by DIAN.
   - **Reasoning**: Cancellation requires issuing a formal **Nota Crédito Electrónica** (Credit Note) referencing the invoice's CUFE, computing a CUDE, and posting a balanced reversing entry (Contrasiento) in the accounting ledger (Debit 4175 / Credit 1305).
3. **From Observation 4 & 5**: High-throughput environments experience burst traffic and network retries.
   - **Reasoning**: Consecutive number allocation requires pessimistic row-locking (`SELECT ... FOR UPDATE`) with DIAN range limit checks. Inventory deductions require atomic conditional SQL updates (`WHERE available >= requested`). Client mutation endpoints require `idempotency_keys` with SHA-256 payload hashing to ensure exactly-once semantics.

---

## 3. Caveats

- **External Technological Provider**: The plan assumes DigiKawsay may either connect directly to DIAN Web Services or via an authorized Technological Provider (PT). The proposed Outbox / Saga architecture supports both seamlessly without altering the core accounting transaction boundaries.
- **Multi-Warehouse Stock**: The proposed DDL provides single/multi-warehouse foundations (`warehouse_id`), but multi-location cross-transfers should be managed in a specialized inventory milestone.
- **No Direct Implementation**: In accordance with the Explorer role constraints, this evaluation provides specifications, DDL schemas, and text modification proposals without modifying production application code.

---

## 4. Conclusion

`IMPLEMENTATION_PLAN.md` must be enhanced with:
1. **Strict 2-Phase Transaction Architecture**: Phase 1 (Local ACID Transaction: Lock Sequence + Atomic Stock Deduction + Double-Entry Ledger + Receivable + Outbox Registration); Phase 2 (Async Saga Worker: XML-UBL 2.1 Signing, CUFE calculation, DIAN dispatch, Contingency handling).
2. **Complete Compensation Transactions**: Automatic reversing entries (Contrasientos) for DIAN rejections, and legal **Nota Crédito Electrónica** workflows for accepted invoice voiding.
3. **Concurrency & Idempotency Primitives**: PostgreSQL `document_sequences` row-level locking, `account_monthly_balances` snapshots with advisory locks, deterministic product locking to prevent deadlocks, and `idempotency_keys` middleware.
4. **Outbox & Dead-Letter Queue (DLQ) Schema**: DDL for `outbox_events`, `dead_letter_events`, `inventory_items`, `inventory_levels`, `credit_notes`, and admin redrive endpoints.

---

## 5. Verification Method

To independently verify the proposed architecture:
1. **Schema & DDL Inspection**: Inspect the complete SQL DDL definitions in `analysis.md` (Sections 4.1–4.3) and ensure all constraints (`CHECK`, `UNIQUE`, `FOREIGN KEY`, `ON CONFLICT`) maintain relational integrity.
2. **Transaction Sequence Validation**: Trace the sequence diagram in `analysis.md` (Section 1.1) to confirm that no external HTTP or long-running I/O operations are enclosed within the ACID database boundary.
3. **Double-Entry & Fiscal Compliance Spot-Check**: Verify the accounting line postings for Sales (1305 / 1355 / 4135 / 2408), Cost of Sales (6135 / 1435), Reversals, and Credit Notes against Colombian PUC Decreto 2650 and DIAN Resolución 000042.
4. **Vitest / Unit Test Alignment**: Run the existing test suite (`npm test` / `npx vitest run`) to confirm that all existing local test suites remain green.
