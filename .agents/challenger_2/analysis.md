# 🔬 INFORME DE DESAFÍO ADVERSARIAL DISTRIBUIDO (CHALLENGER REPORT)
## Evaluación de Concurrencia, Idempotencia, Resiliencia DIAN e Integridad Transaccional
**Documento Evaluado:** `IMPLEMENTATION_PLAN.md` (Plan Maestro DigiKawsay / CFO-AI)  
**Autor del Desafío:** Senior Distributed Systems Challenger (`challenger_2`)  
**Fecha de Evaluación:** 2026-08-17  
**Veredicto Final:** **`REQUEST_CHANGES` (CAMBIOS REQUERIDOS OBLIGATORIOS)**

---

## 📑 TABLA DE CONTENIDO
1. [Resumen Ejecutivo y Veredicto](#1-resumen-ejecutivo-y-veredicto)
2. [Dimensión 1: Concurrencia, Bloqueos y Condiciones de Carrera](#2-dimensión-1-concurrencia-bloqueos-y-condiciones-de-carrera)
   - 2.1 Asignación Atómica de Consecutivos DIAN (`get_next_invoice_number_secure`)
   - 2.2 Deducción de Inventario y Prevención de Sobreventa (*Anti-Overselling*)
   - 2.3 Patrón Outbox Worker y Concurrencia con `FOR UPDATE SKIP LOCKED`
3. [Dimensión 2: Idempotencia y Resiliencia ante Reintentos de Red](#3-dimensión-2-idempotencia-y-resiliencia-ante-reintentos-de-red)
   - 3.1 Manejo de `idempotency_keys` en Peticiones Concurrentes
   - 3.2 Doble Cobro en Pasarelas de Pago vs Desincronización del Ledger
   - 3.3 Reintentos de Transmisión DIAN y Prevención de Facturas Duplicadas
4. [Dimensión 3: Resiliencia de Integración DIAN, Circuit Breaker y Contingencias](#4-dimensión-3-resiliencia-de-integración-dian-circuit-breaker-y-contingencias)
   - 4.1 Falla de Aislamiento en Circuit Breaker en Memoria (Multi-Proceso / Multi-Pod)
   - 4.2 Falsos Positivos: Confusión de Errores Semánticos (4xx) con Caídas de Infraestructura (5xx)
   - 4.3 Carrera en Estado `HALF_OPEN` y Control de Sondas Canario
   - 4.4 Marco de Contingencias: Contingencia Tipo 04 vs Ingesta de Talonario Físico Tipo 03
5. [Dimensión 4: Auditoría Criptográfica Inmutable (Merkle Hash Chain)](#5-dimensión-4-auditoría-criptográfica-inmutable-merkle-hash-chain)
   - 5.1 Colisión y Contención en Cadena de Bloques por Organización
6. [Matriz de Vulnerabilidades y Mitigaciones Obligatorias (Blueprints de Código y DDL)](#6-matriz-de-vulnerabilidades-y-mitigaciones-obligatorias)
7. [Criterios de Aceptación para Levantamiento de Veredicto](#7-criterios-de-aceptación-para-levantamiento-de-veredicto)

---

## 1. RESUMEN EJECUTIVO Y VEREDICTO

Tras una exhaustiva auditoría adversarial y análisis de sistemas distribuidos sobre el documento `IMPLEMENTATION_PLAN.md`, se concluye que el plan posee una **base arquitectónica sólida** (adopción del Patrón Outbox Transaccional, desacoplamiento en dos fases, Row Level Security y principios Append-Only).

Sin embargo, se han identificado **5 vulnerabilidades críticas y 4 riesgos de alta severidad** en la gestión de concurrencia, idempotencia de pasarelas, resiliencia del Circuit Breaker y sincronización de contingencias normativas. Si el sistema se construye siguiendo estrictamente el código de ejemplo del plan actual, se presentarán fallas en producción bajo condiciones de tráfico real:

1. **Cuello de Botella y Serialización Extrema de Cajas POS:** `SELECT ... FOR UPDATE` en `dian_resolutions` serializa todas las ventas del prefijo durante toda la transacción ACID local, limitando el throughput a ~10-20 TPS por prefijo y generando contención bajo picos de venta.
2. **Exhaustión de Pool de Conexiones en Outbox Worker:** El poller Outbox retiene bloqueos de fila de base de datos a través de llamadas HTTP/SOAP externas a la DIAN (10s–45s), lo que agotará el pool de conexiones de PostgreSQL/Supabase bajo latencia gubernamental.
3. **Circuit Breaker In-Memory Inoperante en Producción:** La implementación `DianCircuitBreaker` basada en variables de instancia en memoria (`self.state`) no sincroniza el estado entre múltiples workers de Uvicorn ni pods de Kubernetes, e interpreta errores de validación de datos del cliente (4xx / rechazo semántico de NIT) como caídas de la DIAN, abriendo el circuito erróneamente.
4. **Vulnerabilidad de Doble Cobro / Cargo Huérfano en Tarjetas:** El plan no define la máquina de estados de `PaymentIntent` en dos fases ni el mecanismo de compensación/reverso automático ante rollbacks locales de base de datos.
5. **Vacío Operativo en Contingencia Tipo 03 (Talonario de Papel):** No existe especificación para la transcripción retrospectiva de facturas físicas de contingencia (`TC`) con asignación manual de consecutivos autorizados y formato UBL 2.1 Tipo 03.

**Veredicto:** **`REQUEST_CHANGES`**  
El plan maestro debe incorporar las enmiendas arquitectónicas detalladas en este informe antes de iniciar la Fase 0 de codificación.

---

## 2. DIMENSIÓN 1: CONCURRENCIA, BLOQUEOS Y CONDICIONES DE CARRERA

### 2.1 Asignación Atómica de Consecutivos DIAN (`get_next_invoice_number_secure`)

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 334–386):
```sql
SELECT id, range_from, range_to, current_number, valid_until
INTO v_res
FROM dian_resolutions
WHERE organization_id = p_org_id
  AND prefix = p_prefix
  AND is_active = true
  AND valid_until >= CURRENT_DATE
FOR UPDATE;
```

#### Escenarios de Falla Identificados:
1. **Head-of-Line Blocking (Bloqueo en Cascada de Cajas Registradoras):**
   - *Mecanismo:* La función bloquea exclusivamente la fila de `dian_resolutions` al inicio de la Fase 1. La transacción retiene este bloqueo mientras valida stock de N productos, calcula impuestos, inserta líneas de factura, inserta asientos contables de partida doble, inserta cartera e inserta el evento outbox.
   - *Impacto:* Si un comercio tiene 8 cajas en un día de descuento (Black Friday) y cada transacción tarda 80ms, la capacidad máxima teórica es de sólo 12.5 ventas por segundo. Cualquier retraso en la inserción o contención de stock bloquea a todas las demás cajas en cola esperando el consecutivo.
2. **Desfase de Zona Horaria en `valid_until >= CURRENT_DATE`:**
   - *Mecanismo:* `CURRENT_DATE` evalúa la fecha según la zona horaria de la sesión/servidor PostgreSQL (por defecto UTC).
   - *Impacto:* A las 7:00 PM hora de Colombia (UTC-5) del día de vencimiento de la resolución, en el servidor ya es el día siguiente (UTC 00:00). La consulta falla arrojando excepción `P0002` ("No existe resolución activa"), paralizando la facturación 5 horas antes de que la resolución expire legalmente en Colombia.
3. **Colisión de Prefijo Nulo (`NULL` vs Cadena Vacía):**
   - *Mecanismo:* La restricción `UNIQUE(organization_id, prefix)` en PostgreSQL permite múltiples filas con `prefix IS NULL` porque en SQL estándar `NULL != NULL`.
   - *Impacto:* Organizaciones que facturan sin prefijo pueden tener resoluciones duplicadas activas, provocando errores de no-determinismo o excepción de múltiple retorno en `SELECT INTO`.
4. **Colisión en Sincronización POS Offline:**
   - *Mecanismo:* El plan contempla un modo POS Offline (Sección 11, Card 5) donde el terminal factura sin internet. Si el terminal offline asigna un consecutivo localmente y luego se reconecta mientras cajas online siguieron asignando números desde `dian_resolutions`, la sincronización colisionará fatalmente con el constraint `UNIQUE(organization_id, prefix, number)`.

#### Mitigación Requerida:
- Forzar zona horaria legal: `valid_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`.
- Implementar constraint `NOT NULL DEFAULT ''` para `prefix` o `CREATE UNIQUE INDEX ... ON dian_resolutions(organization_id, COALESCE(prefix, ''))`.
- Documentar explícitamente que los terminales POS Offline deben usar un prefijo de contingencia/offline reservado y exclusivo (ej. `POS-OFF`) con su propio rango DIAN o resolverse mediante asignación diferida de consecutivo formal.

---

### 2.2 Deducción de Inventario y Prevención de Sobreventa (*Anti-Overselling*)

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 389–403):
```sql
UPDATE inventory_levels
SET available_quantity = available_quantity - p_qty,
    version = version + 1,
    updated_at = clock_timestamp()
WHERE product_id = p_product_id
  AND organization_id = p_org_id
  AND available_quantity >= p_qty;
```

#### Análisis de Robustez:
- **Verificación Positiva:** La cláusula atómica `WHERE available_quantity >= p_qty` en un `UPDATE` de PostgreSQL adquiere un bloqueo exclusivo de tupla (`RowExclusiveLock`) y re-evalúa el predicado contra la última versión confirmada de la fila. Si el stock disponible es menor a `p_qty`, `ROW_COUNT` retorna `0`. Esto previene efectivamente la sobreventa a nivel de fila individual.

#### Vulnerabilidades y Brechas Detectadas:
1. **Ausencia de Constraint `CHECK` a Nivel de Base de Datos:**
   - Si un desarrollador o proceso administrativo (ej. ajuste de inventario manual, devolución o migración) ejecuta un `UPDATE` sin la cláusula condicional `WHERE available_quantity >= p_qty`, la columna `available_quantity NUMERIC` aceptará saldos negativos.
   - *Solución:* Agregar `CONSTRAINT chk_inventory_non_negative CHECK (available_quantity >= 0)` en la tabla `inventory_levels`.
2. **Falta de Particionamiento por Bodega / Ubicación (`warehouse_id`):**
   - El DDL de `inventory_levels` asume una única bodega global por organización (`organization_id`, `product_id`). En comercios con múltiples sedes o bodegas (Sede Norte, Sede Sur), dos ventas simultáneas en distintas sedes descontarán de una bolsa común, generando descuadres físicos en inventario real.
   - *Solución:* Definir la clave primaria como `(organization_id, warehouse_id, product_id)`.
3. **Riesgo de Interbloqueo (*AB-BA Deadlock*) en Carritos Multi-Producto:**
   - Si bien el plan menciona que el backend ordena los `product_id` alfanuméricamente, esto depende de la disciplina en el código de aplicación FastAPI. Si un módulo secundario (ej. Combos, Traslados de Mercancía o Producción) no ordena los IDs antes de actualizar, PostgreSQL abortará transacciones con error `40P01 (deadlock_detected)`.

---

### 2.3 Patrón Outbox Worker y Concurrencia con `FOR UPDATE SKIP LOCKED`

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 76, 238–256, 281):
El plan propone un `Outbox Worker Poller ('SKIP LOCKED')` que procesa eventos de `outbox_events` y realiza la firma digital y transmisión SOAP/REST a la DIAN.

#### Análisis de Falla Crítica en Sistemas Distribuidos:

```
ESCENARIO DE AGOTAMIENTO DE RECURSOS (RESOURCE EXHAUSTION BUG):
[Worker Hilo 1] Inicia Transacción BD: SELECT ... FOR UPDATE SKIP LOCKED
     │
     ├── Adquiere bloqueo de fila en outbox_events
     ├── Invoca dian-signer (Carga .p12, firma XAdES-EPES) [~150ms]
     ├── Envía HTTP SOAP Request a DIAN Web Service
     │     └── [DIAN responde con alta latencia: 35 segundos de espera]
     │
     └── [DURANTE ESTOS 35 SEGUNDOS, LA CONEXIÓN A POSTGRESQL PERMANECE ABIERTA Y BLOQUEADA]
```

- **Impacto de la Falla:**
  - Si hay 15 hilos del worker despachando facturas en horas pico y la DIAN experimenta lentitud (30s de latencia por petición), los 15 hilos retendrán 15 conexiones activas de PostgreSQL haciendo I/O de red inútil.
  - En arquitecturas serverless o pools con Supabase / PgBouncer en modo transacción, esto provoca **saturación inmediata del pool de conexiones** (`remaining connection slots are reserved for non-replication superuser connections`), tumbando la API principal y bloqueando las cajas POS de los clientes.
- **Riesgo de Doble Despacho (At-Least-Once Delivery):**
  - Si se implementa un mecanismo de timeout en el worker para liberar el bloqueo (`locked_until < NOW()`), y el Worker 1 tarda 65 segundos debido a la DIAN mientras el timeout era de 60s:
    - Worker 2 selecciona el mismo evento creyéndolo abandonado.
    - Worker 1 y Worker 2 envían el mismo XML firmado a la DIAN.
    - La DIAN procesará una de las peticiones y rechazará la segunda con error `Regla: Documento ya procesado previamente` o `CUFE duplicado`, enviando erróneamente la segunda factura a la tabla `dead_letter_events` (DLQ).

#### Mitigación Requerida (Patrón Claim-and-Commit de 2 Pasos):
El worker **NUNCA debe retener transacciones de base de datos abiertas durante llamadas HTTP externas**. Debe ejecutar un patrón de reclamo en 2 pasos:
1. **Paso 1 (Transacción BD Ultracorta < 5ms):**
   ```sql
   UPDATE outbox_events
   SET status = 'PROCESSING',
       locked_by = :worker_id,
       locked_until = clock_timestamp() + INTERVAL '2 minutes',
       retry_count = retry_count + 1
   WHERE id IN (
       SELECT id FROM outbox_events
       WHERE status IN ('PENDING', 'FAILED')
         AND scheduled_for <= clock_timestamp()
         AND (locked_until IS NULL OR locked_until < clock_timestamp())
         AND retry_count < max_retries
       ORDER BY scheduled_for ASC
       LIMIT :batch_size
       FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```
   *Hacer COMMIT inmediato.*
2. **Paso 2 (Procesamiento Externo Fuera de BD):** Firma digital, llamada HTTP a la DIAN y evaluación de respuesta.
3. **Paso 3 (Transacción de Finalización Ultracorta < 5ms):**
   Actualizar `outbox_events.status = 'COMPLETED'` y el estado de la factura en una transacción atómica separada.

---

## 3. DIMENSIÓN 2: IDEMPOTENCIA Y RESILIENCIA ANTE REINTENTOS DE RED

### 3.1 Manejo de `idempotency_keys` en Peticiones Concurrentes

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 306–324):
```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(128) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (organization_id, key)
);
```

#### Análisis de Vulnerabilidades en Concurrencia:
1. **Condición de Carrera por Doble Clic Rápido (Concurrent Request Collision):**
   - *Escenario:* Un cajero presiona el botón "Cobrar" dos veces en 50ms o una conexión inestable envía la petición por dos canales TCP paralelos con la misma `Idempotency-Key`.
   - *Petición A:* Inserta exitosamente en `idempotency_keys` con `status = 'IN_PROGRESS'`.
   - *Petición B:* Falla con violación de Primary Key (`23505 unique_violation`).
   - *Falla del Plan:* El plan no especifica el comportamiento exacto del middleware ante el error de colisión. Si el middleware retorna `HTTP 500` o `HTTP 409 Conflict` inmediatamente al frontend, la UI mostrará un toast de error, provocando que el cajero intente cobrar de nuevo con otra clave, resultando en doble facturación.
   - *Comportamiento Correcto Requerido:* Si una petición concurrente encuentra `status = 'IN_PROGRESS'`, el middleware debe esperar activamente (polling controlado con timeout de 3-5 segundos) a que la primera petición pase a `COMPLETED` para retornar la respuesta consolidada, o retornar `HTTP 429 / HTTP 409` con cabecera `Retry-After: 1`.
2. **Reutilización de Clave con Payload Modificado (*Payload Mutation Tampering*):**
   - Si un cliente reenvía la misma `Idempotency-Key` pero altera el monto o el destinatario, el middleware debe rechazar la solicitud con `HTTP 422 Unprocessable Entity` ("Idempotency key already used with different payload payload_hash").

---

### 3.2 Doble Cobro en Pasarelas de Pago vs Desincronización del Ledger

#### Brecha Crítica Identificada:
El plan maestro aborda con precisión la transacción de venta local, pero **omite la integración con pasarelas de pago electrónico (Tarjetas de Crédito/Débito, PSE, Wompi, Bold, Datáfonos Redeban/Credibanco)**.

```
RIESGO DE TRANSACCIÓN FANTASMA / CARGO HUÉRFANO:
[1. Cliente POS] -> Solicita Pago con Tarjeta
      │
[2. Backend] ----> Cobra a la Pasarela Externa (Bold / Wompi)
      │            └── Pasarela responde: "APROBADO" (Cobro de $500.000 COP ejecutado)
      │
[3. Backend] ----> Intenta registrar en BD PostgreSQL (Invoices + Journal Lines)
                   └── ERROR: "Resolución DIAN agotada" o "Deadlock de Inventario"
                   └── ROLLBACK EN BASE DE DATOS!

RESULTADO CATASTRÓFICO:
- La tarjeta del cliente fue cobrada por $500.000 COP.
- En DigiKawsay la factura no existe y no hay registro contable.
- El cliente se va furioso y el comercio tiene descuadre de tesorería.
```

#### Mitigación Arquitectónica Obligatoria:
Implementar el ciclo de vida en dos fases mediante la tabla `payment_intents`:
1. **Fase de Autorización/Reserva:** Se registra un `payment_intent` en estado `REQUIRES_PAYMENT` con su `idempotency_key`.
2. **Ejecución y Captura:** La pasarela se invoca utilizando el ID de `payment_intent` como clave de idempotencia externa.
3. **Compensación / Reverso Automático:** Si la confirmación local en BD falla tras un cobro exitoso, un handler de rescate o worker ejecuta de inmediato la API de reverso de la pasarela (*Gateway Void / Auto-Refund*), garantizando la integridad financiera.

---

### 3.3 Reintentos de Transmisión DIAN y Prevención de Facturas Duplicadas

#### Escenario de Carrera en Timeout DIAN (HTTP 504 Gateway Timeout):
1. El Outbox Worker envía la factura `FV-1045` a la DIAN.
2. La DIAN procesa y valida la factura internamente con CUFE, pero la conexión TCP se corta o el balanceador de la DIAN responde `504 Gateway Timeout`.
3. El Worker marca la tarea como `FAILED` y programa un reintento en 5 minutos.
4. En el reintento, el Worker vuelve a invocar el Web Service `SendBillSync`.
5. La DIAN rechaza la petición con error fatal: `Regla 99: El documento con prefijo FV y número 1045 ya fue validado previamente`.
6. Si el sistema interpreta este rechazo como un fallo de negocio (Caso C de la Sección 4.1 del plan), **ejecutará una transacción compensatoria, anulará la factura y reversará el inventario de una venta que la DIAN sí aprobó legalmente**.

#### Mitigación Requerida:
Antes de considerar un reintento como fallo definitivo o retransmitir a ciegas, el Worker debe invocar el servicio de consulta de estado DIAN (`GetStatus` / `GetStatusZip`) enviando el `TrackID` o `CUFE` calculado. Si la DIAN retorna que el documento ya fue aceptado, el worker extrae el `ApplicationResponse`, actualiza la factura a `DIAN_ACCEPTED` y finaliza con éxito.

---

## 4. DIMENSIÓN 3: RESILIENCIA DE INTEGRACIÓN DIAN, CIRCUIT BREAKER Y CONTINGENCIAS

### 4.1 Falla de Aislamiento en Circuit Breaker en Memoria (Multi-Proceso / Multi-Pod)

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 680–731):
```python
class DianCircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0, half_open_attempts: int = 3):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        ...
```

#### Análisis de Falla:
- En despliegues estándar de FastAPI/Uvicorn, la aplicación corre con múltiples procesos trabajadores (`uvicorn main:app --workers 4`), o sobre múltiples réplicas en Kubernetes / Google Cloud Run.
- Cada proceso worker posee su propia instancia aislada de `DianCircuitBreaker` en la memoria del intérprete Python.
- Si la DIAN sufre una caída total:
  - Worker 1 recibe 5 peticiones, falla 5 veces y pasa a `OPEN`.
  - Worker 2, Worker 3 y Worker 4 continúan en estado `CLOSED`.
  - Los usuarios cuyas peticiones sean enrutadas a los Workers 2, 3 y 4 continuarán sufriendo timeouts de 30 a 45 segundos, sufriendo degradación en cascada.
  - En plataformas serverless (Cloud Run / AWS Lambda con autoscaling a cero), el estado en memoria se destruye y reinicia en cada contenedor nuevo.

#### Mitigación Requerida:
El Circuit Breaker de DIAN debe almacenar su estado, contadores y marcas de tiempo en un **almacén de estado compartido de baja latencia (Redis)** con operaciones atómicas (`INCR`, `GET`, `SETEX`), o como fallback en una tabla de PostgreSQL `dian_circuit_state` con lectura rápida.

---

### 4.2 Falsos Positivos: Confusión de Errores Semánticos (4xx) con Caídas de Infraestructura (5xx)

#### Observación del Plan (`dian_circuit_breaker.py` Líneas 724–731):
```python
def record_failure(self):
    self.failure_count += 1
    now = time.time()
    if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
        logger.warning(f"Umbral de fallas DIAN superado ({self.failure_count}). Circuit Breaker -> OPEN.")
        self.state = CircuitState.OPEN
```

#### Falla Crítica de Lógica:
- `record_failure()` incrementa el contador de fallas ante **cualquier excepción o error**.
- Si un usuario emite 5 facturas consecutivas con un NIT de cliente inválido (ej. no inscrito en RUT), o un producto con tarifa de IVA mal configurada (Rechazo DIAN Regla FAJ24), la DIAN responderá con rechazo semántico de negocio.
- El Circuit Breaker contará 5 fallas de negocio y **abrirá el circuito para todo el sistema**.
- A partir de ese momento, todas las facturas válidas de todos los clientes de la empresa serán desviadas indebidamente a `CONTINGENCIA_DIAN_04`, violando la normativa tributaria que prohíbe emitir en contingencia cuando los servidores de la DIAN están operativos.

#### Mitigación Requerida:
Clasificación estricta de excepciones en el cliente DIAN:
- **Disparan Circuit Breaker (Errores de Infraestructura / Disponibilidad):** `httpx.ConnectTimeout`, `httpx.ReadTimeout`, `httpx.ConnectError`, `HTTP 502 Bad Gateway`, `HTTP 503 Service Unavailable`, `HTTP 504 Gateway Timeout`, `HTTP 500 Internal Server Error (DIAN SOAP Fault técnico)`.
- **NO Disparan Circuit Breaker (Errores Semánticos de Validación):** `HTTP 400 Bad Request`, `ApplicationResponse` de la DIAN con código de rechazo por reglas de validación de negocio (RUT no encontrado, CUFE mal calculado, discrepancia de impuestos).

---

### 4.3 Carrera en Estado `HALF_OPEN` y Control de Sondas Canario

#### Observación del Plan (`dian_circuit_breaker.py` Líneas 702–713):
```python
def can_execute(self) -> bool:
    now = time.time()
    if self.state == CircuitState.OPEN:
        if now - self.last_state_change > self.recovery_timeout:
            self.state = CircuitState.HALF_OPEN
            self.last_state_change = now
            self.success_count = 0
            return True
        return False
    return True
```

#### Análisis de Falla:
- Cuando expira `recovery_timeout`, la primera petición cambia el estado a `HALF_OPEN` y retorna `True`.
- Inmediatamente después, las siguientes 50 peticiones concurrentes llaman a `can_execute()`. Dado que `self.state == CircuitState.HALF_OPEN`, la condición `if self.state == CircuitState.OPEN` es `False`, por lo que **todas las 50 peticiones son autorizadas para golpear a la DIAN en paralelo**.
- Si la DIAN aún está inestable, 50 hilos se estrellarán simultáneamente contra el servicio caído en lugar de evaluar una única **petición de sondeo canario (*Single Canary Probe*)**.

#### Mitigación Requerida:
En estado `HALF_OPEN`, el Circuit Breaker debe permitir estrictamente **una única petición de prueba concurrente**. Las demás peticiones deben recibir `False` y continuar usando el fallback de Contingencia Tipo 04 hasta que la sonda confirme la recuperación.

---

### 4.4 Marco de Contingencias: Contingencia Tipo 04 vs Ingesta de Talonario Físico Tipo 03

#### Comparativa Normativa y Brechas Detectadas:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MATRIZ DE CONTINGENCIAS DIAN (RES. 000165)                       │
├────────────────────────────────┬────────────────────────────────────────────────────────────┤
│ TIPO 04: INDISPONIBILIDAD DIAN │ TIPO 03: INDISPONIBILIDAD DEL EMISOR (DIGIKAWSAY / COMERCIO)│
├────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ • Causa: Servidores DIAN caídos│ • Causa: Falla eléctrica, caída de internet o ERP offline. │
│ • Resolución: Prefijo Electrón.│ • Resolución: Talonario de Contingencia (Prefijo 'TC').    │
│ • Numeración: Automática ERP   │ • Numeración: MANUAL Pre-impresa en papel talonario físico.│
│ • CUFE: Generado en el momento │ • CUFE: Calculado al transcribir tras recuperación.       │
│ • Transmisión: UBL estándar 04 │ • Transmisión: UBL Tipo 03 con fecha de emisión histórica. │
└────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

#### Brecha Operativa en el Plan Actual:
- El plan cubre la emisión automática de Tipo 04, pero **carece del endpoint y flujo de transcripción para Tipo 03**.
- Cuando vuelve la luz o el internet al comercio, el cajero tiene un paquete de 15 facturas físicas de papel del talonario `TC-0045` a `TC-0059`.
- Si el cajero intenta crearlas por el endpoint normal `POST /api/v1/invoices`, el sistema invocaría `get_next_invoice_number_secure` y asignaría el consecutivo del prefijo electrónico normal `FEV`, alterando la numeración física ya entregada a los clientes.

#### Mitigación Requerida:
Crear el endpoint especializado `POST /api/v1/invoices/contingency-03-ingestion` que:
1. Permite especificar el número exacto del talonario físico (`TC-0045`).
2. Valida que el número esté dentro del rango autorizado de la resolución de contingencia activa.
3. Registra la fecha y hora histórica en que se emitió el papel físico (`physical_issued_at`).
4. Genera el XML UBL 2.1 con `<cbc:InvoiceTypeCode>03</cbc:InvoiceTypeCode>` y lo programa en el outbox para sincronización dentro del plazo legal de 48 horas.

---

## 5. DIMENSIÓN 4: AUDITORÍA CRIPTOGRÁFICA INMUTABLE (MERKLE HASH CHAIN)

### 5.1 Colisión y Contención en Cadena de Bloques por Organización

#### Observación del Plan (`IMPLEMENTATION_PLAN.md` Líneas 608–616):
```sql
SELECT hash INTO v_prev_hash
FROM audit_logs
WHERE organization_id = v_org_id
ORDER BY sequence_number DESC
LIMIT 1;
```

#### Análisis de Falla de Concurrencia:
- Si dos transacciones de la misma organización intentan insertar o actualizar registros en el mismo milisegundo (ej. dos ventas en dos cajas distintas):
  - Ambas ejecutan el trigger `process_audit_log`.
  - Ambas leen el mismo `v_prev_hash` (porque ninguna ha hecho commit aún).
  - Ambas insertan su fila en `audit_logs` encadenadas al mismo hash previo.
  - Esto produce una **bifurcación en la cadena de auditoría (Audit Chain Forking)**, rompiendo la verificación lineal estricta de la cadena Merkle.

#### Mitigación Requerida:
1. Adquirir un bloqueo pesimista a nivel de organización para la secuencia de auditoría usando `pg_advisory_xact_lock(hashtext('audit_lock_' || v_org_id::text))` dentro del trigger, garantizando serialización estricta de la cadena criptográfica sin bifurcaciones.

---

## 6. MATRIZ DE VULNERABILIDADES Y MITIGACIONES OBLIGATORIAS

| ID | Componente / Módulo | Severidad | Vulnerabilidad Identificada | Mitigación Arquitectónica Obligatoria |
|:---:|:---|:---:|:---|:---|
| **V-01** | `get_next_invoice_number_secure` | **ALTA** | `CURRENT_DATE` en UTC invalida resoluciones 5h antes en Colombia; serialización de todas las cajas en la misma fila. | Usar `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE`; optimizar transacción ACID al mínimo indispensable. |
| **V-02** | `inventory_levels` | **MEDIA** | Falta constraint `CHECK >= 0` en base de datos; falta clave compuesta por bodega (`warehouse_id`). | Agregar `CHECK (available_quantity >= 0)` y clave `(organization_id, warehouse_id, product_id)`. |
| **V-03** | Outbox Worker Poller | **CRÍTICA** | Mantiene transacciones de PostgreSQL abiertas durante llamadas HTTP a la DIAN (30s+), agotando el pool de conexiones. | Implementar patrón Claim-and-Commit en 2 pasos independientes sin retención de transacciones en llamadas I/O. |
| **V-04** | `idempotency_keys` | **ALTA** | Peticiones concurrentes con misma clave fallan en lugar de esperar la resolución del estado `IN_PROGRESS`. | Implementar polling con timeout / `Retry-After` en middleware y verificación de `request_hash`. |
| **V-05** | Pasarelas de Pago | **CRÍTICA** | No existe gestión de `payment_intents` en 2 fases ni reverso automático ante fallas locales de base de datos. | Diseñar modelo `payment_intents` y worker de compensación / conciliación de cobros con pasarelas externas. |
| **V-06** | DIAN Circuit Breaker | **CRÍTICA** | Estado en memoria aislado por worker/pod; abre el circuito ante errores semánticos de validación de cliente (4xx). | Migrar estado a Redis / Postgres; clasificar excepciones para reaccionar únicamente ante caídas 5xx / timeouts. |
| **V-07** | Circuit Breaker `HALF_OPEN` | **MEDIA** | Permite ráfagas concurrentes en recuperación en vez de una sonda canario individual. | Forzar `max_concurrent_probes = 1` mediante locks atómicos en Redis / DB. |
| **V-08** | Contingencia Tipo 03 | **ALTA** | Inexistencia de endpoint y DDL para transcripción manual de talonarios físicos de papel con prefijo `TC`. | Crear endpoint `/api/v1/invoices/contingency-03-ingestion` y soporte UBL Tipo 03 con fecha de emisión histórica. |
| **V-09** | Merkle Hash Trigger | **MEDIA** | Bifurcación de la cadena de hash (`Audit Chain Forking`) ante escrituras concurrentes en la misma organización. | Incorporar `pg_advisory_xact_lock` por tenant en la función `process_audit_log`. |

---

### 6.1 Blueprints de Código Mejorado

#### A. Circuit Breaker Distribuido y Resiliente (Python / Redis / FastAPI)

```python
# /app/services/billing/services/distributed_circuit_breaker.py
import time
import logging
from enum import Enum
import httpx
from typing import Optional

logger = logging.getLogger("dian_resilience")

class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class DistributedDianCircuitBreaker:
    """
    Circuit Breaker distribuido respaldado por Redis / Atomic DB State.
    Distingue fallas de infraestructura de errores semánticos de validación.
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
                # Intentar adquirir el candado exclusivo de sonda canario
                acquired = self.redis.set(
                    f"{self.prefix}:probe_lock", "1", nx=True, ex=self.probe_timeout
                )
                if acquired:
                    self.redis.set(f"{self.prefix}:state", CircuitState.HALF_OPEN.value)
                    logger.info("Circuit Breaker -> HALF_OPEN (Sonda Canario Adquirida)")
                    return True
            return False

        if state == CircuitState.HALF_OPEN:
            # Solo la sonda canario que tiene el lock puede ejecutar
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
        """Solo invocada ante fallas de conectividad, timeouts y HTTP 5xx"""
        logger.warning(f"Falla de infraestructura DIAN detectada: {type(error).__name__} - {error}")
        state = self.get_state()

        if state == CircuitState.HALF_OPEN:
            # La sonda canario falló: volver inmediatamente a OPEN
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
            logger.error(f"Umbral de fallas alcanzado ({failures}). Circuit Breaker -> OPEN (Activando Contingencia 04).")

    @staticmethod
    def is_infrastructure_error(exc: Exception) -> bool:
        """Determina si un error es de red/disponibilidad o de validación de negocio"""
        if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError, httpx.NetworkError)):
            return True
        if isinstance(exc, httpx.HTTPStatusError):
            # Errores 5xx son caídas de la DIAN; 4xx son rechazos de datos del cliente
            return exc.response.status_code >= 500
        return False
```

---

#### B. Trigger de Auditoría Merkle Anti-Forking con Advisory Lock

```sql
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

    -- BLOQUEO ADVISORY TRANSACCIONAL POR TENANT PARA EVITAR BIFURCACIÓN DE HASH (ANTI-FORKING)
    PERFORM pg_advisory_xact_lock(hashtext('audit_lock_' || v_org_id::text));

    -- Obtener el último hash confirmado de la organización
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
```

---

## 7. CRITERIOS DE ACEPTACIÓN PARA LEVANTAMIENTO DE VEREDICTO

Para que `challenger_2` otorgue el dictamen **`APPROVE`**, el documento `IMPLEMENTATION_PLAN.md` debe actualizarse reflejando los siguientes 5 puntos:

1. **Corrección de Timezone y Unicidad en `get_next_invoice_number_secure`:** Aplicación de `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::DATE` y tratamiento explícito de prefijo vacío vs nulo.
2. **Definición del Patrón Outbox Claim-and-Commit de 2 Pasos:** Documentar explícitamente que el worker nunca retiene transacciones de base de datos durante I/O externo con la DIAN.
3. **Circuit Breaker Distribuido con Clasificación de Errores:** Actualizar la Sección 9.2 incorporando el modelo de estado distribuido y la diferenciación estricta entre errores de red/5xx vs errores semánticos 4xx.
4. **Arquitectura de Resiliencia en Pagos Electrónicos (`PaymentIntent`):** Añadir la especificación de la tabla `payment_intents` y los flujos de reverso automático ante desincronización de base de datos.
5. **Especificación de Ingesta para Contingencia Tipo 03:** Incluir el flujo operativo, DDL y endpoint para transcripción de facturas físicas en papel con prefijo `TC`.
