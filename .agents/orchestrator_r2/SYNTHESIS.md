# Architecture & UX Refinement Synthesis Blueprint

## Overview
This document synthesizes the evaluations and architectural specifications from the 3 Senior Architecture Explorers (`explorer_ux_1`, `explorer_backend_1`, and `explorer_security_1`) to guide the comprehensive refinement of `IMPLEMENTATION_PLAN.md`.

---

## 1. User Experience & Zero-Accounting Jargon Architecture (Explorer 1)

### 1.1 Universal Zero-Accounting Jargon Taxonomy Matrix
All user-facing views, forms, badges, notifications, and reports must adhere strictly to plain business language. Technical accounting terms are mapped automatically in the background:
- **No "Débito / Crédito"**: Replace with "Dinero que Entra / Salida de Dinero", "Ingresos / Egresos", "Abono / Cargo".
- **No "PUC / Códigos de Cuentas (1105, 4135, etc.)"**: Replace with intuitive business categories ("Caja Principal", "Ventas de Productos", "IVA por Pagar", "Cuentas por Cobrar").
- **No "Asiento Contable / Comprobante de Diario"**: Replace with "Registro Automático de la Operación" or "Detalle de Movimiento".
- **No "Retenciones Contables Complejas"**: Replace with "Retención en la fuente sugerida (calculada automáticamente)".

### 1.2 In-Context Action Cards & Resilient Error UX
Replace passive toast errors with actionable, context-aware cards with 1-click remedies:
1. **DIAN API Timeout Card**:
   - Status: "Factura guardada localmente. La DIAN está tardando en responder."
   - Primary Action: [Continuar Facturando (Se enviará en segundo plano)]
   - Secondary Action: [Reintentar Ahora] | [Emitir en Contingencia Tipo 03]
2. **Customer NIT / Tax Validation Card**:
   - Status: "El NIT del cliente no coincide con el dígito de verificación en el RUT."
   - Actions: [Calcular Dígito Automáticamente] | [Editar Datos del Cliente]
3. **Bank Reconciliation Discrepancy Card**:
   - Status: "Diferencia detectada en extracto bancario ($4.000 COP)."
   - Smart Suggestion: "¿Registrar como Gravamen a los Movimientos Financieros (4x1000) o Comisión Bancaria?"
   - Actions: [Aplicar 4x1000] | [Aplicar Comisión] | [Revisión Manual]
4. **Inventory Count Discrepancy Card**:
   - Status: "Diferencia entre conteo físico y stock del sistema (-2 unidades)."
   - Actions: [Ajustar por Merma / Daño] | [Ajustar por Autoconsumo] | [Recarcular Conteo]

### 1.3 Core Interaction Blueprints
- **Fast POS / Mostrador**: Optimized for sub-second barcode scans, single-keypress shortcuts (F2: Pago Rápido Efectivo, F4: Tarjeta/QR, F8: Factura Electrónica), split payment calculator, and offline draft storage with background sync.
- **Electronic Invoicing Lifecycle**: Real-time status pills ("Borrador", "En cola DIAN", "Aprobada con CUFE", "Contingencia"), PDF preview with QR code, automatic WhatsApp/Email delivery.
- **Dual-Pane Bank Reconciliation**: Left pane (Bank Statement lines), Right pane (System Invoices/Expenses), auto-match confidence scoring (>95% green, 70-95% yellow, <70% gray).

---

## 2. Backend Architecture, Transaction Boundaries & Data Integrity (Explorer 2)

### 2.1 Two-Phase Transaction Architecture (Saga / Outbox Pattern)
To ensure high throughput and prevent blocking client requests on DIAN network latency:
- **Phase 1 (Local ACID Commit, <50ms)**:
  1. Acquire lock on `dian_resolutions` (`SELECT current_number FROM dian_resolutions WHERE id = $1 FOR UPDATE`).
  2. Increment and assign sequential invoice number (`prefix` + `consecutive`).
  3. Deduct stock atomically with product-ordered locks (`SELECT stock FROM inventory_items WHERE id IN (...) ORDER BY id FOR UPDATE`).
  4. Insert `invoices` and `invoice_items` records.
  5. Insert double-entry `ledger_entries` (automated balanced debits/credits to internal accounts).
  6. Insert `accounts_receivable` or `payments` record.
  7. Insert payload into `outbox_events` table (`event_type: 'invoice.dian_emission_requested'`).
  8. Commit transaction.
- **Phase 2 (Asynchronous Worker Pipeline)**:
  1. Outbox poller reads unhandled events using `SELECT * FROM outbox_events WHERE status = 'pending' ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`.
  2. Worker builds UBL 2.1 XML, signs with digital certificate, computes CUFE and QR string.
  3. Transmits XML to DIAN SOAP/REST endpoint with timeout (10s).
  4. On DIAN HTTP 200 / ApplicationResponse "Aceptado": Updates invoice status to `'validada'`, records CUFE and trackId, marks outbox event `'completed'`.
  5. On DIAN network timeout / 5xx: Outbox worker increments retry count with exponential backoff + jitter (max 5 retries). If circuit breaker opens, triggers Contingencia Tipo 03.
  6. On DIAN hard validation error (Schema / Rule rejection): Invoice status updated to `'rechazada_dian'`, compensation workflow triggered.

