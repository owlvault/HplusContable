# 🏛️ Evaluación Exhaustiva de Arquitectura Backend, Esquemas de Base de Datos e Integridad Transaccional

**Documento Objetivo**: `IMPLEMENTATION_PLAN.md`  
**Autor**: Senior Backend & Database Architect (`explorer_backend_1`)  
**Fecha**: 2026-08-17  
**Estado**: Completado / Propuesta de Refinamiento Arquitectónico  

---

## Executive Summary

El plan de implementación original (`IMPLEMENTATION_PLAN.md`) plantea una transición desde la arquitectura monolítica actual basada en Server Actions de Next.js hacia una constelación de microservicios en FastAPI (Contabilidad, Facturación, Tesorería, Nómina, etc.) conectados mediante Supabase y Redis/RabbitMQ.

Si bien la modularización de dominios de negocio es deseable, el plan actual presenta **fallas críticas de integridad transaccional, concurrencia y resiliencia** que pondrían en grave riesgo la operación en producción de un ERP contable bajo normativa colombiana (DIAN):
1. **Ausencia de Fronteras Transaccionales Claras y Falacia de 2PC en Microservicios**: Operaciones multi-paso críticas (Venta -> Reserva Stock -> Facturación Electrónica -> Asiento Contable -> DIAN -> Cartera -> Recibo de Caja) se describen como llamadas HTTP asiladas sin un patrón de orquestación Saga ni manejo de transacciones compensatorias.
2. **Vulnerabilidad a Race Conditions en Concurrencia**: Asignación de consecutivos de facturación, actualización de saldos contables y deducción de stock carecen de bloqueos pesimistas (`SELECT ... FOR UPDATE`), mecanismos atómicos condicionales y control de idempotencia empresarial (`idempotency_key`).
3. **Acoplamiento Síncrono con la DIAN y Riesgo de Caída en Cascada**: No existe una arquitectura de *Transactional Outbox* en PostgreSQL para desacoplar la emisión interna de la transmisión externa a la DIAN. Una indisponibilidad o latencia en los Web Services de la DIAN bloquearía las transacciones de base de datos del ERP, agotando los pools de conexiones.
4. **Ilegalidad Fiscal en Flujos de Anulación**: La anulación en el plan actual muta el estado a `CANCELLED` en la tabla `invoices`. Para documentos aprobados por la DIAN, esto viola el Estatuto Tributario colombiano (Decreto 358 de 2020 y Resolución 000042/000165), el cual exige estrictamente la emisión de **Notas Crédito Electrónicas** con CUDE y trazabilidad al CUFE original.

A continuación se presenta el diagnóstico exhaustivo, los esquemas de base de datos complementarios (DDL), diagramas de secuencia transaccional, políticas de reintento/DLQ y las modificaciones concretas para enriquecer `IMPLEMENTATION_PLAN.md`.

---

## 1. Multi-Step Transaction Boundaries & Rollback / Saga Mechanisms

### 1.1 Ciclo de Vida del Flujo Comercial y Contable Completo

El flujo integral de una venta en DigiKawsay atraviesa seis etapas que combinan transacciones ACID locales y orquestación asíncrona basada en eventos:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FASE 1: TRANSACCIÓN ACID LOCAL                                 │
│                                                                                                  │
│  [Aprobación Factura]                                                                            │
│         │                                                                                        │
│         ▼                                                                                        │
│  [1. Lock Invoice & Consecutivo] ──► [2. Deducción Atómica Stock] ──► [3. Post Asiento Contable] │
│                                                                                │                 │
│                                                                                ▼                 │
│  [Commit DB] ◄── [6. Insert Outbox Event] ◄── [5. Cambio Estado] ◄── [4. Creación Cartera]       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼ (Asíncrono vía Worker)
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FASE 2: ORQUESTACIÓN SAGA (DIAN)                              │
│                                                                                                  │
│  [Worker lee Outbox] ──► [Genera XML UBL 2.1 + Firma X.509] ──► [Calcula CUFE]                  │
│                                                                        │                         │
│                                                                        ▼                         │
│                                                              [Llamada Web Service DIAN]          │
│                                                                        │                         │
│                      ┌─────────────────────────────────────────────────┴─────────────┐           │
│                      ▼                                                               ▼           │
│             [Respuesta: ACEPTADA]                                            [Respuesta: RECHAZO]│
│                      │                                                               │           │
│                      ▼                                                               ▼           │
│         [Actualiza CUFE, QR,                                            [Transacción             │
│          Estado SENT_DIAN]                                               Compensatoria]          │
│                      │                                                               │           │
│                      ▼                                                               ▼           │
│         [Outbox: Email Dispatch]                                        [Contrasiento +          │
│                                                                          Restock + Anular CxC]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fronteras Transaccionales Exactas (ACID vs. Saga / Outbox)

