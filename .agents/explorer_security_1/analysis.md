# 🛡️ Análisis Exhaustivo de Seguridad, Aislamiento Multi-Tenant y Resiliencia DIAN
## Evaluación y Propuesta de Refinamiento Arquitectural para `IMPLEMENTATION_PLAN.md`

**Autor**: Senior Security & Integration Architect (`explorer_security_1`)  
**Fecha**: 2026-08-17  
**Estado**: Completo / Propuesta Lista para Integración  

---

## Executive Summary

La revisión exhaustiva de `IMPLEMENTATION_PLAN.md` y de los artefactos SQL existentes (`sql/nomina_dian_tables_v2.sql`, `sql/ventas_module.sql`, `src/actions/*`) revela **vulnerabilidades críticas de seguridad, riesgos de aislamiento de datos multi-empresa y vacíos arquitecturales en la integración con la DIAN**:

1. **Falta Total de Aislamiento Multi-Tenant (`organization_id`)**: Las tablas DDL propuestas en `IMPLEMENTATION_PLAN.md` (`invoices`, `bank_accounts`, `employees`, `payroll_periods`, `receivables`) y los scripts actuales no incluyen `organization_id`. Las políticas RLS actuales en el repositorio usan `USING (true)`, permitiendo que cualquier usuario autenticado de una empresa acceda a la información contable, nómina y facturas de otras empresas.
2. **Almacenamiento Inseguro de Secretos y Certificados DIAN**: En los esquemas actuales, las contraseñas de certificados digitales (`certificate_password`), llaves técnicas (`technical_key`) y PINs de software se almacenan en texto plano en tablas accesibles por cualquier usuario autenticado.
3. **Auditoría Mutable y Manual**: El registro de auditoría actual (`src/actions/audit.ts`) depende de llamadas manuales de Server Actions, no es a nivel de base de datos (triggers), y no cuenta con garantías criptográficas de inmutabilidad (hash chaining).
4. **Acoplamiento Síncrono y Fragilidad ante Caídas de la DIAN**: No existe una máquina de estados asíncrona, Circuit Breaker, ni protocolo normativo de contingencias (Tipo 03 - Contingencia Emisor vs Tipo 04 - Contingencia DIAN), lo que provocará timeouts 504 en cascada y bloqueos en la facturación ante la alta latencia del Web Service de la DIAN.

A continuación se presenta el marco técnico completo, las especificaciones DDL, las políticas de RLS, la arquitectura de cifrado y la ingeniería de resiliencia DIAN para su inclusión directa en `IMPLEMENTATION_PLAN.md`.

---

## 1. Multi-Tenant Data Isolation & Row-Level Security (RLS)

### 1.1 Modelo de Identidad y Tenant Context

El ERP DigiKawsay opera en modalidad B2B Multi-Tenant, donde una empresa (`organization`) agrupa usuarios, planes de cuentas (PUC), terceros, facturas, cuentas bancarias y nómina.

```
┌──────────────────┐       1:N       ┌────────────────────────┐       N:1       ┌───────────────┐
│   auth.users     │ ─────────────── │  organization_members  │ ─────────────── │ organizations │
│ (Supabase Auth)  │                 │  - role_id             │                 │ - nit         │
└──────────────────┘                 │  - is_active           │                 │ - name        │
                                     └────────────────────────┘                 └───────────────┘
                                                  │
                                                  │ (Filtra todas las entidades vía RLS)
                                                  ▼
                         ┌─────────────────────────────────────────────────┐
                         │               Tablas de Negocio                 │
                         │ (invoices, journal_entries, bank_accounts, etc) │
                         │           WHERE organization_id = ...           │
                         └─────────────────────────────────────────────────┘
```

#### DDL Base: Organizaciones y Membresías
```sql
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit VARCHAR(20) NOT NULL UNIQUE,
    dv VARCHAR(1) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    plan_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (plan_tier IN ('STANDARD', 'PRO', 'ENTERPRISE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id, is_active);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, is_active);
```

### 1.2 Helper Functions de Seguridad y JWT Claims

Para máxima velocidad en PostgreSQL RLS, se implementan funciones `STABLE SECURITY DEFINER` con `search_path` fijo para evitar ataques de inyección de rutas:

```sql
-- Obtiene todas las organizaciones a las que pertenece el usuario autenticado
CREATE OR REPLACE FUNCTION auth.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND is_active = true;
$$;

-- Valida si el usuario tiene un rol o permiso específico dentro de una organización
CREATE OR REPLACE FUNCTION auth.has_permission(p_org_id UUID, p_module VARCHAR, p_action VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed BOOLEAN;
BEGIN
    SELECT 
        CASE p_action
            WHEN 'read' THEN rp.can_read
            WHEN 'write' THEN rp.can_write
            WHEN 'delete' THEN rp.can_delete
            WHEN 'approve' THEN rp.can_approve
            ELSE false
        END INTO v_allowed
    FROM organization_members om
    JOIN user_roles ur ON ur.id = om.role_id
    JOIN role_permissions rp ON rp.role_id = ur.id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND om.is_active = true
      AND rp.module = p_module;

    RETURN COALESCE(v_allowed, false);
END;
$$;
```

### 1.3 Matriz de Roles (RBAC) y Permisos

| Módulo | Propietario (Owner) | Administrador (Admin) | Contador (Accountant) | Facturador/Cajero (Seller) |
|---|:---:|:---:|:---:|:---:|
| **Facturas Venta/Compra** | CRUD + Aprobar | CRUD + Aprobar | CRUD + Aprobar | Crear/Editar Borradores, Cobro |
| **Asientos Contables / PUC** | CRUD + Aprobar | CRUD + Aprobar | CRUD + Aprobar + Cierre | Solo Lectura / Sin Acceso |
| **Cuentas Bancarias / Tesorería** | CRUD + Conciliar | CRUD + Conciliar | CRUD + Conciliar | Solo Registro de Recibos |
| **Nómina y Salarios** | CRUD + Aprobar | CRUD + Aprobar | CRUD + Liquidar | Sin Acceso |
| **Configuración DIAN / Certificados** | CRUD + Subir Llaves | CRUD + Gestionar | Solo Lectura Resoluciones | Sin Acceso |
| **Auditoría e Inmutabilidad** | Solo Lectura | Solo Lectura | Solo Lectura | Sin Acceso |

### 1.4 Políticas RLS Blindadas con `FORCE ROW LEVEL SECURITY`

Todas las tablas contables, financieras y de facturación deben forzar RLS para evitar que propietarios de tabla o roles puente omitan las políticas:

```sql
-- 1. Facturas
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_invoices_select" ON invoices
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT auth.get_user_organizations()));

CREATE POLICY "tenant_isolation_invoices_insert" ON invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'facturas', 'write')
    );

CREATE POLICY "tenant_isolation_invoices_update" ON invoices
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'facturas', 'write')
    );

CREATE POLICY "tenant_isolation_invoices_delete" ON invoices
    FOR DELETE TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'facturas', 'delete')
        AND state = 'DRAFT' -- Prohibido borrar facturas aprobadas o contabilizadas
    );

-- 2. Asientos Contables (journal_entries & journal_lines)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_journal_select" ON journal_entries
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT auth.get_user_organizations()));

CREATE POLICY "tenant_isolation_journal_insert" ON journal_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'asientos', 'write')
    );

CREATE POLICY "tenant_isolation_journal_update" ON journal_entries
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'asientos', 'write')
        AND state = 'BORRADOR' -- Asientos aprobados son inmutables
    );

-- 3. Cuentas Bancarias (Tesoreria)
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_banks" ON bank_accounts
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT auth.get_user_organizations()))
    WITH CHECK (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'tesoreria', 'write')
    );
```

---

## 2. Seguridad, Cumplimiento y Criptografía

### 2.1 Almacenamiento Seguro de Certificados Digitales DIAN (PKCS#12 / .p12)

La firma digital de documentos UBL 2.1 (Factura Electrónica, Nómina Electrónica, Documento Soporte, Eventos RADIAN) requiere la llave privada contenida en el certificado PKCS#12 (`.p12` / `.pfx`).

#### Arquitectura de Custodia Criptográfica (Envelope Encryption)
1. **Separación de Responsabilidades**: El certificado binario y su contraseña nunca se exponen al Frontend ni se almacenan en texto plano en la base de datos.
2. **Supabase Vault / AWS KMS / GCP Cloud KMS**:
   - La contraseña del certificado se cifra con una Clave Maestra (KEK - Key Encryption Key) administrada en KMS antes de insertarse en `vault.secrets` o `dian_certificates`.
   - El archivo binario `.p12` se almacena cifrado en reposo (AES-256-GCM) en un bucket privado de Supabase Storage / S3 con acceso restringido exclusivamente al microservicio de firma (`dian-signer`).