### 2.2 Compensation Transactions & Invalidation Workflows
- **Pre-Validation Rejection Compensation**: If DIAN rejects an invoice permanently before legal validity, the system executes an automated compensation transaction:
  - Generates compensating ledger entries (reversing debit/credits with reference `compensating_entry_for`).
  - Restocks deducted inventory items.
  - Marks invoice as `'anulada_por_rechazo'`.
- **Post-Validation Cancellation (Nota Crédito Electrónica)**:
  - According to DIAN regulations, validated electronic invoices CANNOT be deleted or edited.
  - The system generates an electronic Credit Note (Nota Crédito tipo 01/02), generates CUDE, transmits to DIAN, and posts reversal ledger entries upon DIAN validation.

### 2.3 Concurrency & Idempotency
- **Idempotency**: Enterprise middleware with `idempotency_keys` table (`key`, `tenant_id`, `request_hash`, `response_body`, `status`, `expires_at`). Prevents duplicate billing on network retries.
- **Concurrent Ledger Scalability**: Append-only `ledger_entries` table. Real-time balance queries optimized via `account_monthly_balances` aggregate rollup table updated via triggers or async worker.
- **Dead-Letter Queue (`dead_letter_events`)**: Unresolvable events moved to DLQ with full payload, stack trace, and admin replay API endpoint.

---

## 3. Security, Multi-Tenant Isolation & DIAN Resilience (Explorer 3)

### 3.1 Multi-Tenant Data Isolation & Row-Level Security (RLS)
- Root tenant tables: `organizations` (tenant metadata, NIT, regime) and `organization_members` (user-to-organization mapping with roles).
- Every business table (`invoices`, `invoice_items`, `ledger_entries`, `accounts`, `inventory_items`, `customers`, `bank_accounts`, `outbox_events`) MUST contain `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
- Enable and enforce RLS on all tables: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY; ALTER TABLE table_name FORCE ROW LEVEL SECURITY;`.
- RLS Policy helper functions in PostgreSQL:
  ```sql
  CREATE OR REPLACE FUNCTION current_user_tenant_id() RETURNS UUID AS $$
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  $$ LANGUAGE sql STABLE SECURITY DEFINER;
  ```
- Strict CRUD RLS policies using `tenant_id = current_user_tenant_id()`.

### 3.2 Role-Based Access Control (RBAC) Matrix
- **Owner**: Full access, financial settings, certificate management, user management.
- **Admin**: Operational management, catalog, invoicing, reports, cannot delete tenant or alter cryptographic keys.
- **Accountant (Contador)**: Read-all financial data, export reports, edit manual adjustments/closings, manage tax configurations.
- **Cashier (Cajero / Vendedor)**: POS sales, invoice creation, view products & prices, no access to financial ledger, profit margins, or configuration.

### 3.3 Cryptographic Key Management & Certificate Security
- DIAN PKCS#12 (.p12) digital certificate and private key passphrase MUST NEVER be stored in plaintext.
- Envelope encryption: Certificate binary stored in Supabase Vault or AWS KMS / secure encrypted storage with tenant-specific Data Encryption Key (DEK). Passphrase encrypted with master key.
- Transient in-memory decryption only during XML signature creation.

### 3.4 Immutable Audit Logging (Merkle-style Hash Chain)
- Table `audit_logs` (`id`, `organization_id`, `user_id`, `action`, `resource_type`, `resource_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `prev_hash`, `current_hash`, `created_at`).
- PostgreSQL Trigger blocking all `UPDATE` and `DELETE` operations on `audit_logs` (`RAISE EXCEPTION 'Audit log entries are immutable'`).
- `current_hash` computed as `SHA256(prev_hash || organization_id || action || resource_id || created_at)`.

### 3.5 DIAN Resilience, Circuit Breaker & Contingency Modes
- State Machine: `BORRADOR` -> `EN_COLA_DIAN` -> `ENVIANDO` -> (`VALIDADA_CUFE` | `CONTINGENCIA_TIPO_03` | `RECHAZADA_DIAN`).
- Circuit Breaker: If DIAN failure rate exceeds 50% over a 2-minute rolling window (or 3 consecutive timeouts), circuit opens -> system immediately switches to `CONTINGENCIA_TIPO_03` (Factura Electrónica de Contingencia del Emisor) -> enables uninterrupted sales at the store -> automatic background transmission upon DIAN recovery within legal 48-hour window.

---

## Direct Action Plan for Worker:
Apply all the synthesized architectural specifications directly into `IMPLEMENTATION_PLAN.md`, enriching existing sections and adding dedicated subsections for:
1. Complete Multi-Tenant DDLs with `organization_id` & RLS policies.
2. Two-Phase Transaction & Outbox Architecture with explicit DDLs (`outbox_events`, `dead_letter_events`, `idempotency_keys`).
3. Zero-Accounting Jargon UX Taxonomy Matrix & In-Context Action Cards.
4. Cryptographic Key Management & Immutable Audit Log DDL with hash-chain triggers.
5. Concurrency control patterns (pessimistic numbering locks, product stock ordering, monthly balance rollups).
6. Compensation workflows (reversing entries for pre-validation rejection, credit notes for post-validation).
7. DIAN Circuit Breaker & Contingency Mode (Tipo 03 / Tipo 04) specifications.