#### Frontera 1: Transacción ACID Local (Invoice Approval & Ledger Commitment)
Debe ejecutarse en una **única transacción de base de datos** (PostgreSQL / PL/pgSQL RPC):
- **Aislamiento**: `READ COMMITTED` con bloqueos explícitos `SELECT ... FOR UPDATE` sobre la fila de la factura y `inventory_levels`.
- **Acciones atómicas**:
  1. Validar que `invoices.state = 'DRAFT'`.
  2. Asignar el consecutivo autorizado de la resolución DIAN mediante `document_sequences` con bloqueo atómico.
  3. Descontar inventario físico y liberar reserva:
     ```sql
     UPDATE inventory_levels
     SET available_quantity = available_quantity - line.quantity,
         reserved_quantity = GREATEST(0, reserved_quantity - line.quantity),
         updated_at = clock_timestamp()
     WHERE product_id = line.product_id
       AND available_quantity >= line.quantity;
     ```
     Si alguna línea no tiene existencias, la transacción hace `ROLLBACK` completo.
  4. Generar asiento contable de costo de ventas:
     - **Débito**: `6135xx` (Costo de Ventas)
     - **Crédito**: `1435xx` (Mercancías no Fabricadas por la Empresa)
  5. Generar asiento contable de facturación comercial:
     - **Débito**: `130505` (Clientes Nacionales) = `Total - Retenciones`
     - **Débito**: `135515` (Anticipo ReteFuente), `135517` (ReteIVA), `135518` (ReteICA)
     - **Crédito**: `4135xx` (Ingresos Operacionales) = `Subtotal - Descuento`
     - **Crédito**: `240805` / `240810` (IVA Generado 19% / 5%)
     - **Crédito**: `280505` (Anticipos de Clientes amortizados, si aplica)
  6. Validar partida doble estricta en el motor de base de datos: `|SUM(debit) - SUM(credit)| < 0.01`.
  7. Insertar registro en `receivables` con saldo inicial, fecha de vencimiento y términos comerciales.
  8. Cambiar estado de la factura: `invoices.state = 'APPROVED'`, `invoices.dian_status = 'PENDING'`.
  9. Insertar evento en `outbox_events` con tópico `dian.invoice.dispatch` y payload completo.
  10. `COMMIT WORK`.

> **Regla de Oro Arquitectónica**: **NUNCA** realizar la llamada HTTP a la DIAN dentro de la transacción de base de datos. Hacerlo agotaría el pool de conexiones de PostgreSQL (PgBouncer/Supabase), provocaría bloqueos prolongados y dejaría transacciones en limbo ante timeouts de red.

#### Frontera 2: Transacción de Pago / Recibo de Caja (Payment Execution)
Debe ejecutarse en una transacción ACID local separada:
- **Acciones atómicas**:
  1. `SELECT * FROM receivables WHERE id = :id FOR UPDATE;`
  2. Verificar que `amount <= balance`.
  3. `UPDATE receivables SET paid_amount = paid_amount + :amount, balance = balance - :amount, status = CASE WHEN balance - :amount = 0 THEN 'PAID' ELSE 'PARTIAL' END WHERE id = :id;`
  4. `UPDATE bank_accounts SET current_balance = current_balance + :amount WHERE id = :bank_id;`
  5. Insertar `bank_movements` vinculando el `payment_id`.
  6. Insertar `journal_entries` + `journal_lines`:
     - **Débito**: `111005` (Bancos) = `:amount`
     - **Crédito**: `130505` (Clientes Nacionales) = `:amount`
  7. Insertar `receivable_payments` con `idempotency_key`.
  8. `COMMIT WORK`.

---

### 1.3 Transacciones Compensatorias (Saga Rollbacks & Anulaciones Fiscales)