3. **Aislamiento en Memoria**: El microservicio de firma carga el certificado en memoria únicamente durante la operación de firma XAdES-EPES y destruye el buffer inmediatamente (`zeroize memory buffer`).

```
┌─────────────────────┐
│ Web Client (Admin)  │
└──────────┬──────────┘
           │ 1. Sube .p12 + Password vía HTTPS TLS 1.3
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js BFF / API Gateway (Zero-Knowledge Storage Proxy)    │
└──────────┬───────────────────────────────┬──────────────────┘
           │ 2. Cifra Payload con KMS KEK  │ 3. Guarda Secret
           ▼                               ▼
┌─────────────────────────────┐   ┌───────────────────────────┐
│ Supabase Storage (Privado)  │   │ Supabase Vault / Secrets  │
│ - Encrypted .p12 Blob       │   │ - Encrypted Password      │
│ - SSE-KMS (AES-256)         │   │ - Expiration Alert Date   │
└─────────────────────────────┘   └───────────────────────────┘
```

#### DDL Tabla de Certificados y Secretos DIAN
```sql
CREATE TABLE IF NOT EXISTS dian_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    issuer_name VARCHAR(255) NOT NULL,        -- Certicámara, GSE, Andes SCD
    serial_number VARCHAR(100) NOT NULL,
    subject_nit VARCHAR(20) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    storage_path TEXT NOT NULL,                -- Ruta en bucket privado
    encrypted_passphrase_secret_id UUID,       -- Referencia a vault.secrets
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, serial_number)
);

-- RLS: Solo Owner o Admin pueden ver la metadata (nunca el secreto desencriptado)
ALTER TABLE dian_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dian_certificates FORCE ROW LEVEL SECURITY;

CREATE POLICY "dian_cert_isolation" ON dian_certificates
    FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.has_permission(organization_id, 'configuracion', 'read')
    );
```

### 2.2 Registro de Auditoría Inmutable con Hash Chaining (Merkle Audit Trail)

