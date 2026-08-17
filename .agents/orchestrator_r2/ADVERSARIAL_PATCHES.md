# Adversarial Hardening Blueprint — Iteration 2

This blueprint consolidates the 12 critical distributed systems, Colombian tax compliance, and concurrency patches required by `challenger_1` and `challenger_2` to achieve bulletproof production readiness for `IMPLEMENTATION_PLAN.md`:

---

### Patch 1: Mid-Flight DIAN Connection Drops & Reconciliation Protocol
- **Problem**: When a network drop occurs after XML transmission, re-sending can return error 99 (duplicate invoice), while blind compensating reversals void legal invoices.
- **Solution**: Mandatory `GetStatus` (DIAN SOAP `GetStatusZip`) query before taking any compensation or retry action. If DIAN reports the document as already received and accepted, the worker transitions the invoice directly to `VALIDADA_CUFE` and attaches the received CUFE without re-sending XML.

### Patch 2: Outbox Worker Zombie Event Lease Recovery
- **Problem**: Partial index on `outbox_events` (`WHERE status IN ('PENDING', 'FAILED')`) permanently starves events when a worker crashes mid-flight after setting `status = 'PROCESSING'`.
- **Solution**: Include `(status = 'PROCESSING' AND locked_until < NOW())` in the polling query and index:
  ```sql
  CREATE INDEX idx_outbox_events_poll ON outbox_events(created_at)
  WHERE status IN ('PENDING', 'FAILED') OR (status = 'PROCESSING' AND locked_until < NOW());
  ```

### Patch 3: Credit Note Concept Matrix & Kardex Historical Cost Freezing
- **Problem**: Blanket restocking on credit notes corrupts inventory when issuing commercial rebates (Concept 3), and using dynamic weighted average cost corrupts double-entry trial balance.
- **Solution**:
  - Credit Note Concept 1 (Anulación de Factura) & Concept 2 (Devolución Parcial) -> execute physical restock.
  - Credit Note Concept 3 (Rebaja / Descuento Comercial) -> NEVER restock inventory; purely financial credit entry.
  - All reversing entries MUST use the frozen historical `unit_cost` saved in `invoice_items` at emission time.

### Patch 4: Colombian Tax Regime Matrix & Dynamic UVT Engine
- **Problem**: Hardcoding tax thresholds breaks annually, and Estatuto Tributario Art. 911 prohibits Retefuente / ReteICA deductions on Régimen Simple de Tributación (RST) suppliers.
- **Solution**: Add `tax_configurations` table with annual UVT values (`uvt_value_cop`, `year`) and automated regime compatibility matrix (RST vs Ordinario vs Gran Contribuyente vs Autorretenedor).

### Patch 5: Offline POS Leased Range Chunks & Negative Stock Reconciliation
- **Problem**: Offline POS registers generating consecutive numbers cause `UNIQUE(prefix, number)` collisions upon reconnection, and physical offline sales may cause temporary negative stock.
- **Solution**:
  - Register Range Leasing: Server pre-allocates blocks (e.g., POS-1 gets 1001-1100, POS-2 gets 1101-1200).
  - Offline Reconciliation: Allow temporary negative stock with non-blocking warning, triggering a Guided Physical Stock Count Action Card.

### Patch 6: DIAN Resolution Renewal Constraint Fix
- **Problem**: `UNIQUE(organization_id, prefix)` prevents renewing resolutions for the same prefix (`FE`).
- **Solution**: Change unique constraint in `dian_resolutions` table to:
  ```sql
  CONSTRAINT uq_dian_resolutions_prefix_number UNIQUE (organization_id, prefix, resolution_number)
  ```

### Patch 7: Timezone Boundary Fix in Consecutive Allocation
- **Problem**: `valid_until >= CURRENT_DATE` uses UTC, invalidating resolutions at 7:00 PM Colombia time.
- **Solution**: Enforce Colombian timezone in PL/pgSQL function:
  ```sql
  valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE
  ```

### Patch 8: Decoupled Outbox Polling & DB Connection Pool Protection
- **Problem**: Holding database row locks during external DIAN SOAP calls (10s–45s) exhausts connection pools.
- **Solution**: Two-phase worker cycle:
  1. Transaction 1: Acquire lease (`status = 'PROCESSING'`, `locked_until = NOW() + INTERVAL '60s'`), commit & release DB connection.
  2. External Call: Perform UBL generation, signing, and DIAN SOAP request outside DB transaction.
  3. Transaction 2: Open fresh connection to record result (`VALIDADA` / `RECHAZADA` / retry schedule).

### Patch 9: Distributed Circuit Breaker (Redis / Shared State) & Error Classification
- **Problem**: In-memory circuit breakers do not share state across multi-pod replicas, and client 4xx validation errors falsely trip the circuit.
- **Solution**:
  - Store failure metrics in Redis / centralized cache with sliding window.
  - Classify errors: Only HTTP 5xx, timeouts (504), and TCP connection drops increment circuit failure counter. HTTP 4xx (RUT/schema validation errors) do NOT trip the circuit.

### Patch 10: Two-Phase PaymentIntent FSM & Automatic Gateway Reversal
- **Problem**: Network crashes during credit card or QR payments risk double-charging or orphaned transactions.
- **Solution**: Add `payment_intents` table with states (`PENDING`, `AUTHORIZED`, `CAPTURED`, `VOIDED`, `FAILED`). If local DB transaction fails, an automated webhook/compensation immediately triggers a `void` / `refund` to the payment gateway.

### Patch 11: Contingencia Tipo 03 Manual Paper Book Ingestion Pipeline
- **Problem**: Missing batch ingestion for physical paper contingency invoices (`Talonario o Papel - TC`).
- **Solution**: Add dedicated batch transcription endpoint and UBL 2.1 Tipo 03 schema for manual physical book ingestion and bulk DIAN transmission upon recovery within the 48-hour legal window.

### Patch 12: Merkle Audit Hash Chain Concurrency Serialization
- **Problem**: Concurrent inserts under the same tenant read identical uncommitted `prev_hash`, causing hash chain forks.
- **Solution**: Add transactional advisory locking inside the audit log trigger:
  ```sql
  PERFORM pg_advisory_xact_lock(hashtext('audit_lock_' || NEW.organization_id::text));
  ```