#### Escenario A: Rechazo Permanente de la DIAN (Error de Validación / CUFE Inválido / Regla de Negocio DIAN)
Si el worker de la DIAN recibe un código de rechazo irrecuperable (ej. Rechazo 99 de la DIAN, NIT no registrado o resolución expirada):
1. **No se debe eliminar el registro físico** de la factura (para conservar la auditoría del consecutivo).
2. Se ejecuta la **Transacción Compensatoria**:
   - **Contrasiento Contable (Asiento de Reversión Automático)**:
     Crea un nuevo `journal_entry` con tipo `REVERSION_ANULACION` que invierte exactamente cada débito y crédito del asiento original, referenciando `parent_entry_id`.
   - **Restock de Inventario**:
     Incrementa `available_quantity` en `inventory_levels` y genera asiento de reversión de costo (Débito 1435, Crédito 6135).
   - **Cancelación de Cuenta por Cobrar**:
     Marca `receivables.status = 'CANCELLED'`.
   - **Actualización de Factura**:
     Marca `invoices.state = 'REJECTED_DIAN_VOIDED'`, `invoices.dian_status = 'REJECTED'`, registrando `rejection_reason` y la respuesta cruda de la DIAN en `dian_response`.
   - **Notificación al Usuario**:
     Envía alerta inmediata vía WebSocket a la UI del facturador mediante una *Action Card* ("Factura Rechazada por DIAN: [Motivo] - Asiento contable e inventario revertidos automáticamente").

#### Escenario B: Anulación Posterior a la Aprobación DIAN (Notas Crédito Electrónicas)
Una vez que la factura tiene `dian_status = 'ACCEPTED'`, la ley colombiana prohíbe taxativamente su anulación directa o eliminación. El único mecanismo legal es la emisión de una **Nota Crédito Electrónica (NC)**:
1. Se crea un documento `credit_notes` vinculado a `invoices.id` con:
   - Tipo de Nota Crédito DIAN (Código 1: Devolución parcial, Código 2: Anulación de factura electrónica, Código 3: Rebaja o descuento parcial).
   - Consecutivo propio autorizado por resolución DIAN para Notas Crédito (Prefijo `NC`).
2. Se genera el asiento contable de la Nota Crédito:
   - **Débito**: `4175xx` (Devoluciones en ventas) o débito directo a `4135xx`.
   - **Débito**: `240805` (IVA en devoluciones).
   - **Crédito**: `130505` (Clientes Nacionales).
   - **Crédito**: Reversión proporcional de retenciones (`135515`, `135517`, `135518`).
3. Reingreso a inventario (si aplica por devolución física de mercancía).
4. Actualización del saldo en `receivables` (se netea o cancela el saldo pendiente).
5. Se inserta evento en `outbox_events` con tópico `dian.credit_note.dispatch` para calcular CUDE y transmitir a la DIAN.

---

## 2. Concurrency & High Throughput Architecture

### 2.1 Concurrencia en Consecutivos de Facturación

**El Problema**: Con múltiples usuarios facturando en simultáneo o múltiples cajas/sucursales, consultas ingenuas tipo `SELECT MAX(number) + 1` generan colisiones en la restricción `UNIQUE(prefix, number)`, provocando abortos masivos de transacciones y brechas de consecutivos prohibidas por la DIAN.

**La Solución**: Asignación atómica de secuencias mediante PostgreSQL con validación de rango de resolución:

```sql
CREATE OR REPLACE FUNCTION get_next_invoice_number_secure(
    p_tenant_id UUID,
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
BEGIN
    -- Bloqueo pesimista exclusivo sobre la fila de la resolución activa
    SELECT id, range_from, range_to, current_number, valid_until
    INTO v_res
    FROM dian_resolutions
    WHERE tenant_id = p_tenant_id
      AND prefix = p_prefix
      AND is_active = true
      AND valid_until >= CURRENT_DATE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una resolución DIAN activa y vigente para el prefijo %', p_prefix
            USING ERRCODE = 'P0002';
    END IF;

    -- Calcular siguiente número
    IF v_res.current_number IS NULL OR v_res.current_number < v_res.range_from THEN
        v_next := v_res.range_from;
    ELSE
        v_next := v_res.current_number + 1;
    END IF;

    -- Verificar si se agotó el rango
    IF v_next > v_res.range_to THEN
        RAISE EXCEPTION 'Rango de facturación agotado para el prefijo %. Máximo autorizado: %, Intento: %',
            p_prefix, v_res.range_to, v_next
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

---

### 2.2 Concurrencia en Libro Mayor y Balances Contables

**El Problema**: Si el sistema actualiza saldos acumulados de cuentas en tiempo real (ej. `UPDATE puc_accounts SET balance = balance + :val`), cuentas de alto tráfico como `111005` (Bancos) o `413505` (Comercio) sufren contención severa de bloqueos de fila (`Row-Level Lock Contention`), degradando el throughput general.

**La Solución Arquitectónica**: **Libro Mayor Inmutable Append-Only + Rollup Materializado Periódico**:
1. `journal_entries` y `journal_lines` son **estrictamente de solo inserción** (Insert-Only / Append-Only). Jamás se ejecuta `UPDATE` sobre líneas de asientos contabilizados.
2. Los reportes (Balance de Prueba, Estado de Resultados, Balance General) consultan:
   - Tabla de snapshots mensuales: `account_monthly_balances` (`year`, `month`, `account_code`, `initial_debit`, `initial_credit`, `period_debit`, `period_credit`, `final_balance`).
   - Movimientos del mes corriente calculados mediante agregación indexada.
3. Actualización de snapshots mediante **Advisory Locks** no bloqueantes de PostgreSQL:
   ```sql
   -- Evita que dos workers procesen el cierre/rollup del mismo periodo en paralelo
   IF pg_try_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || p_year::text || ':' || p_month::text)) THEN
       -- Ejecutar consolidación
   ELSE
       -- Proceso en ejecución por otro hilo, abortar o esperar
   END IF;
   ```

---

### 2.3 Deducción Atómica de Inventario (Anti-Overselling)

Para evitar sobreventa en compras simultáneas del mismo producto:
1. **Actualización Condicional Atómica**:
   ```sql
   UPDATE inventory_levels
   SET available_quantity = available_quantity - :qty,
       version = version + 1,
       updated_at = clock_timestamp()
   WHERE product_id = :product_id
     AND tenant_id = :tenant_id
     AND available_quantity >= :qty
   RETURNING available_quantity;
   ```
2. **Prevención de Deadlocks en Carritos Multi-Ítem**:
   Al bloquear múltiples productos en una misma transacción, el backend **debe ordenar los `product_id` en orden ascendente alfabético/numérico** antes de adquirir los locks. Esto elimina matemáticamente el riesgo de bloqueos cruzados (*AB-BA Deadlocks*).

---

### 2.4 Arquitectura de Idempotencia Empresarial (`idempotency_key`)

Para proteger los endpoints de mutación (`/api/v1/invoices`, `/api/v1/payments`, `/api/v1/journal/entries`) contra dobles clics del usuario, caídas de red intermedias o reintentos automáticos del frontend:

```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(128) NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- SHA-256 del payload serializado
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (tenant_id, key)
);

CREATE INDEX idx_idempotency_cleanup 
ON idempotency_keys(created_at) 
WHERE created_at < NOW() - INTERVAL '48 hours';
```

**Flujo del Middleware de Idempotencia**:
1. El cliente envía la cabecera `X-Idempotency-Key: <UUIDv4>`.
2. Se computa el hash SHA-256 del body de la petición: `hash = sha256(request_body)`.
3. Se intenta registrar la clave atómicamente:
   `INSERT INTO idempotency_keys (key, tenant_id, user_id, endpoint, request_hash, status) VALUES (...) ON CONFLICT (tenant_id, key) DO NOTHING;`
4. Si ya existía:
   - **Caso `COMPLETED`**: Si `request_hash` coincide exactamente, responder de inmediato con `response_code` y `response_body` cacheados sin tocar la base de datos de negocio. Si el hash difiere, rechazar con `422 Unprocessable Entity` ("Idempotency key mismatch with different payload").
   - **Caso `IN_PROGRESS`**: Si `locked_at > NOW() - INTERVAL '30 seconds'`, responder `409 Conflict` ("Operación en procesamiento"). Si el lock expiró, tomar posesión del lock.
5. Si no existía: Ejecutar la transacción de negocio, persistir la respuesta en `idempotency_keys` con estado `COMPLETED` y retornar.

---

## 3. Asynchronous Queueing, Resilient Workers & Outbox Pattern

### 3.1 Transactional Outbox Pattern en PostgreSQL

El problema del *Dual-Write* ocurre cuando un servicio guarda en base de datos y luego intenta enviar un mensaje a una cola externa (Redis/RabbitMQ/Kafka). Si la red falla entre ambos pasos, el sistema queda en un estado inconsistente irrecuperable.

El **Transactional Outbox Pattern** resuelve esto almacenando los eventos en la misma transacción ACID de PostgreSQL:

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT', 'PAYROLL', 'CREDIT_NOTE'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,    -- 'INVOICE_APPROVED', 'PAYMENT_RECEIVED', 'DIAN_DISPATCH_REQUESTED'
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DLQ')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    locked_by VARCHAR(100),
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending_events 
ON outbox_events(status, scheduled_for) 
WHERE status IN ('PENDING', 'FAILED');
```

