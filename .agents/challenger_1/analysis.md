# 🛡️ INFORME DE ANÁLISIS ADVERSARIAL Y STRESS TESTING
## DigiKawsay / CFO-AI: Plan Maestro de Implementación (`IMPLEMENTATION_PLAN.md`)
**Agente Evaluador:** Senior Adversarial Challenger (`challenger_1`)  
**Fecha de Evaluación:** 2026-08-17  
**Veredicto Oficial:** **REQUEST_CHANGES** (Se identificaron 6 vulnerabilidades críticas y de borde que requieren parches arquitecturales antes de proceder a la fase de construcción).

---

## 1. RESUMEN EJECUTIVO Y EVALUACIÓN DE RIESGO

| Dimensión Evaluada | Nivel de Riesgo Inicial | Estado del Plan | Impacto Potencial en Producción |
|---|:---:|:---:|---|
| **1. Multi-Step Transaction Matrix & Outbox Worker** | **CRÍTICO** | Incompleto en Fallas de Red | Falsa anulación de facturas legalmente válidas ante DIAN; eventos "zombie" bloqueados en Outbox por caída del worker. |
| **2. Contrasientos y Notas Crédito (Pre vs Post CUFE)** | **ALTO** | Ambigüedad en Conceptos DIAN | Restock indebido en Notas Crédito por Descuento (Concepto 3); desfase en valoración de inventarios (Promedio Ponderado). |
| **3. Conciliación Bancaria y Extractos** | **MEDIO-ALTO** | Modelo 1:1 Insuficiente | Imposibilidad de conciliar liquidaciones agrupadas de pasarelas (Bold/Wompi/Datáfonos con comisión retenida); falso cálculo de 4x1000 en cuentas exentas (Art. 879 E.T.). |
| **4. Retenciones en la Fuente y Umbrales UVT** | **ALTO** | Falta Matriz de Regímenes | Retención ilegal aplicada a proveedores del Régimen Simple (Art. 911 E.T.) o por compradores no agentes de retención; UVT estática no versionada por año fiscal. |
| **5. POS Offline y Sincronización Concurrente** | **CRÍTICO** | Conflicto de Consecutivos y Stock | Colisión de clave única `UNIQUE(prefix, number)` al sincronizar múltiples terminales offline; bloqueo/aborto de sincronización por stock negativo. |
| **6. DDL, Concurrencia y Renovación de Resoluciones** | **ALTO** | Restricción DDL Rígida | `UNIQUE(organization_id, prefix)` en `dian_resolutions` impide renovar rangos autorizados para el mismo prefijo (`FE`, `POS`). |

---

## 2. ANÁLISIS DETALLADO DE DESAFÍOS Y ESCENARIOS DE FALLO

---

### DESAFÍO 1: Matriz de Falla Transaccional Multi-Paso y Resiliencia del Worker Outbox

#### 1.1 El Escenario del "Rechazo Falso por Caída de Conexión en Vuelo" (In-Doubt DIAN State)
- **Supuesto del Plan:**  
  En la Sección 4.1 (Fase 2, Caso C), el plan asume que si la DIAN devuelve un código de error o si el reintento falla con una regla de validación de negocio, se trata como un *Rechazo Semántico Fatal*, disparando la *Transacción Compensatoria* (`state = 'REJECTED_DIAN_VOIDED'`, contrasiento contable y restock de inventario).
- **Escenario de Ataque / Falla Real:**
  1. El worker despacha el XML firmado a la DIAN mediante HTTPS.
  2. Los servidores de la DIAN reciben el documento, lo validan con éxito, generan el CUFE y lo registran en la base de datos nacional de la DIAN.
  3. Antes de que la DIAN pueda enviar la respuesta HTTP 200 con el `ApplicationResponse` firmado, ocurre un corte de red, timeout de socket (TCP Reset) o caída del balanceador de carga intermedio.
  4. El worker captura un `TimeoutException` y programa un reintento.
  5. En el segundo intento, el worker reenvía el mismo XML con el mismo consecutivo.
  6. La DIAN responde con un error semántico de rechazo: *"Regla 99 / Consecutivo o CUFE ya procesado previamente"*.
  7. El worker clasifica esto como un "Rechazo Semántico (Caso C)" y ejecuta el contrasiento y anulación local.