Para garantizar cumplimiento tributario (Estatuto Tributario Art. 657 / 774) e impedir la alteración maliciosa o borrado de registros contables, se implementa una tabla `audit_logs` **append-only** con encadenamiento criptográfico (`SHA-256(prev_hash + data)`).

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'CANCEL', 'VOID', 'DIAN_TRANSMIT')),
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_ip INET,
    user_agent TEXT,
    sequence_number BIGSERIAL,
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_table ON audit_logs(organization_id, table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(organization_id, created_at DESC);

-- Prohibir UPDATE, DELETE y TRUNCATE en audit_logs a todos los roles
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM authenticated, anon, service_role;

-- Trigger Trigger-Based Tamper Proofing
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_hash VARCHAR(64);
    v_calculated_hash VARCHAR(64);
    v_org_id UUID;
    v_user_id UUID;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_changed JSONB := NULL;
    v_action VARCHAR(16);
    v_record_id UUID;
BEGIN
    -- Determinar acción y datos
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_record_id := NEW.id;
        v_org_id := NEW.organization_id;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_record_id := NEW.id;
        v_org_id := NEW.organization_id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        -- Extraer campos modificados
        SELECT jsonb_object_agg(n.key, n.value) INTO v_changed
        FROM jsonb_each(v_new) n
        WHERE v_old->n.key IS DISTINCT FROM n.value;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_record_id := OLD.id;
        v_org_id := OLD.organization_id;
        v_old := to_jsonb(OLD);
    END IF;

    -- Obtener el último hash de la organización (o génesis si es el primero)
    SELECT hash INTO v_prev_hash
    FROM audit_logs
    WHERE organization_id = v_org_id
    ORDER BY sequence_number DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    -- Calcular SHA-256 Hash Chain
    v_calculated_hash := encode(
        digest(
            v_prev_hash || '|' || 
            v_org_id::text || '|' || 
            TG_TABLE_NAME || '|' || 
            v_record_id::text || '|' || 
            v_action || '|' || 
            COALESCE(v_old::text, '') || '|' || 
            COALESCE(v_new::text, '') || '|' || 
            COALESCE(auth.uid()::text, 'system') || '|' || 
            clock_timestamp()::text,
            'sha256'
        ), 
        'hex'
    );

    INSERT INTO audit_logs (
        organization_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_fields,
        user_id,
        prev_hash,
        hash,
        created_at
    ) VALUES (
        v_org_id,
        TG_TABLE_NAME,
        v_record_id,
        v_action,
        v_old,
        v_new,
        v_changed,
        auth.uid(),
        v_prev_hash,
        v_calculated_hash,
        clock_timestamp()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Asignar triggers automáticos a tablas críticas
CREATE TRIGGER audit_invoices_trg
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER audit_journal_entries_trg
    AFTER INSERT OR UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION process_audit_log();
```

### 2.3 Cifrado a Nivel de Campo (FLE) y Enmascaramiento Dinámico de Datos (DDM)

1. **Cuentas Bancarias**: Enmascaramiento de números de cuenta para roles no autorizados (`cuenta.account_number = '•••• •••• •••• 4912'`).
2. **Información Salarial y Empleados**: Restricción estricta de `employees.base_salary` mediante vistas seguras o permisos granulares de columna.
3. **Llaves Técnicas DIAN (`technical_key`)**: Cifrado con `pgsodium` / `pgcrypto` en la tabla `dian_resolutions`.

---

## 3. Resiliencia en Integración DIAN y Manejo de Casos de Borde

### 3.1 Desacoplamiento Asíncrono de 2 Fases (Two-Phase Emission)

El mayor error arquitectural en sistemas de facturación electrónica es realizar la llamada HTTP a la DIAN dentro del flujo síncrono del usuario (Server Action / POST request). La DIAN puede tardar de 5 a 45 segundos o retornar `504 Gateway Timeout`.

**Solución**: Desacoplar la contabilización interna de la transmisión DIAN.

```
[ Usuario: "Aprobar Factura" ]
               │ (Transacción ACID local < 50ms)
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Transacción Local Inmediata (PostgreSQL)                  │
│    - Asigna Consecutivo de Factura (SELECT FOR UPDATE)      │
│    - Genera Asiento Contable (journal_entries)              │
│    - Genera Cartera / Cuenta por Cobrar (receivables)       │
│    - Calcula CUFE y Firma XML en Worker Local               │
│    - Estado: `ISSUED_PENDING_DIAN`                          │
│    - Encola Job en Message Queue                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Background Queue (BullMQ / Redis / Celery / pg_boss)     │
│    - Job: `transmit_invoice_to_dian(invoice_id)`            │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼ (Llamada con Circuit Breaker) ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ DIAN Web Service (Online)   │ │ DIAN Inaccesible / 5xx      │
│ - Validación UBL 2.1        │ │ - Circuit Breaker Disparado │
│ - Devuelve `ApplicationResp`│ │ - Activa Contingencia T04   │
│ - Estado: `DIAN_ACCEPTED`   │ │ - Reintenta en 48 Horas     │
└─────────────────────────────┘ └─────────────────────────────┘
```

### 3.2 Máquina de Estados Finita (FSM) de Facturación Electrónica

```
                          ┌─────────────┐
                          │    DRAFT    │
                          └──────┬──────┘
                                 │ Aprobar & Emitir
                                 ▼
                     ┌───────────────────────┐
                     │  ISSUED_PENDING_DIAN  │
                     └───────────┬───────────┘
                                 │ Encolar y Transmitir
                                 ▼
                     ┌───────────────────────┐
                     │      TRANSMITTING     │
                     └───────┬───────┬───────┘
           ┌─────────────────┘       └──────────────────┐
           │ DIAN 200 OK                                │ Error Reglas Negocio
           ▼                                            ▼
┌────────────────────┐                        ┌──────────────────┐
│   DIAN_ACCEPTED    │                        │  DIAN_REJECTED   │
│ (Terminal Éxito)   │                        │ (Corrige/Nota C) │
└────────────────────┘                        └──────────────────┘
           │
           │ Timeout / 504 / Caída DIAN (Circuit Breaker OPEN)
           ▼
┌────────────────────────────────────┐
│      CONTINGENCY_DIAN_04           │
│  (Emisión Válida al Cliente,       │
│   Sync Queue Automático en 48h)    │
└─────────────────┬──────────────────┘
                  │ DIAN Restablecida (Sync Worker)
                  ▼
┌────────────────────────────────────┐
│           DIAN_ACCEPTED            │
└────────────────────────────────────┘
```

### 3.3 Patrón Circuit Breaker (Disyuntor de Red)

Evita la saturación del sistema y el efecto *thundering herd* (avalancha de peticiones) cuando la DIAN experimenta caídas masivas:

```python
# /app/services/integration/circuit_breaker.py
import time
import logging
from enum import Enum

logger = logging.getLogger("dian_circuit_breaker")

class CircuitState(str, Enum):
    CLOSED = "CLOSED"       # Operación Normal: tráfico fluye a la DIAN
    OPEN = "OPEN"           # DIAN Caída: fast-fail inmediato, enruta a contingencia
    HALF_OPEN = "HALF_OPEN" # Prueba controlada con canary requests

class DianCircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0, half_open_attempts: int = 3):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_attempts = half_open_attempts
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_state_change = time.time()

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == CircuitState.OPEN:
            if now - self.last_state_change > self.recovery_timeout:
                logger.info("Circuit Breaker transitioned to HALF_OPEN: probing DIAN API...")
                self.state = CircuitState.HALF_OPEN
                self.last_state_change = now
                self.success_count = 0
                return True
            return False
        return True

    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.half_open_attempts:
                logger.info("DIAN API recovered. Circuit Breaker CLOSED.")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0

    def record_failure(self):
        self.failure_count += 1
        now = time.time()
        if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
            logger.warning(f"DIAN API failure threshold reached ({self.failure_count}). Circuit Breaker OPEN.")
            self.state = CircuitState.OPEN
            self.last_state_change = now
```

### 3.4 Manejo Normativo de Contingencias (Resoluciones DIAN 000042 y 000165)

| Tipo de Contingencia | Causa | Procedimiento Operativo | Formato Documental | Plazo de Transmisión |
|---|---|---|---|---|
| **Tipo 03 (Contingencia del Emisor)** | Falla eléctrica, caída de servidor ERP, pérdida de conexión a internet en el emisor. | Se factura en talonario de contingencia o papel con prefijo y resolución autorizada de contingencia. Al volver la conexión, se transcriben como documentos electrónicos `Tipo 03`. | XML UBL `InvoiceControl` / Tipo Documento 03 | Máximo **48 horas** tras restablecer el servicio. |
| **Tipo 04 (Contingencia DIAN)** | Indisponibilidad o timeouts recurrentes en el Web Service de la DIAN. | El sistema genera la factura electrónica normal con su CUFE, firma digital y código QR, y entrega el PDF al cliente con la leyenda *"Documento emitido en contingencia por indisponibilidad de los servicios informáticos electrónicos de la DIAN"*. Se encola en la base de datos para reintento. | XML UBL Factura Estándar / CUFE normal | Transmisión automática en **48 horas** post-recuperación. |

### 3.5 Cola de Reintentos con Backoff Exponencial y Jitter

Para la retransmisión de facturas en estado `ISSUED_PENDING_DIAN` o `CONTINGENCY_DIAN_04`:

$$\text{Delay} = \min\left(3600, \text{Base} \times 2^{\text{attempt}} + \text{Uniform}(0, \text{Jitter})\right)$$

- **Máximo de Reintentos Automáticos**: 8 intentos en un período de 48 horas.
- **Dead-Letter Queue (DLQ)**: Si una factura supera los 8 reintentos o recibe un rechazo fatal de reglas de negocio (ej. NIT receptor inválido o código de actividad no registrado en RUT), pasa a estado `DIAN_MANUAL_REVIEW` y genera una alerta prioritaria en el Dashboard Contable.

---

## 4. DDL Refinado de Tablas de Facturación, Bancos, Nómina y DIAN

A continuación se presentan los DDLs corregidos y completos con soporte multi-tenant (`organization_id`), claves compuestas y restricciones para `IMPLEMENTATION_PLAN.md`:

```sql
-- =====================================================
-- 1. FACTURAS CON AISLAMIENTO MULTI-TENANT
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    prefix VARCHAR(10) NOT NULL,
    number INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('VENTA', 'COMPRA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'CONTINGENCIA_03')),
    date DATE NOT NULL,
    due_date DATE,
    third_party_id UUID NOT NULL REFERENCES third_parties(id) ON DELETE RESTRICT,
    
    -- Totales
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    discount NUMERIC(20,2) NOT NULL DEFAULT 0,
    iva_5 NUMERIC(20,2) NOT NULL DEFAULT 0,
    iva_19 NUMERIC(20,2) NOT NULL DEFAULT 0,
    iva_excluded NUMERIC(20,2) NOT NULL DEFAULT 0,
    consumption_tax NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_source NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_iva NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_ica NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    -- Estado y Ciclo Contable
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'APPROVED', 'SENT', 'PAID', 'CANCELLED')),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    
    -- DIAN Facturación Electrónica
    dian_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SENT' 
        CHECK (dian_status IN ('NOT_SENT', 'ISSUED_PENDING_DIAN', 'TRANSMITTING', 'DIAN_ACCEPTED', 'DIAN_REJECTED', 'CONTINGENCY_04', 'ERROR_DLQ')),
    cufe VARCHAR(96),
    qr_content TEXT,
    xml_signed_url TEXT,
    dian_response_code VARCHAR(50),
    dian_response_message TEXT,
    dian_validation_date TIMESTAMPTZ,
    dian_retry_count INTEGER NOT NULL DEFAULT 0,
    dian_last_attempt_at TIMESTAMPTZ,
    
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(organization_id, prefix, number)
);

