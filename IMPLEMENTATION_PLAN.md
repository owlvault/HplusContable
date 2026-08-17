# 📋 Plan Maestro de Implementación - DigiKawsay / CFO-AI
## Sistema Operativo Comercial y Contable Autónomo para Colombia (NIIF & DIAN)
### Arquitectura de Grado Empresarial: Multi-Tenant, Zero-Jargon UX, Outbox Transaccional, Resiliencia Distribuida y Blindaje Adversarial

---

## 📑 ÍNDICE GENERAL

1. [Visión Ejecutiva y Principios Arquitecturales](#1-visión-ejecutiva-y-principios-arquitecturales)
2. [Arquitectura del Sistema y Diagrama de Componentes](#2-arquitectura-del-sistema-y-diagrama-de-componentes)
3. [Seguridad, Aislamiento Multi-Tenant, Regímenes Tributarios y RBAC](#3-seguridad-aislamiento-multi-tenant-regímenes-tributarios-y-rbac)
4. [Transacciones en Dos Fases, Patrón Outbox con Claim-and-Commit e Idempotencia](#4-transacciones-en-dos-fases-patrón-outbox-con-claim-and-commit-e-idempotencia)
5. [Concurrencia, Consecutivos Atómicos, Partición Offline y Libro Mayor Append-Only](#5-concurrencia-consecutivos-atómicos-partición-offline-y-libro-mayor-append-only)
6. [Transacciones Compensatorias, Matriz de Notas Crédito, Kardex Congelado y Pasarelas](#6-transacciones-compensatorias-matriz-de-notas-crédito-kardex-congelado-y-pasarelas)
7. [Custodia Criptográfica de Certificados Digitales DIAN](#7-custodia-criptográfica-de-certificados-digitales-dian)
8. [Auditoría Inmutable Criptográfica (Merkle Hash Chaining Anti-Forking)](#8-auditoría-inmutable-criptográfica-merkle-hash-chaining-anti-forking)
9. [Resiliencia DIAN, Circuit Breaker Distribuido, Reconciliación In-Doubt y Contingencias (Tipo 03 / 04)](#9-resiliencia-dian-circuit-breaker-distribuido-reconciliación-in-doubt-y-contingencias-tipo-03--04)
10. [Taxonomía "Zero-Accounting Jargon" e Interacción UI/UX](#10-taxonomía-zero-accounting-jargon-e-interacción-uiux)
11. [Matriz de In-Context Action Cards](#11-matriz-de-in-context-action-cards)
12. [Blueprints Detallados de los Core User Journeys](#12-blueprints-detallados-de-los-core-user-journeys)
13. [Fases Detalladas de Implementación (0 a 8)](#13-fases-detalladas-de-implementación-0-a-8)
14. [Consolidado DDL de Base de Datos PostgreSQL](#14-consolidado-ddl-de-base-de-datos-postgresql)
15. [Plan de Testing, Penetración y Simulación de Fallos Adversariales](#15-plan-de-testing-penetración-y-simulación-de-fallos-adversariales)
16. [Cronograma, Checklist de Producción y Próximos Pasos](#16-cronograma-checklist-de-producción-y-próximos-pasos)

---

## 1. VISIÓN EJECUTIVA Y PRINCIPIOS ARQUITECTURALES

### 1.1 El Problema Fundamental
El 85% de las MiPymes en Colombia fracasan en la adopción de sus sistemas ERP debido a la sobrecarga cognitiva impuesta por interfaces diseñadas exclusivamente para contadores (partida doble manual, códigos PUC crudos, retenciones complejas y errores crípticos de la DIAN). Al mismo tiempo, los sistemas existentes sufren de fragilidad técnica crítica: acoplamiento síncrono bloqueante con los servicios web gubernamentales de la DIAN, condiciones de carrera en emisión concurrente bajo alta demanda, bloqueos de pool de base de datos por latencia externa, y falsas anulaciones por caídas de red intermedias.

### 1.2 Principios Rectores DigiKawsay
1. **Zero-Accounting Jargon en UI Operativa:** El usuario comercial interactúa exclusivamente con conceptos de negocio en lenguaje natural (Vender, Cobrar, Gastar, Pagar, Stock, Ajustar). Los débitos, créditos, códigos PUC y reglas tributarias se resuelven de manera autónoma, determinista y matemáticamente perfecta bajo el capó.
2. **Auditor Lens (Modo Contador):** Una vista especializada, auditable y conmutable donde el contador público certificado puede auditar comprobantes, reclasificar cuentas, cerrar períodos fiscales y emitir medios magnéticos (Exógena DIAN) sin alterar ni ralentizar la agilidad del equipo de ventas.
3. **Desacoplamiento Transaccional en 2 Fases con Claim-and-Commit:** La confirmación de una venta al cliente y la impresión del ticket toman menos de 50ms mediante transacciones ACID locales ultracortas. El worker asíncrono procesa la firma UBL 2.1 y la transmisión DIAN sin retener conexiones de base de datos durante las llamadas SOAP externas (Patrón Claim-and-Commit en 2 pasos).
4. **Reconciliación Idempotente y Cero Falsos Rollbacks:** Ante timeouts de red o errores de duplicidad de la DIAN (Regla 99 / Documento ya existente), el sistema ejecuta una verificación idempotente previa (`GetStatus` / `GetStatusZip`) antes de cualquier acción compensatoria, previniendo la anulación accidental de facturas legalmente aceptadas.
5. **Inmutabilidad, Kardex Histórico Congelado y No-Repudio Legal:** Todo registro contable y de auditoría es estrictamente Append-Only con encadenamiento criptográfico SHA-256 serializado mediante `pg_advisory_xact_lock` (Merkle Hash Chain Anti-Forking). Toda reversión de inventario y costo de ventas utiliza el costo unitario histórico congelado (`unit_cost`) al momento de la venta.
6. **Defensa en Profundidad y Aislamiento Multi-Tenant:** `organization_id` obligatorio en todas las entidades de datos, protegido por PostgreSQL Row Level Security (`FORCE ROW LEVEL SECURITY`), RBAC granular y cifrado de certificados PKCS#12 mediante Envelope Encryption (KMS / Supabase Vault).

---

## 2. ARQUITECTURA DEL SISTEMA Y DIAGRAMA DE COMPONENTES

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND (Next.js 15 App Router)                            │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  UI Operativa (Zero-Jargon POS, Facturación, Compras, Tesorería, Asistente Tributario)│  │
│  ├───────────────────────────────────────────────────────────────────────────────────────┤  │
│  │  Auditor Lens (Modo Contador: PUC, Asientos, Balances NIIF, Formatos Exógena DIAN)    │  │
│  ├───────────────────────────────────────────────────────────────────────────────────────┤  │
│  │  BFF Gateway & Client-side State Cache (Idempotency Key Injection, Action Cards UI)  │  │
│  │  Offline POS Engine (IndexedDB Local Queue + Leased Consecutive Range Chunks)         │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ HTTPS / TLS 1.3 (JWT + Tenant Context)
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY & DOMAIN MICROSERVICES (FastAPI)                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │
│  │  Accounting   │ │    Billing    │ │   Treasury    │ │    Payroll    │ │    AI / CFO   │  │
│  │    Service    │ │    Service    │ │    Service    │ │    Service    │ │    Service    │  │
│  │  (Port 8002)  │ │  (Port 8003)  │ │  (Port 8004)  │ │  (Port 8005)  │ │  (Port 8001)  │  │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────┬───────┘  │
└──────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼──────────┘
           │                 │                 │                 │                 │
           ▼                 ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BASE DE DATOS (PostgreSQL / Supabase)                     │
│  - Row Level Security (RLS) FORZADO por organization_id                                     │
│  - Tablas de Negocio (invoices, inventory_items, payment_intents, bank_accounts)            │
│  - Matriz Tributaria Dinámica (tax_configurations con histórico UVT y Regímenes E.T. 911)   │
│  - Transacciones ACID Locales (< 50ms)                                                      │
│  - Tabla outbox_events (Transactional Outbox con Lease Expiration Index)                    │
│  - Tabla idempotency_keys & Tabla audit_logs (Inmutable SHA-256 con Advisory Locks)         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼ (CDC / Polling 'FOR UPDATE SKIP LOCKED')
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               ASYNCHRONOUS WORKER INFRASTRUCTURE                            │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────────────────┐  │
│  │  DIAN Outbox Dispatch Worker    │   │  Private Signer Microservice (dian-signer)      │  │
│  │  - Claim-and-Commit (2 Pasos)   │   │  - Zero-Memory Buffer PKCS#12 (.p12) Decryption │  │
│  │  - In-Doubt Reconciler (GetStat)│◄──┤  - Envelope Encryption via Supabase Vault / KMS │  │
│  │  - Distributed Circuit Breaker  │   │  - XAdES-EPES Digital Signature & CUFE Hash     │  │
│  │    (Redis + Error Classification│   └─────────────────────────────────────────────────┘  │
│  │  - Contingencia Tipo 03/04      │                                                        │
│  └────────────────┬────────────────┘                                                        │
│                   │                                                                         │
│                   ▼ SOAP / REST Web Services (HTTPS)                                        │
│      ┌─────────────────────────┐                                                            │
│      │  DIAN SERVIDORES (Gov)  │                                                            │
│      └─────────────────────────┘                                                            │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────────────────┐  │
│  │  Bank Reconciler Worker         │   │  Dead-Letter Queue (DLQ) & Alerting Engine      │  │
│  │  - Gateway Settlement (N:1 Bold)│   │  - Tabla dead_letter_events                     │  │
│  │  - GMF 4x1000 Exemption Matcher │   │  - Admin Replay API (/api/v1/admin/dlq/replay)  │  │
│  │  - Auto-Reversal PaymentIntents │   │  - Alertas Proactivas en UI (Action Cards)      │  │
│  └─────────────────────────────────┘   └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SEGURIDAD, AISLAMIENTO MULTI-TENANT, REGÍMENES TRIBUTARIOS Y RBAC

### 3.1 Modelo de Entidad Multi-Tenant y Regímenes Tributarios
Toda entidad de negocio pertenece de manera estricta a una organización (`organizations.id`). Los regímenes tributarios se modelan acorde con la legislación colombiana (Estatuto Tributario Nacional y Régimen Simple de Tributación):

```sql
-- Organizaciones (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit VARCHAR(20) NOT NULL UNIQUE,
    dv VARCHAR(1) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_regime VARCHAR(50) NOT NULL DEFAULT 'RESPONSABLE_IVA'
        CHECK (tax_regime IN (
            'RESPONSABLE_IVA', 
            'NO_RESPONSABLE_IVA', 
            'REGIMEN_SIMPLE', 
            'GRAN_CONTRIBUYENTE',
            'AUTORRETENEDOR'
        )),
    economic_activity_code VARCHAR(10), -- Código CIIU principal
    is_withholding_agent BOOLEAN NOT NULL DEFAULT false, -- Calidad de agente retenedor (Art. 368-2 E.T.)
    plan_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (plan_tier IN ('STANDARD', 'PRO', 'ENTERPRISE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Membresías de Usuario por Organización
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'SELLER'
        CHECK (role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'SELLER', 'WAREHOUSE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id, is_active);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, is_active);
```

### 3.2 Matriz de Roles (RBAC)

| Módulo / Acción | Propietario (Owner) | Administrador (Admin) | Contador (Accountant) | Facturador / Cajero (Seller) | Bodeguero (Warehouse) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Facturación POS / Ventas** | CRUD + Aprobar | CRUD + Aprobar | Solo Lectura | Crear Borradores + Cobro | Sin Acceso |
| **Facturación Electrónica DIAN**| Configurar + Emitir | Emitir | Auditar + Notas Crédito| Emitir | Sin Acceso |
| **Ingesta Contingencia 03 (TC)**| Ingesta + Validar | Ingesta + Validar | Auditar + Validar | Ingesta Manual | Sin Acceso |
| **Catálogo Productos / Precios**| CRUD Completo | CRUD Completo | Solo Lectura | Lectura Precios | Lectura Stock |
| **Ajustes de Inventario** | Aprobar Ajuste | Aprobar Ajuste | Auditar Costos | Sin Acceso | Conteo Físico / Registrar |
| **Asientos Contables / PUC** | Auditar | Auditar | CRUD + Cierre Contable| Sin Acceso | Sin Acceso |
| **Tesorería y Conciliación** | CRUD + Conciliar | CRUD + Conciliar | Conciliar + Ajustar | Registro Recibos | Sin Acceso |
| **Pasarelas y PaymentIntents**| Administrar + Reversos| Administrar + Reversos| Auditar Liquidaciones | Cobro en Punto de Venta| Sin Acceso |
| **Nómina y Salarios** | CRUD + Aprobar | CRUD + Aprobar | Liquidar + DIAN NE | Sin Acceso | Sin Acceso |
| **Certificados y Llaves DIAN** | Administrar | Solo Ver Estado | Sin Acceso | Sin Acceso | Sin Acceso |
| **Logs de Auditoría Inmutable**| Lectura | Lectura | Lectura | Sin Acceso | Sin Acceso |

### 3.3 Funciones de Seguridad RLS y Políticas de Base de Datos
Todas las tablas de negocio incluyen `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT` y activan `FORCE ROW LEVEL SECURITY`.

```sql
-- Helper function: Obtener IDs de organizaciones activas del usuario autenticado
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

-- Helper function: Obtener rol del usuario en la organización
CREATE OR REPLACE FUNCTION auth.get_user_role(p_org_id UUID)
RETURNS VARCHAR
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id 
      AND is_active = true 
    LIMIT 1;
$$;

-- Aplicación de RLS Forzado en Facturas
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_invoices_select" ON invoices
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT auth.get_user_organizations()));

CREATE POLICY "tenant_isolation_invoices_insert" ON invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.get_user_role(organization_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'SELLER')
    );

CREATE POLICY "tenant_isolation_invoices_update" ON invoices
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.get_user_role(organization_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'SELLER')
        AND state = 'DRAFT' -- Facturas aprobadas o enviadas son inmutables a updates directos
    );

CREATE POLICY "tenant_isolation_invoices_delete" ON invoices
    FOR DELETE TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.get_user_role(organization_id) IN ('OWNER', 'ADMIN')
        AND state = 'DRAFT' -- Prohibido borrar facturas aprobadas
    );
```

---

## 4. TRANSACCIONES EN DOS FASES, PATRÓN OUTBOX CON CLAIM-AND-COMMIT E IDEMPOTENCIA

### 4.1 Arquitectura Transaccional Desacoplada (Claim-and-Commit Pattern)
Para garantizar alta disponibilidad (<50ms en cajas POS) e impedir que los timeouts de la DIAN agoten el pool de conexiones de PostgreSQL (PgBouncer), el ciclo de procesamiento implementa el patrón **Claim-and-Commit en 2 pasos independientes**:

```
FASE 1: TRANSACCIÓN ACID LOCAL (< 50ms)
[Cliente POS / Facturación]
       │
       ▼
[Inicio Transacción PostgreSQL]
  ├── 1. SELECT ... FOR UPDATE en dian_resolutions (Consecutivo Atómico con Timezone America/Bogota)
  ├── 2. SELECT ... FOR UPDATE en inventory_levels (Ordenado por product_id para evitar AB-BA deadlocks)
  ├── 3. INSERT INTO invoices & invoice_lines (Congela unit_cost histórico)
  ├── 4. INSERT INTO journal_entries & journal_lines (Doble partida balanceada)
  ├── 5. INSERT INTO receivables (Cuenta por cobrar / Cartera)
  ├── 6. INSERT INTO outbox_events (Tópico: 'dian.invoice.emission', Status: 'PENDING')
  └── 7. COMMIT WORK (Libera todos los locks de BD inmediatamente)
       │
       ▼ (Respuesta Inmediata < 50ms: Factura Aprobada Localmente + Ticket Impreso)

FASE 2: ASYNCHRONOUS CLAIM-AND-COMMIT PIPELINE (Worker en Background)
[Outbox Worker Poller]
       │
       ├── PASO 1 (Transacción BD Ultracorta < 5ms):
       │     Adquiere lote con 'FOR UPDATE SKIP LOCKED'.
       │     Actualiza status='PROCESSING', locked_by=worker_id, locked_until=NOW() + INTERVAL '2 minutes'.
       │     COMMIT WORK y LIBERA la conexión a PostgreSQL.
       │
       ├── PASO 2 (Procesamiento Externo Fuera de BD - Zero DB Connections Held):
       │     ├── Invoca dian-signer (Carga certificado .p12 en memoria efímera, firma XAdES-EPES, calcula CUFE)
       │     ├── Evalúa Circuit Breaker Distribuido (Redis)
       │     └── Envía XML firmado a DIAN Web Service vía HTTPS SOAP
       │
       └── PASO 3 (Transacción BD de Finalización < 5ms - Conexión Fresca):
             ├── CASO A: DIAN Acepta (HTTP 200 + ApplicationResponse "Aceptado")
             │     └── UPDATE invoices SET dian_status='DIAN_ACCEPTED', cufe=..., qr_content=...
             │     └── UPDATE outbox_events SET status='COMPLETED'
             │
             ├── CASO B: Timeout / Red / Error 99 "Documento ya Existe" (In-Doubt State)
             │     └── Invoca GetStatus / GetStatusZip(CUFE) ante la DIAN:
             │           ├── Si DIAN='Aceptado': Actualiza a DIAN_ACCEPTED + Extrae CUFE (Cero Compensación)
             │           └── Si DIAN='No existe': Programa reintento con Jittered Backoff en ventana 48h
             │
             ├── CASO C: Caída de Infraestructura DIAN (5xx / Timeout Consecutivo)
             │     └── Circuit Breaker -> OPEN
             │     └── UPDATE invoices SET dian_status='CONTINGENCY_DIAN_04'
             │     └── Reintento automático en background dentro del plazo legal de 48 horas
             │
             └── CASO D: Rechazo Semántico Fatal Definitivo (Regla de negocio inválida confirmada)
                   └── UPDATE invoices SET dian_status='DIAN_REJECTED'
                   └── Disparo de Transacción Compensatoria (Contrasiento + Restock al costo histórico congelado)
```

### 4.2 DDL de Infraestructura Transaccional, Eventos Zombie y PaymentIntents

```sql
-- 1. Tabla de Eventos Outbox (Transactional Outbox Pattern)
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    aggregate_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'CREDIT_NOTE', 'PAYROLL', 'PAYMENT', 'PAYMENT_INTENT'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,    -- 'invoice.dian_emission_requested', 'payment.auto_reversal'
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DLQ')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    locked_by VARCHAR(100),
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ
);

-- Índice optimizado con recuperación de eventos zombie (Patch 2)
CREATE INDEX idx_outbox_events_poll 
ON outbox_events(scheduled_for, created_at) 
WHERE status IN ('PENDING', 'FAILED') OR (status = 'PROCESSING' AND locked_until < clock_timestamp());

-- 2. Cola de Mensajes Muertos (Dead-Letter Queue - DLQ)
CREATE TABLE dead_letter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_event_id UUID REFERENCES outbox_events(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    stack_trace TEXT,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    replayed_at TIMESTAMPTZ,
    replayed_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT
);

CREATE INDEX idx_dlq_org ON dead_letter_events(organization_id, failed_at DESC);

-- 3. Idempotencia Empresarial (Prevención de Doble Facturación / Doble Cobro)
CREATE TABLE idempotency_keys (
    key VARCHAR(128) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- SHA-256 del cuerpo de la petición serializado
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (organization_id, key)
);

CREATE INDEX idx_idempotency_cleanup 
ON idempotency_keys(created_at) 
WHERE created_at < NOW() - INTERVAL '48 hours';

-- 4. Pasarela de Pagos en Dos Fases (Payment Intents & Auto-Reversal - Patch 10)
CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    gateway_name VARCHAR(50) NOT NULL, -- 'BOLD', 'WOMPI', 'REDEBAN', 'CREDIBANCO', 'PSE'
    gateway_transaction_id VARCHAR(100),
    external_idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'COP',
    status VARCHAR(30) NOT NULL DEFAULT 'REQUIRES_PAYMENT'
        CHECK (status IN ('REQUIRES_PAYMENT', 'AUTHORIZED', 'CAPTURED', 'VOIDED', 'REFUNDED', 'FAILED')),
    payment_method VARCHAR(50), -- 'CREDIT_CARD', 'DEBIT_CARD', 'PSE', 'NEQUI', 'DAVIPLATA'
    gateway_fee NUMERIC(20,2) NOT NULL DEFAULT 0,
    gateway_tax NUMERIC(20,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    error_code VARCHAR(50),
    error_message TEXT,
    captured_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_payment_intents_org ON payment_intents(organization_id, status, created_at DESC);
CREATE INDEX idx_payment_intents_invoice ON payment_intents(invoice_id);
```

---

## 5. CONCURRENCIA, CONSECUTIVOS ATÓMICOS, PARTICIÓN OFFLINE Y LIBRO MAYOR APPEND-ONLY

### 5.1 Asignación Atómica de Consecutivos DIAN con Timezone 'America/Bogota'
Para evitar huecos o duplicaciones, y prevenir que las resoluciones expiren 5 horas antes debido al desfase UTC:

```sql
CREATE OR REPLACE FUNCTION get_next_invoice_number_secure(
    p_org_id UUID,
    p_prefix VARCHAR(10)
)
RETURNS TABLE (
    assigned_number INTEGER,
    resolution_id UUID,
    is_exhausted BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_res RECORD;
    v_next INTEGER;
    v_clean_prefix VARCHAR(10);
BEGIN
    v_clean_prefix := COALESCE(p_prefix, '');

    -- Bloqueo pesimista exclusivo evaluando fecha legal en Zona Horaria de Colombia (Patch 7)
    SELECT id, range_from, range_to, current_number, valid_until
    INTO v_res
    FROM dian_resolutions
    WHERE organization_id = p_org_id
      AND COALESCE(prefix, '') = v_clean_prefix
      AND is_active = true
      AND valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una resolución DIAN activa y vigente para el prefijo "%" en la empresa %', v_clean_prefix, p_org_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Calcular siguiente consecutivo
    IF v_res.current_number IS NULL OR v_res.current_number < v_res.range_from THEN
        v_next := v_res.range_from;
    ELSE
        v_next := v_res.current_number + 1;
    END IF;

    -- Validar límite autorizado
    IF v_next > v_res.range_to THEN
        RAISE EXCEPTION 'Rango de facturación agotado para el prefijo "%". Máximo autorizado: %, Intento: %',
            v_clean_prefix, v_res.range_to, v_next
            USING ERRCODE = 'P0003';
    END IF;

    -- Actualizar contador atómicamente
    UPDATE dian_resolutions
    SET current_number = v_next,
        updated_at = clock_timestamp()
    WHERE id = v_res.id;

    RETURN QUERY SELECT v_next, v_res.id, (v_next = v_res.range_to);
END;
$$;
```

### 5.2 Partición de Rangos para POS Offline y Reconciliación de Stock Negativo (Patch 5)
Cuando una terminal POS opera sin conexión a internet:
1. **Arriendo de Bloques de Consecutivos (Leased Consecutive Range Chunks):** Al iniciar turno con internet, el terminal solicita al servidor un bloque pre-asignado (ej. Terminal 1 arrienda 1001-1100, Terminal 2 arrienda 1101-1200). Las ventas offline emiten dentro de su bloque arrendado garantizando colisiones cero con el constraint `UNIQUE(organization_id, prefix, number)`.
2. **Reconciliación de Stock en Sincronización Offline:** Si ocurren ventas simultáneas en dos cajas offline que superan el saldo en servidor, los eventos de sincronización ingresan con `is_offline_sync: true`. El sistema permite el saldo negativo transitorio en `inventory_levels`, genera un registro de auditoría y despliega la Action Card de Conteo Físico / Ajuste por Faltante.

```sql
CREATE TABLE pos_consecutive_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    resolution_id UUID NOT NULL REFERENCES dian_resolutions(id) ON DELETE RESTRICT,
    pos_terminal_id VARCHAR(50) NOT NULL,
    prefix VARCHAR(10) NOT NULL,
    leased_from INTEGER NOT NULL,
    leased_to INTEGER NOT NULL,
    current_leased_number INTEGER NOT NULL,
    is_exhausted BOOLEAN NOT NULL DEFAULT false,
    leased_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(organization_id, resolution_id, leased_from, leased_to)
);

CREATE INDEX idx_pos_leases ON pos_consecutive_leases(organization_id, pos_terminal_id, is_exhausted);
```

### 5.3 Deducción Atómica de Inventario por Bodega y Prevención de Deadlocks
1. **Ordenamiento Alfanumérico:** El backend ordena siempre los `product_id` alfanuméricamente antes de solicitar bloqueos.
2. **Partición por Bodega (`warehouse_id`):** Los niveles de existencias se segregan por sede/bodega física.
3. **Restricción `CHECK (available_quantity >= 0)`:** Salvaguarda a nivel de base de datos contra sobreventa accidental.

```sql
CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    available_quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, warehouse_id, product_id),
    CONSTRAINT chk_inventory_non_negative CHECK (available_quantity >= 0)
);

-- Deducción atómica con bloqueo de tupla
UPDATE inventory_levels
SET available_quantity = available_quantity - p_qty,
    version = version + 1,
    updated_at = clock_timestamp()
WHERE product_id = p_product_id
  AND warehouse_id = p_warehouse_id
  AND organization_id = p_org_id
  AND available_quantity >= p_qty;
```

### 5.4 Libro Mayor Inmutable (Append-Only) y Rollup Mensual
Las tablas `journal_entries` y `journal_lines` son **estrictamente de inserción (Append-Only)**. Jamás se ejecutan `UPDATE` sobre líneas de asientos contabilizados. Para optimizar consultas de balances financieros de alto tráfico sin colisión de bloqueos, se implementa la tabla rollup de balances mensuales:

```sql
CREATE TABLE account_monthly_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    initial_debit NUMERIC(20,2) NOT NULL DEFAULT 0,
    initial_credit NUMERIC(20,2) NOT NULL DEFAULT 0,
    period_debit NUMERIC(20,2) NOT NULL DEFAULT 0,
    period_credit NUMERIC(20,2) NOT NULL DEFAULT 0,
    final_debit NUMERIC(20,2) NOT NULL DEFAULT 0,
    final_credit NUMERIC(20,2) NOT NULL DEFAULT 0,
    final_balance NUMERIC(20,2) NOT NULL DEFAULT 0,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, account_code, year, month)
);

CREATE INDEX idx_monthly_balances_lookup 
ON account_monthly_balances(organization_id, year, month, account_code);
```

---

## 6. TRANSACCIONES COMPENSATORIAS, MATRIZ DE NOTAS CRÉDITO, KARDEX CONGELADO Y PASARELAS

### 6.1 Matriz de Despacho en Notas Crédito y Kardex con Costo Congelado (Patch 3)
Bajo la normativa colombiana (Resoluciones DIAN 000042 y 000165) y normas NIIF (NIC 2 / IAS 2):
1. **Preservación Inmutable del Costo Unitario Histórico (`unit_cost` y `cogs_amount`):** Cada línea de factura (`invoice_lines`) almacena el costo exacto al momento de la venta. Todo contrasiento o nota crédito reversa contra ese costo congelado, impidiendo que fluctuaciones posteriores del promedio ponderado descuadren el libro mayor.
2. **Matriz de Comportamiento por Concepto DIAN:**

| Código Concepto DIAN | Descripción Legal | Afectación Inventario (Kardex) | Afectación Contable | Tratamiento Cartera / Saldo |
|:---:|---|:---:|---|---|
| **1** | **Devolución de parte de los bienes** | **Restock Físico Parcial** (unidades devueltas @ costo histórico congelado). | Débito 4175 (Devoluciones), Débito 2408 (IVA), Débito 1435 (Inv), Crédito 6135 (Costo), Crédito 1305. | Disminuye saldo de la factura por cobrar. |
| **2** | **Anulación de factura electrónica** | **Restock Físico Total** (100% de ítems @ costo histórico congelado). | Reversión 100% ingresos, IVA y costo de ventas. | Si impaga: salda 1305. Si ya estaba pagada: Acredita Pasivo `280505` (Anticipo / Saldo a favor del cliente) o egreso de caja. |
| **3** | **Rebaja o descuento comercial posterior** | **CERO RESTOCK DE INVENTARIO** (mercancía permanece con el cliente). | Débito 4175 (Rebajas y descuentos), Débito 2408 (IVA proporcional), Crédito 1305 / Pasivo 2805. | Ajusta el valor monetario a cobrar. |
| **4** | **Ajuste de precio / Financiero** | **CERO RESTOCK DE INVENTARIO**. | Ajuste financiero directo en líneas de ingreso / cartera. | Ajusta saldo por cobrar. |
| **5** | **Otros conceptos comerciales** | Según especificación de línea. | Ajuste contable según naturaleza. | Ajusta saldo por cobrar. |

### 6.2 DDL de Notas Crédito y Líneas con Costo Congelado

```sql
CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    prefix VARCHAR(10) NOT NULL,
    number INTEGER NOT NULL,
    dian_concept_code VARCHAR(5) NOT NULL CHECK (dian_concept_code IN ('1', '2', '3', '4', '5')),
    date TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    third_party_id UUID NOT NULL REFERENCES third_parties(id) ON DELETE RESTRICT,
    
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    discount NUMERIC(20,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    cude VARCHAR(96),
    qr_content TEXT,
    xml_signed_url TEXT,
    dian_response JSONB,
    dian_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SENT'
        CHECK (dian_status IN ('NOT_SENT', 'ISSUED_PENDING_DIAN', 'TRANSMITTING', 'DIAN_ACCEPTED', 'DIAN_REJECTED', 'CONTINGENCY_04')),
    
    journal_entry_id UUID REFERENCES journal_entries(id),
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'APPROVED', 'SENT', 'VOIDED')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, prefix, number)
);

CREATE TABLE credit_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,2) NOT NULL DEFAULT 0,
    historical_unit_cost NUMERIC(20,2) NOT NULL DEFAULT 0, -- Costo histórico congelado para restock
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    restock_inventory BOOLEAN NOT NULL DEFAULT true -- false for Concept 3 & 4
);
```

### 6.3 Compensación y Reversos Automáticos en Pasarelas de Pago (Patch 10)
Si la tarjeta de un cliente es cobrada exitosamente por la pasarela (Bold, Wompi, Datáfono), pero la transacción local de base de datos falla posteriormente (ej. resolución DIAN agotada o deadlock de inventario):
1. El backend captura la excepción y despacha un evento prioritario a `outbox_events` con tópico `payment.auto_reversal`.
2. El worker de compensación invoca de inmediato la API de reverso (`void` / `refund`) de la pasarela con la `external_idempotency_key`, evitando cobros fantasma o descuadres de fondos para el cliente.

---

## 7. CUSTODIA CRIPTOGRÁFICA DE CERTIFICADOS DIGITALES DIAN

### 7.1 Arquitectura de Envelope Encryption
La llave privada del certificado digital PKCS#12 (`.p12` / `.pfx`) y su contraseña nunca se almacenan en texto plano en la base de datos ni se exponen al frontend.

1. **Cifrado de Contraseña (Vault / KMS):** La clave del certificado se cifra con una Key Encryption Key (KEK) administrada en AWS KMS / Supabase Vault antes de guardarse en `dian_certificates`.
2. **Almacenamiento de Binario (.p12):** El archivo binario se almacena en un bucket privado de Supabase Storage / S3 con cifrado en reposo AES-256-GCM y políticas IAM que restringen su lectura exclusivamente al microservicio `dian-signer`.
3. **Aislamiento en Memoria (Zero-Memory Buffer):** `dian-signer` descarga y descifra el certificado en memoria únicamente durante la operación de firma XAdES-EPES, sobreescribiendo el buffer de memoria con ceros inmediatamente después de firmar.

```sql
CREATE TABLE dian_certificates (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, serial_number)
);

ALTER TABLE dian_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dian_certificates FORCE ROW LEVEL SECURITY;

CREATE POLICY "dian_cert_tenant_isolation" ON dian_certificates
    FOR ALL TO authenticated
    USING (
        organization_id IN (SELECT auth.get_user_organizations())
        AND auth.get_user_role(organization_id) IN ('OWNER', 'ADMIN')
    );
```

---

## 8. AUDITORÍA INMUTABLE CRIPTOGRÁFICA (MERKLE HASH CHAINING ANTI-FORKING)

### 8.1 Serialización con `pg_advisory_xact_lock` (Patch 12)
Para garantizar no-repudio legal e impedir bifurcaciones en la cadena de bloques (`Audit Chain Forking`) ante transacciones concurrentes bajo el mismo tenant:
- La tabla `audit_logs` no permite `UPDATE`, `DELETE` ni `TRUNCATE`.
- Se adquiere un bloqueo transaccional de asesoría a nivel de tenant: `PERFORM pg_advisory_xact_lock(hashtext('audit_lock_' || v_org_id::text));`
- Cada registro computa su hash SHA-256 encadenado linealmente:
$$\text{Hash}_N = \text{SHA256}(\text{Hash}_{N-1} \,\|\, \text{org\_id} \,\|\, \text{table} \,\|\, \text{record\_id} \,\|\, \text{action} \,\|\, \text{old} \,\|\, \text{new} \,\|\, \text{user} \,\|\, \text{timestamp})$$

```sql
CREATE TABLE audit_logs (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_audit_org_table ON audit_logs(organization_id, table_name, record_id);
CREATE INDEX idx_audit_org_created ON audit_logs(organization_id, created_at DESC);

-- Prohibir mutación a todos los roles de base de datos
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_hash VARCHAR(64);
    v_calculated_hash VARCHAR(64);
    v_org_id UUID;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_changed JSONB := NULL;
    v_action VARCHAR(16);
    v_record_id UUID;
BEGIN
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
        SELECT jsonb_object_agg(n.key, n.value) INTO v_changed
        FROM jsonb_each(v_new) n
        WHERE v_old->n.key IS DISTINCT FROM n.value;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_record_id := OLD.id;
        v_org_id := OLD.organization_id;
        v_old := to_jsonb(OLD);
    END IF;

    -- BLOQUEO ADVISORY TRANSACCIONAL POR TENANT (ANTI-FORKING SERIALIZATION - Patch 12)
    PERFORM pg_advisory_xact_lock(hashtext('audit_lock_' || v_org_id::text));

    -- Obtener último hash confirmado de la organización
    SELECT hash INTO v_prev_hash
    FROM audit_logs
    WHERE organization_id = v_org_id
    ORDER BY sequence_number DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    -- Computar SHA-256 Hash Chain
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
        organization_id, table_name, record_id, action,
        old_data, new_data, changed_fields, user_id,
        prev_hash, hash, created_at
    ) VALUES (
        v_org_id, TG_TABLE_NAME, v_record_id, v_action,
        v_old, v_new, v_changed, auth.uid(),
        v_prev_hash, v_calculated_hash, clock_timestamp()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers en entidades clave
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION process_audit_log();
CREATE TRIGGER trg_audit_journal AFTER INSERT OR UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION process_audit_log();
CREATE TRIGGER trg_audit_credit_notes AFTER INSERT OR UPDATE OR DELETE ON credit_notes FOR EACH ROW EXECUTE FUNCTION process_audit_log();
```

---

## 9. RESILIENCIA DIAN, CIRCUIT BREAKER DISTRIBUIDO, RECONCILIACIÓN IN-DOUBT Y CONTINGENCIAS (TIPO 03 / 04)

### 9.1 Máquina de Estados Finita (FSM) con Reconciliación In-Doubt (Patch 1)

```
[ BORRADOR (DRAFT) ] ──(Aprobar y Emitir)──► [ EMITIDA_PENDIENTE_DIAN ]
                                                     │
                                                     ▼
                                             [ TRANSMITIENDO ]
                                                     │
                   ┌─────────────────────────────────┼────────────────────────────────┐
                   ▼                                 ▼                                ▼
           [ DIAN_ACEPTADA ]              [ TIMEOUT / ERROR 99 ]             [ DIAN_RECHAZADA ]
           (CUFE + QR Válido)                        │                       (Error Semántico)
                   │                                 ▼                                │
                   │                     ¿GetStatusZip(CUFE)=OK?                      ▼
                   │                     ├── SÍ: -> [ DIAN_ACEPTADA ]      [ Transacción Compensatoria ]
                   │                     └── NO: -> [ CONTINGENCIA_04 ]
                   ▼                                 │
          [ Entrega Cliente ]                        ▼
                                          [ Sync encola 48 Horas ]
```

### 9.2 Circuit Breaker Distribuido y Clasificación de Errores (Patch 9)
Respaldo en Redis / estado compartido multi-pod, con control estricto de **Sonda Canario Única** en estado `HALF_OPEN` y diferenciación entre errores de infraestructura (5xx / Timeout) vs validaciones de cliente (4xx):

```python
# /app/services/billing/services/distributed_circuit_breaker.py
import time
import logging
from enum import Enum
import httpx
from typing import Optional

logger = logging.getLogger("dian_resilience")

class CircuitState(str, Enum):
    CLOSED = "CLOSED"       # Operación normal con la DIAN
    OPEN = "OPEN"           # DIAN caída: fallback inmediato a Contingencia Tipo 04
    HALF_OPEN = "HALF_OPEN" # Sonda canario única de prueba

class DistributedDianCircuitBreaker:
    """
    Circuit Breaker distribuido respaldado por Redis / Atomic DB State.
    Protege contra caídas gubernamentales y clasifica errores estrictamente.
    """
    def __init__(
        self,
        redis_client,
        tenant_id: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        probe_timeout: int = 10
    ):
        self.redis = redis_client
        self.prefix = f"circuit:dian:{tenant_id}"
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.probe_timeout = probe_timeout

    def get_state(self) -> CircuitState:
        state = self.redis.get(f"{self.prefix}:state")
        if not state:
            return CircuitState.CLOSED
        return CircuitState(state.decode("utf-8") if isinstance(state, bytes) else state)

    def can_execute(self) -> bool:
        state = self.get_state()
        if state == CircuitState.CLOSED:
            return True

        if state == CircuitState.OPEN:
            last_trip = float(self.redis.get(f"{self.prefix}:last_trip") or 0)
            if time.time() - last_trip > self.recovery_timeout:
                # Adquisición atómica de la sonda canario única (Single Canary Probe)
                acquired = self.redis.set(
                    f"{self.prefix}:probe_lock", "1", nx=True, ex=self.probe_timeout
                )
                if acquired:
                    self.redis.set(f"{self.prefix}:state", CircuitState.HALF_OPEN.value)
                    logger.info("Circuit Breaker -> HALF_OPEN (Sonda Canario Adquirida)")
                    return True
            return False

        if state == CircuitState.HALF_OPEN:
            # Solo la sonda canario que retiene el lock puede ejecutar
            return bool(self.redis.get(f"{self.prefix}:probe_lock"))

        return False

    def record_success(self):
        pipe = self.redis.pipeline()
        pipe.set(f"{self.prefix}:state", CircuitState.CLOSED.value)
        pipe.delete(f"{self.prefix}:failures")
        pipe.delete(f"{self.prefix}:probe_lock")
        pipe.execute()
        logger.info("DIAN Servicio Restablecido. Circuit Breaker -> CLOSED.")

    def record_infrastructure_failure(self, error: Exception):
        """Invocada ÚNICAMENTE ante caídas de red, timeouts y HTTP 5xx"""
        logger.warning(f"Falla de infraestructura DIAN detectada: {type(error).__name__} - {error}")
        state = self.get_state()

        if state == CircuitState.HALF_OPEN:
            pipe = self.redis.pipeline()
            pipe.set(f"{self.prefix}:state", CircuitState.OPEN.value)
            pipe.set(f"{self.prefix}:last_trip", str(time.time()))
            pipe.delete(f"{self.prefix}:probe_lock")
            pipe.execute()
            logger.error("Sonda canario DIAN falló. Circuit Breaker -> OPEN.")
            return

        failures = self.redis.incr(f"{self.prefix}:failures")
        self.redis.expire(f"{self.prefix}:failures", 120)

        if failures >= self.failure_threshold:
            pipe = self.redis.pipeline()
            pipe.set(f"{self.prefix}:state", CircuitState.OPEN.value)
            pipe.set(f"{self.prefix}:last_trip", str(time.time()))
            pipe.execute()
            logger.error(f"Umbral de fallas superado ({failures}). Circuit Breaker -> OPEN (Activando Contingencia 04).")

    @staticmethod
    def is_infrastructure_error(exc: Exception) -> bool:
        """Distingue fallas de red/5xx de rechazos semánticos 4xx (RUT/Tarifa)"""
        if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError, httpx.NetworkError)):
            return True
        if isinstance(exc, httpx.HTTPStatusError):
            return exc.response.status_code >= 500
        return False
```

### 9.3 Marco Normativo de Contingencias: Tipo 04 vs Ingesta Tipo 03 (Patch 11)

| Tipo de Contingencia | Causa Legal | Prefijo y Numeración | Procedimiento Operativo | Formato UBL y Plazo Legal |
|---|---|---|---|---|
| **Tipo 04 (Contingencia DIAN)** | Indisponibilidad o timeouts en servidores DIAN (Circuit Breaker OPEN). | Prefijo Electrónico habitual (`FEV`). Numeración secuencial del ERP. | El sistema genera el PDF provisional con CUFE local y leyenda de contingencia. Se entrega al cliente de inmediato. El worker sincroniza en background. | XML UBL 2.1 estándar transmitido dentro de las **48 horas** post-normalización. |
| **Tipo 03 (Contingencia del Emisor)** | Falla eléctrica, caída del servidor ERP o sin internet en sede comercial. | Prefijo de Talonario Físico (`TC`). Numeración pre-impresa en talonario de papel. | Facturación física en papel talonario. Al restablecerse el sistema, se transcriben mediante endpoint batch dedicado (`/api/v1/invoices/contingency-03-ingestion`). | XML UBL 2.1 con `<cbc:InvoiceTypeCode>03</cbc:InvoiceTypeCode>` transmitido dentro de las **48 horas** legales. |

---

## 10. TAXONOMÍA "ZERO-ACCOUNTING JARGON" E INTERACCIÓN UI/UX

### 10.1 Matriz Universal de Traducción Terminológica

| Término Técnico Contable (PROHIBIDO en UI Operativa) | Etiqueta Aprobada en DigiKawsay UI | Explicación en Tooltip / Lenguaje Amigable | Mapeo Automático en Base de Datos / Asientos |
| :--- | :--- | :--- | :--- |
| **Asiento Contable / Comprobante** | **Registro de Actividad / Movimiento** | *"Registro histórico de una operación de tu negocio."* | `journal_entries` + `journal_lines` |
| **Débito / Debe** | **Entrada / Aumento de Fondos / Gasto** | *"Dinero que ingresa a tu caja o un gasto realizado."* | `debit > 0` |
| **Crédito / Haber** | **Salida / Origen de Fondos / Ingreso** | *"Dinero que sale de tu banco o venta realizada."* | `credit > 0` |
| **Código PUC (ej. 4135, 1435)** | **Categoría del Producto / Gasto** | *"Tipo de producto o servicio (ej. 'Alimentos', 'Asesoría')."* | `puc_accounts.code` mapeado por categoría |
| **Cuentas por Cobrar (1305)** | **Dinero por Cobrar / Clientes pendientes**| *"Facturas emitidas pendientes de pago por tus clientes."* | Cuenta `130505` |
| **Cuentas por Pagar (2205/2335)**| **Cuentas por Pagar / Facturas de Proveedor**| *"Compras o servicios recibidos pendientes de pago."* | Cuentas `220505` / `2335xx` |
| **Caja General (1105)** | **Efectivo en Caja / Caja Registradora**| *"Dinero en efectivo disponible en el punto de venta."* | Cuenta `110505` |
| **Bancos Nacionales (1110)** | **Cuenta Bancaria (Bancolombia, etc.)**| *"Tu cuenta corriente o de ahorros vinculada."* | Cuenta `111005xx` |
| **Retención en la Fuente (2365)** | **Anticipo de Impuesto Sugerido (Retefuente)**| *"Descuento legal según el monto de la compra/venta."* | Cuenta `2365xx` o `135515` |
| **ReteIVA (2367) / ReteICA (2368)**| **Retención de IVA / Retención de ICA** | *"Deducciones fiscales calculadas automáticamente."* | Cuentas `2367xx` / `2368xx` |
| **Conciliación Bancaria** | **Cruce y Verificación de Extracto** | *"Comparar movimientos del banco con tus ventas y gastos."*| `bank_reconciliations` engine |
| **Gravamen 4x1000 (511595)** | **Impuesto 4x1000 Bancario** | *"Impuesto automático descontado en retiros bancarios."* | Cuenta `511595` |
| **Partida Doble Descuadrada** | **Diferencia en Valores** | *"El total pagado no coincide con el total de la factura."* | Validación suma cero en Backend |
| **Cierre de Período Fiscal** | **Cierre y Bloqueo de Mes / Año** | *"Congelar los registros para proteger la contabilidad."* | Bloqueo + Traslado `3605`/`3610` |

---

## 11. MATRIZ DE IN-CONTEXT ACTION CARDS

```
+--------------------------------------------------------------------------------------------------------------------+
| 1. DIAN API Timeout / Contingencia Tipo 04 Activa & Reconciliación en Cola                                         |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Ámbar [Modo Contingencia Tipo 04 Activo]                                                    |
| - Diagnóstico: "Los servidores de la DIAN están tardando en responder. Tu venta #FV-1045 quedó registrada legalmente|
|   y tu cliente ya tiene su comprobante provisional. El sistema verificará el estado con la DIAN automáticamente."  |
| - Acciones en 1 Clic:                                                                                              |
|   [ Continuar Facturando (Siguiente Venta) ]  [ Descargar PDF Provisional ]  [ Ver Monitor de Transmisión ]       |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 2. Proveedor en Régimen Simple de Tributación (RST) - Exoneración Art. 911 E.T.                                    |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Verde [Proveedor Régimen Simple Identificado]                                               |
| - Diagnóstico: "Este proveedor está registrado en el Régimen Simple. Por ley (Art. 911 E.T.), NO se le debe       |
|   practicar Retención en la Fuente ni ReteICA. El sistema ajustó las retenciones a $0 automáticamente."            |
| - Acciones en 1 Clic:                                                                                              |
|   [ Aceptar y Continuar Compra ]  [ Ver Ficha del Proveedor ]  [ Consultar Normativa ]                             |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 3. Liquidación Agrupada de Pasarela (Bold / Wompi / Datáfono N:1)                                                  |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Azul [Depósito de Pasarela Detectado: +$1.928.600 COP]                                      |
| - Diagnóstico: "Encontramos 1 depósito en Bancolombia que agrupa 20 ventas con datáfono ($2.000.000 COP) menos      |
|   comisiones y retenciones ($71.400 COP)."                                                                         |
| - Acciones en 1 Clic:                                                                                              |
|   [ Conciliar Lote (20 Ventas + Gasto Comisión 530515) en 1 Clic ]  [ Desglosar Ventas ]  [ Omitir ]               |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 4. Descuadre en Conteo Físico / Sincronización POS Offline con Sobregiro Transitorio                              |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Amarillo [Sincronización Offline: Saldo Negativo Transitorio -2 unidades de 'Café 500g']    |
| - Diagnóstico: "Se recibieron ventas offline emitidas durante la pérdida de conexión. El stock actual quedó en -2."|
| - Acciones en 1 Clic:                                                                                              |
|   [ Iniciar Conteo Físico de Emergencia ]  [ Registrar Ajuste por Faltante/Compra ]  [ Ignorar Advertencia ]       |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 5. Modo Sin Conexión (POS Offline Activo con Rango Arrendado)                                                      |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Naranja Pulsante [Trabajando Sin Conexión - Bloque POS-1: 1001-1100]                        |
| - Diagnóstico: "Sin conexión a internet. Facturando con bloque reservado seguro. Cero riesgo de duplicidad."        |
| - Acciones en 1 Clic:                                                                                              |
|   [ Continuar Facturando ]  [ Ver Ventas en Cola Local (4) ]  [ Forzar Reconexión ]                                |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 6. Transcripción de Facturas Físicas de Talonario (Contingencia Tipo 03 - TC)                                      |
+--------------------------------------------------------------------------------------------------------------------+
| - Estado Visual: Badge Púrpura [Módulo de Ingesta Talonario de Papel]                                              |
| - Diagnóstico: "Transcribe las facturas físicas emitidas durante la falla de energía para transmitirlas a la DIAN  |
|   dentro del plazo legal de 48 horas."                                                                             |
| - Acciones en 1 Clic:                                                                                              |
|   [ Iniciar Lote de Transcripción TC ]  [ Ver Resolución de Talonario ]  [ Validar Rango Emitido ]                 |
+--------------------------------------------------------------------------------------------------------------------+
```

---

## 12. BLUEPRINTS DETALLADOS DE LOS CORE USER JOURNEYS

### 12.1 Journey 1: Fast POS & Offline Chunk Leasing (Patch 5)
- **Latencia Objetivo:** Menos de 1.5s por escaneo y menos de 3s para cobro e impresión.
- **Arriendo de Consecutivos:** Cada terminal solicita al iniciar sesión un bloque (ej. 100 consecutivos) de `pos_consecutive_leases`.
- **Atajos de Teclado Universales:**
  - `F2` o `/` : Búsqueda rápida de producto por nombre o código.
  - `F3` : Seleccionar o crear cliente rápido (Default: "Consumidor Final").
  - `F4` : Aplicar descuento comercial (sin alterar el costo de reposición).
  - `F7` : Pausar venta actual ("Poner en espera") y recuperar ventas en espera.
  - `F8` o `Espacio` : Abrir pantalla de Cobro / Pago.
  - `F9` : Cobro exacto en Efectivo (1 solo toque para cerrar venta).
  - `F10` : Alternar entre "Ticket POS / Tirilla" y "Factura Electrónica DIAN".

### 12.2 Journey 2: Ciclo de Facturación Electrónica e Ingesta Contingencia 03 (Patch 11)
- **Visual Status Pills:** `Borrador` (Gris) -> `En Cola DIAN` (Azul) -> `Validada con CUFE` (Verde) -> `Contingencia Tipo 04` (Naranja) -> `Talonario TC` (Púrpura).
- **Ingesta de Talonario Tipo 03:** Endpoint especializado `POST /api/v1/invoices/contingency-03-ingestion` para transcribir ventas en papel físico emitidas con prefijo `TC`, registrando fecha histórica de emisión física y generando UBL Tipo 03.

### 12.3 Journey 3: Asistente Tributario Autónomo y Matriz de Regímenes (Patch 4)
- **Tabla Dinámica `tax_configurations`:** Mantiene el valor anual de la UVT (ej. 2024: $47.065 COP, 2025: $49.799 COP) y bases mínimas de retención (27 UVT para compras, 4 UVT para servicios).
- **Matriz de Compatibilidad Tributaria (Estatuto Tributario Art. 911):**
  - Si el proveedor es `REGIMEN_SIMPLE`: Exoneración 100% de Retefuente a título de renta y ReteICA.
  - Si el proveedor es `AUTORRETENEDOR` o `GRAN_CONTRIBUYENTE`: No se practica retención por compradores ordinarios.
  - Si el comprador es `NO_RESPONSABLE_IVA`: No practica retenciones en la fuente (Art. 368-2 E.T.).

### 12.4 Journey 4: Conciliación Dual-Pane con Liquidaciones Agrupadas (Patch 10 & Patch 4)
- **Conciliación N:1 de Pasarelas (Bold / Wompi / Datáfonos):** El reconciliador permite seleccionar 1 depósito bancario contra N recibos POS del día, reconociendo y contabilizando automáticamente la comisión MDR (530515) y retenciones asumidas.
- **Exención GMF 4x1000 (Art. 879 Numeral 1 E.T.):** Reconoce si la cuenta bancaria está marcada con `is_gmf_exempt = true` y aplica el tope mensual legal de 350 UVT antes de sugerir el registro de gasto bancario `511595`.

### 12.5 Journey 5: Toma Física de Inventario y Kardex Histórico Congelado (Patch 3)
- Conteo guiado con lector de código de barras.
- Desglose de diferencias físicas vs libros en unidades y valor monetario ($ COP).
- Ajuste de existencias registrando el costo histórico congelado (`unit_cost`) directamente en las líneas de movimiento.

---

## 13. FASES DETALLADAS DE IMPLEMENTACIÓN (0 A 8)

### FASE 0: PREPARACIÓN, MULTI-TENANT & INFRAESTRUCTURA TRANSACCIONAL (1-2 Días)
- [ ] 0.1 Crear tablas `organizations`, `organization_members` y `tax_configurations` con RLS forzado.
- [ ] 0.2 Crear tablas `outbox_events` (con índice de recuperación zombie), `dead_letter_events`, `idempotency_keys` y `payment_intents`.
- [ ] 0.3 Implementar trigger PostgreSQL de auditoría SHA-256 con advisory lock anti-forking (`process_audit_log`).
- [ ] 0.4 Crear función PL/pgSQL pesimista de consecutivos con timezone `America/Bogota` (`get_next_invoice_number_secure`).
- [ ] 0.5 Crear tabla `pos_consecutive_leases` para soporte de rangos offline.

---

### FASE 1: MICROSERVICIO DE CONTABILIDAD Y LIBRO MAYOR AUTÓNOMO (3-5 Días)
- [ ] 1.1 Modelos PUC, Terceros, Asientos Append-Only y Rollups mensuales en FastAPI (Puerto 8002).
- [ ] 1.2 Endpoints de consulta y balance de comprobación:
```
GET    /api/v1/puc/accounts
POST   /api/v1/puc/accounts
GET    /api/v1/third-parties
POST   /api/v1/third-parties
GET    /api/v1/journal/entries
POST   /api/v1/journal/entries
GET    /api/v1/reports/trial-balance
GET    /api/v1/reports/income-statement
GET    /api/v1/reports/balance-sheet
```

---

### FASE 2: MICROSERVICIO DE FACTURACIÓN, INVENTARIO & DIAN RESILIENTE (5-7 Días)
- [ ] 2.1 Facturación en 2 fases con Claim-and-Commit en Outbox Worker (Puerto 8003).
- [ ] 2.2 Reconciliador In-Doubt con `GetStatus` / `GetStatusZip` previo a reintentos o compensaciones.
- [ ] 2.3 Circuit Breaker Distribuido respaldado en Redis con Sonda Canario Única y clasificación de errores (5xx vs 4xx).
- [ ] 2.4 Matriz de Notas Crédito por Código de Concepto y congelamiento de `unit_cost` en `invoice_lines`.
- [ ] 2.5 Ingesta de Contingencia Tipo 03 (Talonario `TC` con UBL 03).
```
GET    /api/v1/invoices
POST   /api/v1/invoices
POST   /api/v1/invoices/contingency-03-ingestion
POST   /api/v1/credit-notes
GET    /api/v1/inventory/items
POST   /api/v1/inventory/items
POST   /api/v1/inventory/adjustments
POST   /api/v1/pos/lease-consecutives
POST   /api/v1/dian/resolutions
```

---

### FASE 3: MICROSERVICIO DE TESORERÍA, PASARELAS & CONCILIACIÓN DUAL-PANE (3-4 Días)
- [ ] 3.1 Two-Phase PaymentIntents FSM con auto-reversos automáticos (Puerto 8004).
- [ ] 3.2 Gateway Settlement Matcher (N:1 para Bold/Wompi) y Exención GMF 4x1000 (350 UVT).
```
GET    /api/v1/banks
POST   /api/v1/banks
POST   /api/v1/payment-intents
POST   /api/v1/payment-intents/{id}/capture
POST   /api/v1/payment-intents/{id}/auto-reversal
POST   /api/v1/banks/{id}/reconciliation/settlements
GET    /api/v1/cash-flow
```

---

### FASE 4: MICROSERVICIO DE NÓMINA ELECTRÓNICA DIAN (5-7 Días)
- [ ] 4.1 Liquidación laboral colombiana (Cesantías, Prima, Vacaciones, PILA) y UBL Nómina Electrónica (Puerto 8005).

---

### FASE 5: GESTIÓN DE CARTERA Y CUENTAS POR PAGAR (2-3 Días)
- [ ] 5.1 Edades de cartera automáticas y castigo de cartera incobrable.

---

### FASE 6: INFORMES FISCALES Y MEDIOS MAGNÉTICOS EXÓGENA DIAN (3-4 Días)
- [ ] 6.1 Generación de Formatos 1001, 1003, 1005, 1007, 1008, 1009, Formulario 300 (IVA) y 350 (Retenciones).

---

### FASE 7: CIERRE CONTABLE Y TRASLADO DE EJERCICIO (2-3 Días)
- [ ] 7.1 Bloqueo de períodos y traslado automático a cuentas 3605/3610.

---

### FASE 8: FRONTEND NEXT.JS 15, ZERO-JARGON UX & POS OFFLINE (3-5 Días)
- [ ] 8.1 Vistas y componentes UI con Action Cards en 1 clic y conmutador Auditor Lens.

---

## 14. CONSOLIDADO DDL DE BASE DE DATOS POSTGRESQL

```sql
-- ============================================================================
-- ESQUEMA CONSOLIDADO DIGIKAWSAY ERP (BLINDADO ADVERSARIALMENTE)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CONFIGURACIÓN TRIBUTARIA DINÁMICA (UVT ANUAL - Patch 4)
CREATE TABLE tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL UNIQUE,
    uvt_value_cop NUMERIC(10,2) NOT NULL,
    compras_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 27.0,
    servicios_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 4.0,
    gmf_exemption_monthly_uvt NUMERIC(6,2) NOT NULL DEFAULT 350.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. ORGANIZACIONES Y MEMBRESÍAS (Ver Sección 3.1)
-- 3. INFRAESTRUCTURA TRANSACCIONAL (outbox_events, dead_letter_events, idempotency_keys, payment_intents - Ver Sección 4.2)
-- 4. AUDITORÍA INMUTABLE (audit_logs y trigger - Ver Sección 8.1)

-- 5. PLAN ÚNICO DE CUENTAS (PUC)
CREATE TABLE puc_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(200) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'ORDEN')),
    nature VARCHAR(10) NOT NULL CHECK (nature IN ('DEBITO', 'CREDITO')),
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    parent_code VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_third_party BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, code)
);

-- 6. TERCEROS (CLIENTES, PROVEEDORES, EMPLEADOS)
CREATE TABLE third_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    identification_type VARCHAR(10) NOT NULL CHECK (identification_type IN ('CC', 'NIT', 'CE', 'PASAPORTE', 'TI')),
    identification_number VARCHAR(20) NOT NULL,
    dv VARCHAR(1),
    is_company BOOLEAN NOT NULL DEFAULT false,
    business_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    commercial_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city_code VARCHAR(10), -- Código DANE Municipio
    tax_regime VARCHAR(50) NOT NULL DEFAULT 'NO_RESPONSABLE_IVA'
        CHECK (tax_regime IN ('RESPONSABLE_IVA', 'NO_RESPONSABLE_IVA', 'REGIMEN_SIMPLE', 'GRAN_CONTRIBUYENTE', 'AUTORRETENEDOR')),
    is_customer BOOLEAN NOT NULL DEFAULT true,
    is_supplier BOOLEAN NOT NULL DEFAULT false,
    is_employee BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, identification_type, identification_number)
);

-- 7. BODEGAS E INVENTARIOS
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, code)
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
    sale_price NUMERIC(20,2) NOT NULL DEFAULT 0,
    current_cost NUMERIC(20,2) NOT NULL DEFAULT 0, -- Promedio ponderado dinámico
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 19.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, sku)
);

CREATE INDEX idx_inv_items_barcode ON inventory_items(organization_id, barcode);

-- 8. RESOLUCIONES DIAN (Con Unicidad Corregida para Renovaciones - Patch 6)
CREATE TABLE dian_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    resolution_number VARCHAR(50) NOT NULL,
    resolution_date DATE NOT NULL,
    prefix VARCHAR(10) NOT NULL DEFAULT '',
    range_from INTEGER NOT NULL,
    range_to INTEGER NOT NULL,
    current_number INTEGER NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    technical_key_encrypted TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_dian_resolutions_prefix_number UNIQUE (organization_id, prefix, resolution_number)
);

CREATE UNIQUE INDEX idx_active_dian_res ON dian_resolutions(organization_id, prefix) WHERE is_active = true;

-- 9. FACTURAS Y LÍNEAS CON COSTO HISTÓRICO CONGELADO (Patch 3 & Patch 11)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    prefix VARCHAR(10) NOT NULL DEFAULT '',
    number INTEGER NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('VENTA', 'COMPRA', 'CONTINGENCIA_03', 'DOCUMENTO_SOPORTE', 'POS')),
    date DATE NOT NULL,
    due_date DATE,
    physical_issued_at TIMESTAMPTZ, -- Fecha histórica para Contingencia Tipo 03 (TC)
    third_party_id UUID NOT NULL REFERENCES third_parties(id) ON DELETE RESTRICT,
    
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
    
    state VARCHAR(30) NOT NULL DEFAULT 'DRAFT' 
        CHECK (state IN ('DRAFT', 'APPROVED', 'SENT', 'PAID', 'CANCELLED', 'REJECTED_DIAN_VOIDED')),
    journal_entry_id UUID,
    
    dian_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SENT' 
        CHECK (dian_status IN ('NOT_SENT', 'ISSUED_PENDING_DIAN', 'TRANSMITTING', 'DIAN_ACCEPTED', 'DIAN_REJECTED', 'CONTINGENCY_04', 'ERROR_DLQ')),
    cufe VARCHAR(96),
    qr_content TEXT,
    xml_signed_url TEXT,
    dian_response JSONB,
    dian_retry_count INTEGER NOT NULL DEFAULT 0,
    is_offline_sync BOOLEAN NOT NULL DEFAULT false,
    
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, prefix, number)
);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'UN',
    unit_price NUMERIC(20,2) NOT NULL,
    unit_cost NUMERIC(20,2) NOT NULL DEFAULT 0,      -- Costo histórico congelado (Patch 3)
    cogs_amount NUMERIC(20,2) NOT NULL DEFAULT 0,    -- quantity * unit_cost
    discount_rate NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(20,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 19,
    tax_amount NUMERIC(20,2) DEFAULT 0,
    subtotal NUMERIC(20,2) NOT NULL,
    total NUMERIC(20,2) NOT NULL
);

-- 10. ASIENTOS CONTABLES (journal_entries & journal_lines)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    entry_number INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    concept TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT', 'PAYROLL', 'ADJUSTMENT', 'CLOSING', 'COMPENSATING_REVERSAL'
    source_id UUID,
    parent_entry_id UUID REFERENCES journal_entries(id), -- Referencia a asiento original en contrasientos
    state VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (state IN ('DRAFT', 'POSTED', 'VOIDED')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, entry_number)
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),
    third_party_id UUID REFERENCES third_parties(id),
    description TEXT,
    debit NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    base_amount NUMERIC(20,2) DEFAULT 0,
    CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0)
);

-- 11. CUENTAS BANCARIAS CON EXENCIÓN 4x1000 (Patch 10 & 4)
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    bank_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('AHORROS', 'CORRIENTE')),
    account_number_encrypted TEXT NOT NULL,
    account_number_masked VARCHAR(20) NOT NULL,
    puc_account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),
    is_gmf_exempt BOOLEAN NOT NULL DEFAULT false, -- Exenta de 4x1000 (Art. 879 Num 1 E.T.)
    gmf_monthly_limit_uvt NUMERIC(6,2) NOT NULL DEFAULT 350.0,
    current_balance NUMERIC(20,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 12. NOTAS CRÉDITO (Ver Sección 6.2)
-- 13. POS LEASED RANGES (Ver Sección 5.2)
-- 14. BALANCES MENSUALES (Ver Sección 5.4)
```

---

## 15. PLAN DE TESTING, PENETRACIÓN Y SIMULACIÓN DE FALLOS ADVERSARIALES

### 15.1 Matriz Exhaustiva de Pruebas de Estrés y Simulación Adversarial

| ID Test | Escenario Adversarial | Simulación Técnica | Criterio de Aceptación Incondicional |
|:---:|---|---|---|
| **T-01** | **DIAN Mid-Flight Drop (In-Doubt State)** | Mock intercepta llamada tras envío y retorna socket reset. Reintento retorna error 99. | Worker invoca `GetStatusZip(CUFE)`. Al confirmar recepción DIAN, actualiza a `DIAN_ACCEPTED`. **CERO rollback ni contrasiento**. |
| **T-02** | **Outbox Worker Zombie Recovery** | Worker marca 5 eventos como `PROCESSING` y sufre `kill -9`. Expira `locked_until`. | Nuevo worker recupera los 5 eventos huérfanos gracias a `locked_until < clock_timestamp()`. Ningún evento se pierde. |
| **T-03** | **Credit Note Concept 3 (Descuento)** | Emisión de Nota Crédito por Descuento Comercial ($100.000 COP) sobre factura previa. | Registro contable debita 4175 e IVA. **CERO restock de inventario en Kardex**. Stock físico intacto. |
| **T-04** | **Kardex Frozen Cost Reversal** | Compra altera costo promedio de $10.000 a $14.000. Se anula venta original efectuada a $10.000. | Contrasiento y restock usan estrictamente el `$10.000` histórico de `invoice_lines`. Descuadre en libro mayor = $0. |
| **T-05** | **Régimen Simple Retenciones (Art. 911 E.T.)** | Compra por $5.000.000 a proveedor registrado con `tax_regime = 'REGIMEN_SIMPLE'`. | Sistema calcula Retefuente = $0 y ReteICA = $0. Cumplimiento legal estricto. |
| **T-06** | **POS Offline Range Chunk Sync** | 2 terminales emiten 50 ventas cada una sin conexión dentro de sus bloques arrendados. | Al sincronizar, se insertan 100 facturas sin colisiones de clave única `UNIQUE(prefix, number)`. |
| **T-07** | **DIAN Resolution Renewal** | Inserción de nueva resolución con el mismo prefijo `FE` para nuevo rango. | Inserción exitosa gracias a `UNIQUE(organization_id, prefix, resolution_number)`. |
| **T-08** | **Timezone 7:00 PM Colombia Boundary** | Servidor UTC a las 00:30 (7:30 PM en Bogotá) en fecha límite de resolución. | `get_next_invoice_number_secure` evalúa `America/Bogota` y autoriza la emisión legal sin error P0002. |
| **T-09** | **Pool Connection Non-Exhaustion** | 20 peticiones a DIAN con latencia inducida de 35 segundos. | Outbox worker hace commit de reclamo en <5ms; cero conexiones retenidas durante la espera HTTP. |
| **T-10** | **Distributed Circuit Breaker & 4xx** | 10 peticiones con error semántico de NIT cliente (400 Bad Request). | Circuit Breaker permanece `CLOSED`. Errores 4xx no disparan falsamente contingencia. |
| **T-11** | **PaymentIntent Local Rollback Reversal** | Cobro con tarjeta exitoso en pasarela simulada seguido de aborto por stock en BD. | Handler de rescate ejecuta `void` en pasarela de inmediato. Cero cobros huérfanos. |
| **T-12** | **Merkle Hash Chain Concurrency** | 50 inserciones simultáneas en la misma organización mediante Locust/k6. | `pg_advisory_xact_lock` serializa la cadena; cero forks de hash. Verificación SHA-256 100% lineal. |

---

## 16. CRONOGRAMA, CHECKLIST DE PRODUCCIÓN Y PRÓXIMOS PASOS

### 16.1 Cronograma de Ejecución (8 Semanas)

```
Semana 1: FASE 0 - Multi-Tenant RLS, Tax Configurations, Outbox DDL, Merkle Locks, Vault
Semana 2: FASE 1 - Microservicio Contable, PUC Abstraído, Libro Mayor Append-Only, Balances
Semana 3: FASE 2A - Facturación POS, Leased Range Chunks, Stock Atómico con Check >= 0
Semana 4: FASE 2B - Integración DIAN (Signer XAdES, Claim-and-Commit, GetStatus, Circuit Breaker)
Semana 5: FASE 3 - Tesorería, PaymentIntents FSM, Auto-Reversals y Conciliación N:1
Semana 6: FASE 4 - Nómina Electrónica NIIF/DIAN y Liquidación Laboral
Semana 7: FASE 5 & 6 - Cartera, Cierre Fiscal y Formatos Exógena DIAN
Semana 8: FASE 7 & 8 - Frontend Next.js Zero-Jargon, Action Cards UI y Pruebas E2E
```

### 16.2 Checklist de Salida a Producción Blindada
- [ ] Todas las tablas tienen `organization_id` y `FORCE ROW LEVEL SECURITY` activo.
- [ ] Matriz de UVT dinámico (`tax_configurations`) y reglas de exoneración Art. 911 E.T. validadas.
- [ ] Certificados `.p12` y contraseñas DIAN custodiados en Supabase Vault / KMS (cero texto plano).
- [ ] Triggers de auditoría SHA-256 con `pg_advisory_xact_lock` activos en todas las entidades clave.
- [ ] Worker Outbox procesando con Claim-and-Commit de 2 pasos y recuperación de eventos zombie.
- [ ] Protocolo de reconciliación In-Doubt (`GetStatusZip`) probado ante caídas simuladas.
- [ ] Circuit Breaker Distribuido respaldado en Redis con Sonda Canario Única y clasificación de errores.
- [ ] FSM de `payment_intents` con reverso automático ante fallas de base de datos verificado.
- [ ] Pipeline de transcripción de talonarios físicos Tipo 03 (`TC`) operativo.
- [ ] Matriz de conceptos de Notas Crédito validada (Concepto 3 con CERO restock y costo congelado).
- [ ] Balance de prueba verificado contra los archivos Excel históricos de respaldo en `Contabilidad/Backup`.

---
*Documento maestro aprobado por el Equipo de Arquitectura de Sistemas, UX, Seguridad y Cumplimiento Tributario DigiKawsay.*