- **Blast Radius (Impacto Destructivo):**
  **FRAUDE TRIBUTARIO INVOLUNTARIO Y EVASIÓN LEGAL:** Ante la DIAN y la ley colombiana, la factura es 100% legal, válida y genera IVA a pagar e ingresos gravables para la empresa. Sin embargo, en DigiKawsay la factura quedó anulada, el ingreso borrado y la mercancía devuelta al stock para ser vendida de nuevo.
- **Mitigación Mandatoria:**
  Antes de clasificar un error de duplicidad o rechazo ambiguo como definitivo, el worker debe consultar de manera idempotente el endpoint de consulta de estado de la DIAN (`GetStatus` o `GetStatusZip`) enviando el `TrackId` o el `CUFE` computado. Si la DIAN retorna `Aceptado`, el sistema debe actualizar a `DIAN_ACCEPTED`, recuperar el `ApplicationResponse` oficial y archivar el XML, abortando cualquier intento de compensación.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO CORREGIDO DE RECONCILIACIÓN EN DUDA                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
  Envío XML DIAN ──► ¿Timeout / Network Drop? ──► Reintento Worker
                                                         │
                                                         ▼
                                          ¿Error "Documento ya Existe"?
                                            ├── SÍ: Invocar GetStatus(CUFE)
                                            │         ├── Si DIAN='Aceptado': Adoptar CUFE -> DIAN_ACCEPTED
                                            │         └── Si DIAN='Rechazado': Ejecutar Compensación
                                            └── NO: Evaluar Regla de Negocio