**Patrón de Consumo de Alto Rendimiento (`SKIP LOCKED`)**:
Los workers en segundo plano consumen eventos concurrentemente sin bloquearse entre sí utilizando `FOR UPDATE SKIP LOCKED`:

```sql
WITH next_batch AS (
    SELECT id
    FROM outbox_events
    WHERE status IN ('PENDING', 'FAILED')
      AND retry_count < max_retries
      AND scheduled_for <= clock_timestamp()
      AND (locked_until IS NULL OR locked_until < clock_timestamp())
    ORDER BY scheduled_for ASC
    LIMIT 25
    FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events
SET status = 'PROCESSING',
    locked_by = :worker_instance_id,
    locked_until = clock_timestamp() + INTERVAL '3 minutes'
FROM next_batch
WHERE outbox_events.id = next_batch.id
RETURNING outbox_events.*;
```

---

### 3.2 Especialización de Workers y Políticas de Resiliencia

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OUTBOX EVENT PROCESSORS                          │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                 │                               │
          ▼                                 ▼                               ▼
┌──────────────────┐              ┌──────────────────┐            ┌──────────────────┐
│  DIAN DISPATCH   │              │  EMAIL DISPATCH  │            │  BANK STATEMENT  │
│     WORKER       │              │     WORKER       │            │  PARSER WORKER   │
└──────────────────┘              └──────────────────┘            └──────────────────┘
  - UBL 2.1 XML Sign                - Headless Chrome/PDF           - Memory-safe Chunking
  - CUFE SHA-384                    - ZIP Packaging (XML+PDF)       - Rule & ML Matcher
  - Circuit Breaker                 - Resend/SMTP Gateway           - Auto-reconciliation
  - Jittered Exponential            - Delivery Webhook              - Savepoint Isolations
    Backoff                           Tracking
```

#### A. DIAN Dispatch Worker
- **Estrategia de Reintentos con Exponential Backoff y Jitter**:
  $$Delay = \min(Delay_{max}, Delay_{base} \times 2^{retry\_count}) + \text{Uniform}(0, \text{jitter})$$
  - Intento 1: 30 segundos
  - Intento 2: 2 minutos
  - Intento 3: 8 minutos
  - Intento 4: 30 minutos
  - Intento 5: 2 horas
- **Circuit Breaker**:
  Si la DIAN responde con errores 5xx o timeouts en más de 5 llamadas consecutivas en una ventana de 60 segundos:
  - Estado `OPEN`: Se detienen las llamadas síncronas a la DIAN durante 5 minutos.
  - Se activa el modo **Contingencia DIAN (Tipo 03)**: El ERP continúa emitiendo facturas en contingencia para no detener la operación comercial del cliente, encolando la transmisión para cuando el servicio se restablezca.

#### B. Dead-Letter Queue (DLQ) & Operator Recovery
Si un evento alcanza `retry_count >= max_retries` o experimenta un error no recuperable (ej. certificado digital vencido):
1. El evento se mueve a la tabla `dead_letter_events`.
2. Se emite una alerta crítica a la consola del administrador/contador.
3. Se provee un endpoint de **Replay/Redrive Administrativo** (`POST /api/v1/admin/dlq/{id}/replay`): Permite corregir datos maestros (ej. Dígito de Verificación del cliente o contraseña del certificado) y reencolar el evento sin duplicar asientos ni perder la correlación original.

```sql
CREATE TABLE dead_letter_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_event_id UUID REFERENCES outbox_events(id),
    tenant_id UUID NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    stack_trace TEXT,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    replayed_at TIMESTAMPTZ,
    replayed_by UUID,
    resolution_notes TEXT
);
```

---

## 4. Esquemas de Base de Datos Complementarios (DDL Propuesto)

Para completar las omisiones críticas de `IMPLEMENTATION_PLAN.md`, se deben incorporar formalmente las siguientes tablas en la base de datos:

### 4.1 Módulo de Inventario y Control de Stock
```sql
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    cost_method VARCHAR(20) NOT NULL DEFAULT 'PROMEDIO_PONDERADO'
        CHECK (cost_method IN ('PROMEDIO_PONDERADO', 'PEPS', 'UEPS', 'ESTANDAR')),
    current_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
    asset_account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code), -- 1435
    cost_account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),  -- 6135
    revenue_account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),-- 4135
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(tenant_id, code)
);

CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    warehouse_id UUID, -- Opcional: multisede
    available_quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    reserved_quantity NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    version INTEGER NOT NULL DEFAULT 1, -- Optimistic Concurrency Control
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(tenant_id, product_id)
);

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES inventory_items(id),
    movement_type VARCHAR(30) NOT NULL 
        CHECK (movement_type IN ('SALE_DISPATCH', 'PURCHASE_ENTRY', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')),
    quantity NUMERIC(14,4) NOT NULL,
    unit_cost NUMERIC(20,4) NOT NULL,
    total_cost NUMERIC(20,2) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PURCHASE', 'CREDIT_NOTE', 'MANUAL'
    source_id UUID NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

### 4.2 Módulo de Notas Crédito y Débito Electrónicas (DIAN)
```sql
CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    prefix VARCHAR(10) NOT NULL,
    number INTEGER NOT NULL,
    dian_concept_code VARCHAR(5) NOT NULL, -- 1: Devolución parcial, 2: Anulación, 3: Rebaja
    date TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    third_party_id UUID NOT NULL REFERENCES third_parties(id),
    
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    discount NUMERIC(20,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    retention_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    
    cude VARCHAR(96),
    qr_code TEXT,
    dian_response JSONB,
    dian_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    journal_entry_id UUID REFERENCES journal_entries(id),
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(tenant_id, prefix, number)
);

CREATE TABLE credit_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(20,2) NOT NULL DEFAULT 0,
    total NUMERIC(20,2) NOT NULL DEFAULT 0,
    account_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code)
);
```

### 4.3 Snapshots de Balances Contables Mensuales
```sql
CREATE TABLE account_monthly_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
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
    UNIQUE(tenant_id, account_code, year, month)
);

CREATE INDEX idx_account_balances_lookup 
ON account_monthly_balances(tenant_id, year, month, account_code);
```

---

## 5. Propuesta Concreta de Refinamiento para `IMPLEMENTATION_PLAN.md`

Para consolidar estas mejoras en el documento oficial, se proponen las siguientes adiciones y ajustes estructurales:

### 5.1 En la Sección de Arquitectura:
- Reemplazar el diagrama ingenuo de microservicios por una **Arquitectura Modular Transaccional con Transactional Outbox**.
- Declarar formalmente el principio: *"El núcleo contable y de facturación opera bajo transacciones ACID locales acopladas a la tabla Outbox; la integración con DIAN, envíos de correo y conciliación bancaria operan como workers asíncronos desacoplados"*.

### 5.2 En Fase 0 (Preparación y Migraciones):
- Agregar la creación obligatoria de:
  - `outbox_events` y `dead_letter_events`.
  - `idempotency_keys`.
  - `inventory_items`, `inventory_levels` y `inventory_movements`.
  - `credit_notes` y `credit_note_lines`.
  - `account_monthly_balances`.
  - Función PL/pgSQL atómica de asignación de consecutivos con control de rango.

### 5.3 En Fase 1 (Microservicio de Contabilidad):
- Especificar que las operaciones de inserción en el libro diario son **Append-Only**.
- Incorporar control de concurrencia con *Advisory Locks* para los procesos de precierre y cierre contable mensual/anual.

### 5.4 En Fase 2 (Microservicio de Facturación & DIAN):
- Reescribir el flujo de aprobación de factura: la aprobación desencadena en una **sola transacción ACID** el lock de consecutivo, reserva/descuento de inventario, asiento contable, cuenta por cobrar y registro en Outbox.
- Reemplazar la anulación simple (`state = 'CANCELLED'`) por el **Flujo Legal de Notas Crédito Electrónicas** con generación de CUDE y contrasientos contables automáticos.
- Definir el worker de DIAN con política de reintentos exponencial con Jitter, Circuit Breaker y fallback a Facturación en Contingencia (Tipo 03).

### 5.5 En Fase 3 (Tesorería) y Fase 5 (Cartera):
- Implementar la verificación y actualización atómica de saldos en `receivables` / `payables` con `SELECT ... FOR UPDATE`.
- Incorporar `idempotency_key` en los pagos para prevenir cobros duplicados ante fallas de red.

---

## 6. Conclusión

La implementación de estas especificaciones transformará el plan de desarrollo de DigiKawsay en una arquitectura de grado empresarial, 100% conforme con las exigencias legales de la DIAN y matemáticamente protegida contra inconsistencias contables, condiciones de carrera y caídas en cascada por servicios externos.