CREATE INDEX idx_invoices_org_date ON invoices(organization_id, date DESC);
CREATE INDEX idx_invoices_org_status ON invoices(organization_id, dian_status);
CREATE INDEX idx_invoices_third_party ON invoices(organization_id, third_party_id);

-- =====================================================
-- 2. CUENTAS BANCARIAS Y TESORERÍA CON TENANT ID
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    bank_name VARCHAR(100) NOT NULL,
    account_number_encrypted TEXT NOT NULL,    -- Cifrado pgsodium/pgcrypto
    account_number_masked VARCHAR(20) NOT NULL, -- Ej: **** **** 1234
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('AHORROS', 'CORRIENTE')),
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    current_balance NUMERIC(20,2) NOT NULL DEFAULT 0,
    puc_account_code VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, bank_name, account_number_masked)
);

-- =====================================================
-- 3. NÓMINA Y EMPLEADOS CON TENANT ID
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    third_party_id UUID NOT NULL REFERENCES third_parties(id) ON DELETE RESTRICT,
    employee_code VARCHAR(30),
    hire_date DATE NOT NULL,
    termination_date DATE,
    position VARCHAR(100) NOT NULL,
    contract_type VARCHAR(30) NOT NULL CHECK (contract_type IN ('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'PRESTACION_SERVICIOS', 'APRENDIZAJE')),
    base_salary NUMERIC(20,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, third_party_id)
);
```

---

## 5. Resumen de Mejoras y Puntos Clave de Inserción para `IMPLEMENTATION_PLAN.md`

| Sección en `IMPLEMENTATION_PLAN.md` | Mejora Requerida | Impacto / Mitigación de Riesgo |
|---|---|---|
| **Arquitectura Objetivo** | Agregar microservicio `dian-signer` aislado y cola de mensajes con Circuit Breaker. | Aísla certificados de los servidores API públicos; previene cuelgues por caídas de la DIAN. |
| **Fase 0 (Migraciones)** | Inyectar `organizations` y `organization_members`, agregar `organization_id` a todas las tablas existentes. | Elimina la vulnerabilidad de fuga de datos multi-empresa. |
| **Fase 2 (Facturación)** | Separar emisión contable (Fase 1) de transmisión DIAN (Fase 2 asíncrona). Incluir DDLs con `organization_id`. | Garantiza fluidez en la interfaz de usuario (cero retrasos) y cumplimiento legal de contingencia Tipo 04. |
| **Seguridad y Cumplimiento** | Incorporar `dian_certificates` con Supabase Vault/KMS y tabla `audit_logs` inmutable con hash chaining. | Cumplimiento estricto de custodia de llaves privadas y no-repudio de auditoría fiscal. |
| **Testing y Validación** | Agregar tests de penetración multi-tenant RLS y simulación de fallos DIAN (Timeout 504 / Circuit Breaker). | Asegura que ningún tenant pueda ver registros ajenos y que el sistema degrade elegantemente. |