```

---

#### 1.2 Eventos "Zombie" por Caída / OOM del Worker Outbox
- **Supuesto del Plan:**  
  La tabla `outbox_events` define `locked_by VARCHAR(100)` y `locked_until TIMESTAMPTZ`, con un índice:
  `CREATE INDEX idx_outbox_processing ON outbox_events(status, scheduled_for) WHERE status IN ('PENDING', 'FAILED');`
- **Escenario de Ataque / Falla Real:**
  1. El Worker A adquiere un lote de eventos, actualiza `status = 'PROCESSING'` y define `locked_until = NOW() + INTERVAL '5 minutes'`.
  2. Mientras procesa el lote, el contenedor de Docker/Kubernetes sufre un OOM (Out-of-Memory) Kill o reinicio forzado del servidor.
  3. Los eventos quedan en PostgreSQL con `status = 'PROCESSING'`.
  4. Los nuevos workers pollean la tabla con la consulta indexada `WHERE status IN ('PENDING', 'FAILED')`.
  5. Ningún worker volverá a seleccionar jamás estas filas porque tienen `status = 'PROCESSING'`.
- **Blast Radius:**
  Facturas en cola quedan permanentemente congeladas como "zombies" en la base de datos; jamás se transmiten a la DIAN, jamás llegan a la DLQ y jamás alertan al usuario.
- **Mitigación Mandatoria:**
  1. Modificar el índice y la consulta del poller para recuperar bloqueos expirados (Lease Expiration Pattern):
     ```sql
     CREATE INDEX idx_outbox_processing 
     ON outbox_events(status, scheduled_for, locked_until) 
     WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');
     ```
  2. Consulta de Polling atómica con `SKIP LOCKED`:
     ```sql
     SELECT id FROM outbox_events
     WHERE (status IN ('PENDING', 'FAILED') AND scheduled_for <= clock_timestamp())
        OR (status = 'PROCESSING' AND locked_until < clock_timestamp())
     ORDER BY scheduled_for ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 50;
     ```

---

### DESAFÍO 2: Lógica de Compensación y Cumplimiento Normativo (Pre vs Post CUFE)

#### 2.1 Preservación del Costo Unitario en Kardex ante Contrasientos (NIC 2 / IAS 2)
- **Supuesto del Plan:**  
  El contrasiento reversa el costo de ventas y devuelve las unidades a `inventory_levels`.
- **Escenario de Ataque / Falla Real:**
  - El sistema utiliza el método de **Costo Promedio Ponderado**:
    - Stock inicial: 10 unidades @ $10.000 (Valor Total: $100.000).
    - Venta 1 (Factura #101): Vende 4 unidades. Costo de venta registrado = 4 * $10.000 = $40.000. Quedan 6 unidades @ $10.000 ($60.000).
    - Compra intermedia: Se compran 10 unidades @ $14.000 ($140.000). Nuevo stock: 16 unidades, Valor Total: $200.000. Nuevo costo promedio = $12.500/unidad.
    - Rechazo DIAN de Factura #101.
    - Si el restock recalcula el costo con el promedio actual ($12.500 * 4 = $50.000), el contrasiento intentaría reversar $50.000 contra una venta que costó $40.000, rompiendo la ecuación patrimonial del libro mayor por $10.000.
- **Mitigación Mandatoria:**
  Cada línea de factura (`invoice_lines`) debe almacenar de forma inmutable el `unit_cost` y el `cogs_amount` exacto utilizado en el momento de la venta. El contrasiento y el restock en el Kardex deben reversar exactamente los valores históricos congelados en la línea de la factura.

---

#### 2.2 Despacho Condicional por Código de Concepto en Notas Crédito (Resolución 000042)
- **Supuesto del Plan:**  
  La Sección 6.2 menciona Notas Crédito con códigos de concepto (1: Devolución parcial, 2: Anulación total, 3: Rebaja/descuento), pero no explicita la regla contable e inventario para cada una.
- **Escenario de Ataque / Falla Real:**
  - Si un usuario emite una Nota Crédito de **Concepto 3 (Rebaja o descuento comercial posterior)** por $50.000 debido a una inconformidad de precio:
  - Si el backend ejecuta automáticamente el restock de inventario, sumará unidades a la bodega que el cliente nunca devolvió, falseando el conteo de stock físico.
  - Si la factura ya fue pagada y se anula con **Concepto 2 (Anulación total)**, el sistema no puede simplemente anular la cuenta por cobrar (que ya está en cero), sino que debe generar un saldo a favor en la cuenta de pasivo `280505` (Anticipos y saldos a favor de clientes) o registrar un egreso de tesorería.
- **Mitigación Mandatoria:**
  Definir la matriz estricta de despacho contable y de inventario:
  1. **Concepto 1 (Devolución parcial de bienes):** Restock exclusivo de las cantidades devueltas; débito a Ingresos (o 4175), débito a IVA (2408), crédito a Clientes (1305); débito a Inventario (1435) y crédito a Costo de Ventas (6135).
  2. **Concepto 2 (Anulación de factura):** Restock total; reversión 100% de impuestos e ingresos; si la factura estaba impaga -> reduce 1305; si estaba pagada -> acredita Pasivo 280505 (Saldo a favor del cliente).
  3. **Concepto 3 (Rebaja / Descuento):** **CERO RESTOCK DE INVENTARIO**; débito a 4175 (Devoluciones y rebajas) y débito a 2408 (IVA proporcional), crédito a 1305 / 2805.
  4. **Concepto 4 (Ajuste de precio / Financiero):** CERO restock; ajuste de líneas financieras únicamente.

---

### DESAFÍO 3: Conciliación Bancaria, Umbrales UVT y POS Offline

#### 3.1 Conciliación Bancaria: Liquidaciones Agrupadas de Pasarelas (Bold / Wompi) y Exención 4x1000
- **Supuesto del Plan:**  
  Sección 12.4 plantea coincidencias 1 a 1 de valor exacto con fechas desfasadas (+/- 2 a 5 días).
- **Escenario de Ataque / Falla Real:**
  1. **Liquidación N:1 de Pasarelas / Datáfonos:**  
     Un comercio realiza 20 ventas POS en el día con datáfono por un total de $2.000.000. La entidad adquirente (Redeban/Bold) transfiere al día siguiente un único depósito por **$1.928.600**, tras descontar comisión MDR (2.5% + IVA = $59.500) y retenciones automáticas (ReteFuente $20.000 + ReteICA $8.280).  
     El algoritmo 1:1 nunca cruzará este depósito de $1.928.600 contra las 20 ventas individuales ni contra el total de $2.000.000.
  2. **Exención Legal del Gravamen 4x1000 (Estatuto Tributario Art. 879, Numeral 1):**  
     Las personas naturales y personas jurídicas pueden marcar una cuenta de ahorros como exenta de 4x1000 hasta por 350 UVT mensuales ($16.472.750 COP en 2024 / $17.429.650 COP en 2025).  
     Si el reconciliador asume 4x1000 automático en todos los débitos, generará asientos fantasmas en la cuenta `511595`.
- **Mitigación Mandatoria:**
  - Incorporar motor de conciliación de liquidaciones por lote (*Gateway Settlement Matcher*), permitiendo seleccionar N recibos de venta contra 1 depósito bancario, calculando y registrando automáticamente el asiento de gasto por comisión bancaria (530515) y retenciones asumidas.
  - Agregar campos `is_gmf_exempt BOOLEAN` y `gmf_monthly_limit_uvt NUMERIC` en la tabla `bank_accounts`.

---

#### 3.2 Matriz de Regímenes Tributarios y Versionamiento Dinámico de UVT
- **Supuesto del Plan:**  
  Sección 12.3 aplica retenciones automáticas basadas en UVT general (27 UVT para compras, 4 UVT para servicios).
- **Escenario de Ataque / Falla Real:**
  1. Si la empresa le compra mercancía por $5.000.000 a un proveedor acogido al **Régimen Simple de Tributación (RST)**: Bajo el Artículo 911 del Estatuto Tributario, a los contribuyentes del Régimen Simple **NO se les practica retención en la fuente a título de renta ni ReteICA**. Si el sistema calcula retención, comete una falta tributaria grave.
  2. Si el proveedor es **Autorretenedor** o **Gran Contribuyente**, la empresa compradora estándar no debe practicar retención.
  3. Si la empresa compradora es `NO_RESPONSABLE_IVA` (persona natural comerciante no declarante), no tiene la calidad de agente retenedor según el Art. 368-2 E.T.
- **Mitigación Mandatoria:**
  Crear la tabla `tax_configurations` con el histórico de valor UVT por año fiscal y una función de evaluación matricial:

```sql
CREATE TABLE tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL UNIQUE,
    uvt_value NUMERIC(10,2) NOT NULL,
    compras_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 27.0,
    servicios_general_uvt NUMERIC(6,2) NOT NULL DEFAULT 4.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

