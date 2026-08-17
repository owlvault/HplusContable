# Handoff Report - Senior Security & Integration Architect

**Agent**: `explorer_security_1`  
**Date**: 2026-08-17  
**Type**: Hard Handoff (Task Complete)  
**Detailed Report**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_security_1\analysis.md`

---

## 1. Observation

Direct observations from examining the repository and plan files:
1. **Multi-Tenant Schema Omission**: In `IMPLEMENTATION_PLAN.md` (lines 203-239, 324-335, 422-452, 454-469, 603-618), none of the proposed tables (`invoices`, `invoice_lines`, `bank_accounts`, `employees`, `payroll_periods`, `receivables`) contain an `organization_id` column.
2. **Permissive RLS in Existing SQL**: In `sql/nomina_dian_tables_v2.sql` (lines 111-124, 213-223), all policies use `USING (true)` and `WITH CHECK (true)` for `authenticated` users without tenant verification:
   ```sql
   CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
   CREATE POLICY "dian_config_select" ON dian_config FOR SELECT TO authenticated USING (true);
   ```
3. **Plaintext Secrets in Database**: In `sql/nomina_dian_tables_v2.sql` (lines 151-152, 167), sensitive secrets are stored as unencrypted text: `certificate_password TEXT`, `technical_key VARCHAR(255)`, `software_pin VARCHAR(100)`.
4. **Non-Enforced, Mutable Audit Log**: In `src/actions/audit.ts` (lines 50-75), audit logging is a client/action-triggered insert. There are no PostgreSQL trigger-based guarantees, and table permissions do not prohibit `UPDATE` or `DELETE` on `audit_log`.
5. **Synchronous DIAN Block Risk**: In `src/actions/dian.ts` (lines 252-264), electronic invoicing is structured as a single blocking call without asynchronous background queues, circuit breakers, or DIAN contingency handling (Resolución 000042 / 000165 Tipo 03 vs Tipo 04).

---

## 2. Logic Chain

1. **Multi-Tenant Risk**: Without `organization_id` on all business tables and with `USING (true)` RLS policies, any authenticated user from Company A can query or modify accounting entries, salaries, and bank accounts of Company B.
   - *Recommendation*: Introduce `organizations` and `organization_members` tables, enforce `organization_id UUID NOT NULL REFERENCES organizations(id)` on every entity, and use `FORCE ROW LEVEL SECURITY` with `auth.get_user_organizations()`.
2. **Secret Compromise Risk**: Storing PKCS#12 certificate passphrases and DIAN technical keys in plaintext allows any user with database read access to extract the company's digital certificate and forge electronic documents.
   - *Recommendation*: Use Envelope Encryption with Supabase Vault / KMS (`vault.secrets`), store binary `.p12` blobs in KMS-encrypted private buckets, and isolate signing execution to a dedicated `dian-signer` worker.
3. **Audit Non-Repudiation Risk**: Application-level manual audit logging can be bypassed, and rows can be deleted or altered directly in PostgreSQL.
   - *Recommendation*: Implement database triggers for `INSERT/UPDATE/DELETE` on all ledger and invoice tables, revoke `UPDATE/DELETE/TRUNCATE` permissions, and use Merkle-style SHA-256 cryptographic hash chains (`prev_hash`).
4. **DIAN Outage and Timeout Risk**: Synchronously connecting to the DIAN API during user actions exposes the application to 504 Gateway Timeouts, browser freezes, and thundering herd failures during DIAN downtimes.
   - *Recommendation*: Implement a Two-Phase emission architecture: Phase 1 commits accounting and invoice locally in <50ms with status `ISSUED_PENDING_DIAN`; Phase 2 transmits asynchronously via background worker with Circuit Breaker and automated failover to Contingency Tipo 04.

---

## 3. Caveats

- **External Hardware Security Modules (HSM)**: For high-volume enterprise electronic invoicing (> 100k invoices/month), an external cloud HSM (AWS CloudHSM / Azure Dedicated HSM) may be preferred over software-based PKCS#12 custody in Supabase Vault.
- **Provider vs Direct Integration**: If the business elects to integrate via an authorized technological provider (PT - Proveedor Tecnológico e.g., Facturatech, The Factory HKA, Siigo API) instead of Direct Software, the XML signing is delegated to the PT, but the 2-phase async state machine, circuit breaker, and RLS requirements remain 100% applicable.

---

## 4. Conclusion

`IMPLEMENTATION_PLAN.md` must be updated with four fundamental architectural enhancements:
1. **Multi-Tenant Isolation Foundation**: Add `organizations`, `organization_members`, `organization_id` foreign keys to all DDLs, and hardened RLS policies.
2. **KMS & Supabase Vault Certificate Custody**: Secure PKCS#12 handling and field-level encryption for financial accounts and DIAN technical keys.
3. **Trigger-Based Immutable Cryptographic Audit Log**: Tamper-proof append-only ledger with hash chaining.
4. **Two-Phase Asynchronous DIAN Integration**: Background queue, Circuit Breaker, and legal contingency handling (Tipo 03 / Tipo 04).

The detailed SQL DDL scripts, Python Circuit Breaker implementation, and insertion mapping are provided in `analysis.md`.

---

## 5. Verification Method

1. **RLS Multi-Tenant Verification**:
   - Inspect PostgreSQL policies using:
     ```sql
     SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
     FROM pg_policies 
     WHERE schemaname = 'public';
     ```
   - Execute test query across two distinct tenant users in Supabase to assert that `SELECT * FROM invoices` returns zero records belonging to another `organization_id`.
2. **Audit Immutability Verification**:
   - Perform an `UPDATE` or `DELETE` on `audit_logs` as an authenticated user to verify PostgreSQL throws `permission denied for table audit_logs`.
   - Perform an `INSERT` on `invoices` and verify `audit_logs` receives a new row with valid `prev_hash` and `hash` fields.
3. **DIAN Circuit Breaker & Contingency Test**:
   - Run unit test mocking DIAN API returning HTTP 504.
   - Verify state transitions from `ISSUED_PENDING_DIAN` to `CONTINGENCY_DIAN_04` after threshold failures, with no user-facing timeout error.