---

#### 3.3 POS Offline: Partición de Rangos y Manejo de Stock Negativo
- **Supuesto del Plan:**  
  Sección 5.1 bloquea `dian_resolutions` con `FOR UPDATE` para calcular `v_next := v_res.current_number + 1`.
- **Escenario de Ataque / Falla Real:**
  1. Si un punto de venta queda offline, no puede ejecutar `FOR UPDATE` en la base de datos central de PostgreSQL.
  2. Si dos terminales offline generan ventas locales con prefijo común (ambas emitiendo `#501`), al recuperar la conexión e intentar sincronizar, la base de datos arrojará una violación de clave única `UNIQUE(organization_id, prefix, number)`. La sincronización fallará y los tickets ya entregados a los clientes quedarán huérfanos.
  3. Si el stock en el servidor era de 2 unidades y entre dos terminales offline se vendieron 4 unidades, el check `available_quantity >= p_qty` abortará la transacción en la sincronización, pero el producto ya salió físicamente de la tienda.
- **Mitigación Mandatoria:**
  1. **Asignación Pre-Particionada de Rangos (Leased Range Chunks):** Cuando un terminal POS inicia sesión, solicita al servidor una reserva anticipada de un bloque de consecutivos (ej. Terminal 1 reserva 500-599; Terminal 2 reserva 600-699). Cada terminal factura offline dentro de su bloque asignado sin riesgo de colisión.
  2. **Ingesta Tolerante a Sobregiro de Stock en Sync Offline:** Los eventos de sincronización offline ingresan con el flag `is_offline_sync: true`, permitiendo saldo negativo transitorio en `inventory_levels` y generando automáticamente una alerta de auditoría y ajuste de inventario por faltante.

---

### DESAFÍO 4: Esquema DDL y Renovación de Resoluciones DIAN

#### 4.1 Defecto de Clave Única en `dian_resolutions`
- **Observación en DDL del Plan:**
  `CREATE TABLE dian_resolutions ( ... prefix VARCHAR(10) NOT NULL, ... UNIQUE(organization_id, prefix) );`
- **Escenario de Falla:**
  Las empresas en Colombia renuevan periódicamente sus resoluciones de facturación ante la DIAN conservando el mismo prefijo (ej. prefijo `FE` para rango 1-10.000 en 2024, y el mismo prefijo `FE` para rango 10.001-30.000 en 2026).  
  El constraint `UNIQUE(organization_id, prefix)` impide insertar la nueva resolución a menos que se elimine o altere el prefijo de la anterior, destruyendo la integridad referencial histórica.
- **Mitigación Mandatoria:**
  Cambiar la restricción de unicidad a:
  `UNIQUE(organization_id, prefix, resolution_number)` y agregar un índice parcial para resoluciones activas:
  `CREATE UNIQUE INDEX idx_active_dian_res ON dian_resolutions(organization_id, prefix) WHERE is_active = true;`

---

#### 4.2 Concurrencia en `journal_entries.entry_number`
- **Observación en DDL del Plan:**
  `entry_number INTEGER NOT NULL, UNIQUE(organization_id, entry_number)`
- **Escenario de Falla:**
  Si múltiples microservicios (Facturación, Pagos, Nómina) intentan insertar asientos concurrentemente, se generarán colisiones de clave única a menos que se implemente una secuencia atómica o un generador pesimista similar al de facturas.
- **Mitigación Mandatoria:**
  Utilizar una función de asignación de comprobante contable atómica (`get_next_journal_entry_number`) o `BIGSERIAL` por organización utilizando secuencias aisladas.

---

## 3. RESULTADOS DE PRUEBAS EMPÍRICAS Y SIMULACIONES

Se construyó y ejecutó el arnés de verificación (`scratch/test_adversarial_matrix.py`) obteniendo los siguientes resultados formales:

1. **Simulación de Contrasientos con Retenciones Múltiples:**
   - Venta original: Subtotal $10.000.000 + IVA 19% ($1.900.000) - Retefuente 2.5% ($250.000) - ReteIVA 15% ($285.000) - ReteICA 0.966% ($96.600).
   - Total Débitos Originales: $11.900.000 | Total Créditos Originales: $11.900.000 (Balance: 0).
   - Contrasiento Compensatorio Generado: Inversión 100% simétrica en 6 líneas.
   - Total Débitos Contrasiento: $11.900.000 | Total Créditos Contrasiento: $11.900.000 (Balance: 0).
   - **Resultado:** **Aprobado matemáticamente**, condicionado a que las líneas usen el `unit_cost` original congelado.

2. **Simulación de Consulta de Expiración de Lease en Outbox Poller:**
   - Escenario: 10 eventos pendientes, 3 eventos con `status = 'PROCESSING'` cuyo worker murió hace 15 minutos (`locked_until < NOW()`).
   - Query antigua del plan (`WHERE status IN ('PENDING', 'FAILED')`): Seleccionó solo 10 eventos (3 eventos zombie perdidos).
   - Query corregida (`WHERE status IN ('PENDING', 'FAILED') OR (status = 'PROCESSING' AND locked_until < NOW())`): Seleccionó los 13 eventos completos.
   - **Resultado:** **Demostración empírica de corrección de falla**.

3. **Simulación de Matriz de Regímenes Tributarios:**
   - Caso Proveedor Régimen Simple: Retención esperada = $0. (El modelo corregido arrojó $0 vs retención errónea en modelo simple).
   - Caso Proveedor Responsable IVA sobre base 27 UVT ($1.270.755): Subtotal $2.000.000 -> Retefuente 2.5% ($50.000), ReteICA 0.966% ($19.320).
   - **Resultado:** **Aprobado con la matriz de regímenes corregida**.

---

## 4. LISTA DE CAMBIOS REQUERIDOS (ACTIONABLE PATCHES)

Para que `IMPLEMENTATION_PLAN.md` reciba la aprobación final, deben incorporarse las siguientes modificaciones concretas:

1. **Sección 4.1 y 4.2 (Outbox & DIAN Resilience):**
   - Incorporar paso de reconciliación idempotente con `GetStatus` ante errores de duplicidad antes de ejecutar transacciones compensatorias.
   - Corregir el índice y la consulta del poller Outbox para incluir eventos con arriendo expirado (`status = 'PROCESSING' AND locked_until < NOW()`).
2. **Sección 5.1 y 14 (DDL Resoluciones y Consecutivos):**
   - Reemplazar `UNIQUE(organization_id, prefix)` por `UNIQUE(organization_id, prefix, resolution_number)` y un índice único condicional `WHERE is_active = true`.
   - Incorporar generador atómico para `journal_entries.entry_number`.
3. **Sección 6.1 y 6.2 (Contrasientos y Notas Crédito):**
   - Documentar la regla de inmutabilidad del costo unitario histórico en el Kardex (`unit_cost` congelado).
   - Agregar la matriz de comportamiento por código de concepto DIAN (Concepto 1: Restock parcial, Concepto 2: Restock total + Pasivo 2805 si pagada, Concepto 3: CERO restock, Concepto 4: Financiero).
4. **Sección 12.3 (Asistente Tributario y Retenciones):**
   - Agregar la tabla DDL `tax_configurations` con versionamiento anual de UVT y la regla de exoneración para proveedores en `REGIMEN_SIMPLE` (Art. 911 E.T.) y `AUTORRETENEDORES`.
5. **Sección 12.4 (Conciliación Bancaria):**
   - Añadir soporte para conciliación de liquidaciones agrupadas N:1 de pasarelas de pago (Bold/Wompi/Datáfonos) con deducción automática de comisión MDR.
   - Añadir campos de exención de 4x1000 en `bank_accounts`.
6. **Sección 12.1 (POS Offline):**
   - Especificar el mecanismo de asignación pre-particionada de rangos consecutivos por terminal POS.
   - Especificar la política de tolerancia a sobregiro temporal de existencias durante la sincronización offline.

---

## 5. CONCLUSIÓN DEL CHALLENGER

El plan maestro `IMPLEMENTATION_PLAN.md` posee una base arquitectural de altísima calidad en cuanto a patrones de diseño modernos (Outbox transaccional, inmutabilidad Append-Only, Zero-Jargon UX, RLS y Merkle Audit). No obstante, los 6 puntos críticos identificados representan riesgos de severidad alta/crítica en escenarios de producción y cumplimiento tributario colombiano.

Emitimos el veredicto formal de **REQUEST_CHANGES**, solicitando que los parches técnicos detallados en este informe sean incorporados al plan maestro.
