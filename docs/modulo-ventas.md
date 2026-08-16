# Módulo de Ventas — Diseño

Seguimiento financiero de la venta, desde la propuesta comercial hasta el
margen realmente obtenido en la ejecución.

Este documento responde tres preguntas:

1. **¿Qué datos hacen falta** para que el seguimiento financiero sea real y no
   una hoja de cálculo con cifras que nadie puede auditar?
2. **¿Cómo entran** las propuestas que hoy viven en `OneDrive\H Plus\Comercial`?
3. **¿Qué cambia en el resto del ERP** cuando existe un módulo de ventas?

---

## 1. La premisa: qué se está vendiendo

HPlus es una fábrica de software. Eso condiciona todo el diseño:

- **El inventario es tiempo de personas.** No hay un costo de mercancía que
  leer de un almacén: el costo unitario hay que *construirlo* desde el salario,
  el factor prestacional y las horas realmente facturables. Si ese número no
  está, el margen es una opinión.
- **El precio es una tarifa por rol**, no un precio por SKU. La misma propuesta
  mezcla tarifas de arquitecto, de desarrollador senior y de junior, y cada una
  tiene una rentabilidad distinta. El margen agregado esconde eso.
- **La venta y la entrega están separadas en el tiempo.** Se cotiza en marzo,
  se ejecuta entre mayo y noviembre y se cobra en cuotas. Facturar, devengar y
  cobrar son tres cosas distintas en tres momentos distintos.
- **El riesgo de sobrecosto es del vendedor** en precio fijo. El margen que se
  firma no es el margen que se obtiene, y la diferencia es la métrica que
  importa.

De ahí sale la decisión estructural del módulo: **el dato mínimo no es la
propuesta, es la línea de propuesta**, con su precio y su costo unitario.

---

## 2. Qué datos se necesitan, y por qué cada uno

### 2.1 Catálogo y precio de venta

| Dato | Sin él no se puede… |
|---|---|
| Ítem (rol, entregable, licencia, infra, reembolsable) | Comparar la misma venta entre clientes. |
| Familia de rol y seniority | Saber qué perfiles se venden bien y cuáles se regalan. |
| Unidad (hora, día, sprint, mes, global) | Comparar líneas heterogéneas. |
| Cuenta PUC de ingreso y de costo | Contabilizar la venta automáticamente. |
| Precio de lista, con vigencia y moneda | Medir cuánto descuento se cedió. |
| **Precio piso** y **descuento máximo** | Tener gobierno de precios en vez de buena voluntad. |
| Marca de reembolsable | Evitar que facturar cloud al costo infle el ingreso y hunda el % de margen. |

El precio de lista importa más de lo que parece: sin él, un descuento del 30%
es invisible. La propuesta se ve “rentable al 32%” y nadie nota que se cedió un
tercio del precio.

### 2.2 Costo — la mitad que casi siempre falta

El costo hora no se captura, **se construye**:

```
costo mensual cargado = salario base × factor prestacional + herramientas
costo hora            = costo mensual cargado ÷ horas productivas del mes
```

- **Factor prestacional** (Colombia): salud, pensión, ARL, SENA, ICBF, caja,
  cesantías, intereses, prima y vacaciones. Típico **1.45 – 1.55**.
- **Horas productivas**: no son 160. Descontando vacaciones, capacitación,
  preventa y administración quedan **140 – 160**. Usar 160 subestima el costo
  entre 12% y 15%, que es justo el rango donde vive el margen de una fábrica.

Cada tarifa de costo se guarda **con vigencia**, y la línea de propuesta guarda
el costo con el que se cotizó. Así, cuando el margen real se desvía, se puede
separar *“subieron los salarios”* de *“nos demoramos más de lo previsto”*.

### 2.3 Pipeline

Etapa, probabilidad, valor esperado, margen esperado, fecha de cierre, origen,
responsable y **motivo de pérdida**. Además, historial de cambios de etapa: sin
él no hay ciclo de venta ni tasa de conversión por etapa, solo una foto.

El motivo de pérdida es el dato que más se omite y el que más enseña. Perder
por precio y perder por plazo de entrega exigen decisiones opuestas.

### 2.4 Propuesta

**Versionada e inmutable.** Renegociar crea la versión 2; no edita la 1. Esa es
la única forma de medir cuánto margen se cede en la negociación, que en
servicios profesionales suele ser la mayor fuga de rentabilidad.

*Cabecera:* cliente, moneda y **TRM congelada**, modalidad de contratación,
plazo de pago, anticipo, cláusula de indexación (IPC/IPP/SMLV), garantía,
contingencia, fechas estimadas y trazabilidad al archivo de origen.

Congelar la TRM permite después separar la desviación de margen por tipo de
cambio de la desviación por ejecución. Son problemas de dueños distintos.

*Línea* — el corazón del módulo:

```
cantidad · unidad · horas equivalentes
precio de lista → descuento → precio unitario
costo directo unitario + costo indirecto unitario
= margen unitario, % de margen, factor precio/costo, realización de precio
agrupado por frente / fase / entregable / sprint
```

Estos derivados viven en **columnas `GENERATED` de Postgres**: el margen no
puede desincronizarse del precio y el costo que lo produjeron, ni siquiera si
alguien escribe directo en la base.

*Supuestos y escenarios:* qué factor prestacional, qué TRM, qué horas por mes,
qué contingencia — **con la celda del modelo de donde salió cada uno**. Revisar
una propuesta de hace seis meses sin esto es arqueología. Y los escenarios
Base/Optimista/Conservador se guardan los tres, para después saber contra cuál
se ejecutó realmente.

### 2.5 Contrato y ejecución

| Dato | Para qué |
|---|---|
| Líneas congeladas al ganar | Línea base de margen, inmune a ediciones posteriores. |
| Hitos de facturación | Cada hito es una factura futura y una entrada de caja proyectada. |
| Calendario de reconocimiento | Separar lo devengado de lo facturado. |
| **Horas reales cargadas** | Convertir el margen presupuestado en margen real. |
| Marca de hora no facturable + motivo | Aislar retrabajo, garantía y sobrecosto de alcance. |
| Adiciones (change orders) | Distinguir “creció el alcance” de “nos equivocamos al estimar”. |

Sin horas cargadas contra el proyecto, el seguimiento de margen es ficción: se
tendría el precio vendido y ningún costo con qué compararlo.

---

## 3. La cascada de margen

Un solo “% de margen” no sirve para decidir. El módulo calcula siete niveles:

| # | Nivel | Cálculo | Qué decide |
|---|---|---|---|
| 1 | Valor a precio de lista | cantidad × precio lista | Cuánto valía la venta. |
| 2 | − Descuento comercial | | Cuánto se cedió negociando. |
| 3 | **= Ingreso neto** | | La cifra del contrato. |
| 4 | − Reembolsables al costo | | |
| 5 | **= Ingreso propio** | | La base correcta para juzgar rentabilidad. |
| 6 | − Costo directo de entrega | horas × costo hora cargado + subcontratos | **Margen bruto (C1).** |
| 7 | − Overhead de estructura | | **Margen operativo del proyecto.** |

El paso 4-5 es el que más se omite. Facturar la infraestructura cloud al costo
sube el ingreso sin aportar un peso de margen: el porcentaje cae y la operación
no ha empeorado en nada. El módulo reporta **las dos tasas**, sobre ingreso
total y sobre ingreso propio.

*Ejemplo real del caso de prueba:* 46,86% sobre ingreso total, **52,59% sobre
ingreso propio**. Casi seis puntos de diferencia por una sola línea de cloud.

### Métricas unitarias

- **Margen unitario** = precio unitario − costo directo unitario.
- **Factor precio/costo** — en servicios se lee más rápido que el porcentaje:
  `3.0x ≈ 67% de margen`. Un rol a `1.5x` está prácticamente regalado.
- **Realización de precio** = precio neto ÷ precio de lista. Cuánto sobrevivió
  a la negociación.
- **Ingreso por hora vendida** y **margen por hora** — la única forma honesta de
  comparar propuestas de tamaño y alcance distintos.

---

## 4. Indicadores de seguimiento

### Pipeline
Valor ponderado por probabilidad, cobertura contra la meta del período, tasa de
conversión por etapa, ciclo de venta, tamaño promedio, tasa de éxito y
distribución de motivos de pérdida.

### Precio
Descuento promedio, realización de precio, **dispersión de tarifas por rol**
(el mismo perfil vendido a dos clientes con 40% de diferencia es una señal), y
porcentaje de líneas por debajo del piso.

### Margen
Margen plan contra real por contrato, cliente, rol y entregable; margen por
hora; y **deterioro de margen**: lo prometido al vender menos lo que hoy se
espera ganar.

### Ejecución
- **Costo estimado a terminación (EAC)** = costo real ÷ % de avance.
  Un proyecto al 40% que ya gastó el 60% del presupuesto no se recupera solo.
- **Índice de desempeño de costo (CPI)** — por debajo de 1.0 hay sobrecosto.
- **Fuga de margen**, desagregada en sobrecosto de alcance, horas no
  facturables e ingreso no realizado. Tres causas, tres responsables distintos.

### Caja y cartera
Backlog contratado no facturado, hitos vencidos sin facturar, fecha esperada de
caja por hito (fecha del hito + plazo de pago) y DSO por cliente.

### Cliente
Concentración (participación de los tres mayores), margen por cliente, ingreso
recurrente anual y recompra.

---

## 5. Impacto transversal en el ERP

La decisión que convierte a Ventas en un módulo transversal y no en una isla:
**una dimensión `projects` (y `cost_centers`) propagada a todo el ERP.**

La migración agrega `project_id` a `journal_lines`, `invoice_lines`, `invoices`,
`payroll_lines`, `bank_movements` y `voucher_lines`, y `cost_center_id` a
`journal_lines`. A partir de ahí, cualquier transacción del sistema se puede
leer por proyecto.

| Módulo | Qué recibe de Ventas | Qué le devuelve |
|---|---|---|
| **Terceros** | Segmento, carpeta comercial, lista de precios por defecto, cliente desde. | El tercero formal con NIT al que se amarra el contrato. |
| **Facturación** | Cada hito es una factura pre-armada: cliente, monto, fecha, líneas y cuentas PUC. `invoice_lines` gana `contract_line_id`, `milestone_id` y `unit_cost`. | La factura emitida cierra el hito y aporta el ingreso real. |
| **Cartera** | Fecha esperada de cobro por hito y plazo pactado por contrato. | DSO y comportamiento de pago por cliente, que retroalimenta el plazo a ofrecer en la siguiente propuesta. |
| **Tesorería** | Pronóstico de caja: backlog de hitos + plazo de pago. Deja de ser una proyección a ojo. | Cobros reales que cierran los hitos. |
| **Nómina** | Consume el costo hora que Ventas usó para cotizar. | El salario real y el factor prestacional que **construyen** ese costo hora. Es la relación más importante del módulo. |
| **Contabilidad** | Reconocimiento por avance: ingreso devengado, obra en curso (activo) e ingreso diferido (pasivo). Asientos etiquetados por proyecto y centro de costo. | Costo real contabilizado que alimenta el margen real. |
| **Reportes** | Estado de resultados **por proyecto y por cliente**, no solo consolidado. Backlog y pipeline como reportes de gestión. | — |
| **Cierre contable** | Corte de reconocimiento de ingreso: qué se devengó en el período. | Períodos bloqueados que impiden reabrir un margen ya cerrado. |
| **DIAN** | El hito facturado alimenta la factura electrónica sin recapturar nada. | CUFE y estado de validación. |
| **RBAC** | Módulos `ventas` y `proyectos` con permiso de aprobación separado: quien cotiza no es quien autoriza un descuento. | — |
| **Auditoría** | Cambio de estado, aprobación de precios y cierre de propuesta ganada quedan registrados. | — |

### El punto de articulación: `winProposal()`

Ganar una propuesta es una sola operación que, en cadena:

1. Crea el **proyecto** con la línea base de ingreso, costo, horas y margen.
2. Crea el **contrato** y lo vincula a la propuesta ganadora.
3. **Congela las líneas** como `sales_contract_lines` — el baseline contra el
   que se medirá todo el deterioro.
4. Genera el **plan de hitos** según la modalidad (anticipo, avances o períodos,
   más liberación de retención en garantía).
5. Cierra la oportunidad y **retira las demás versiones**, para que no sigan
   contando en el pipeline ni en los promedios de margen.

A partir de ese momento, el número que se vendió es el mismo que aparece en
Facturación, Cartera, Tesorería y Contabilidad. No se vuelve a teclear.

---

## 6. Ingesta desde la carpeta Comercial

**Restricción de partida:** `C:\Users\ccarvajalino\OneDrive\H Plus\Comercial`
está en la máquina del comercial y el ERP corre en un servidor. El servidor no
puede leer esa ruta. La ingesta se resuelve con un sincronizador local
(`tools/sales-sync`) que lee, normaliza y publica por HTTP.

**Principio rector: el parser nunca inventa un dato.** Lo que no encuentra queda
nulo, baja la confianza de la extracción y, si cae bajo el umbral, la propuesta
entra al ERP marcada como `needs_review`. Un margen calculado sobre un costo
inventado es peor que no tener el dato, porque parece confiable.

Tres estrategias de extracción, de mayor a menor fidelidad:

| Estrategia | Confianza | Cuándo |
|---|---|---|
| Hoja `ERP_EXPORT` | 100% | **Recomendada.** HPlus controla sus plantillas: añadir esta hoja al modelo elimina toda ambigüedad. |
| Perfil de mapeo | 85% | Modelos heredados que no se van a rehacer. Se declara en qué hoja, fila y columna vive cada campo. |
| Heurística | ≤45% | Último recurso. Detecta encabezados por sinónimos en español y entiende el formato de miles colombiano. Siempre marca para revisión. |

Además lee los **rangos con nombre `HPLUS_*`** como supuestos trazables, con la
celda de origen. Es la vía más limpia para que un modelo declare su factor
prestacional, su TRM o sus horas productivas.

**Idempotencia por SHA-256** del contenido: reejecutar el sincronizador no
duplica nada; un archivo modificado produce un hash nuevo y, por tanto, una
versión nueva de la propuesta.

Detalle operativo completo en [`tools/sales-sync/README.md`](../tools/sales-sync/README.md).

---

## 7. Gobierno de precios

Cuatro reglas se evalúan al guardar o importar una propuesta:

| Regla | Severidad | Disparador |
|---|---|---|
| Precio bajo el piso de la lista | Bloqueo | `unit_price < floor_price` |
| Descuento sobre el máximo autorizado | Bloqueo | `discount_rate > max_discount_rate` |
| Precio por debajo del costo directo | Bloqueo | La línea pierde dinero. |
| Margen de la propuesta bajo el mínimo | Bloqueo | Por defecto 40%. |
| Margen de línea bajo el mínimo | Advertencia | Por defecto 25%. |
| Línea sin costo unitario | Advertencia | El margen reportado no es real. |

Un bloqueo enciende `requires_approval`, y **una propuesta no puede marcarse
como ganada sin aprobación**. El permiso de aprobar es distinto del de escribir:
quien cotiza no autoriza su propio descuento.

---

## 8. Puesta en marcha

1. Ejecutar `sql/ventas_module.sql` en el editor SQL de Supabase. Es idempotente
   y se puede volver a correr cuando el esquema evolucione.
2. Opcional: `sql/ventas_module_smoke_test.sql` en una base de prueba, para ver
   el módulo funcionando de punta a punta con datos de ejemplo.
3. Cargar el catálogo real de roles (el script deja un catálogo de referencia
   que **hay que ajustar a HPlus**) y las tarifas de costo vigentes.
4. Definir la lista de precios con precio de lista, piso y descuento máximo por
   rol. Sin esto no hay gobierno de precios.
5. Configurar `SALES_IMPORT_TOKEN` y `SUPABASE_SERVICE_ROLE_KEY` en el servidor.
6. Correr el sincronizador en `--dry-run` sobre la carpeta Comercial y revisar
   el manifiesto antes de publicar.
7. Emparejar las carpetas de cliente con los terceros (campo
   `third_parties.commercial_folder`) para que la ingesta los reconozca sola.

---

## 9. Límites conocidos de esta entrega

- **Los datos semilla son de referencia, no de HPlus.** El catálogo de roles y
  la lista de precios traen valores de ejemplo que hay que reemplazar antes de
  operar. El módulo no puede calcular márgenes reales con tarifas inventadas.
- **Solo uno de los tres arquetipos de modelo financiero es importable.** El
  parser se validó contra tres modelos reales de HPlus. El que cotiza por rol
  con tarifa de venta y costo interno se extrae completo y cuadra al peso con
  los totales que el propio modelo declara. Los otros dos no: un modelo de
  costeo que fija el precio a nivel agregado no tiene margen unitario que
  extraer, y un caso de negocio TCO del cliente no es una propuesta. El
  sincronizador lo dice en vez de inventar líneas — pero significa que parte de
  la carpeta Comercial no se cargará sola hasta que esos modelos incorporen una
  tarifa de venta por línea. Detalle en `tools/sales-sync/README.md`.
- **La carga de horas reales no tiene UI todavía.** La tabla
  `project_time_entries` y todo el cálculo de margen real están listos, pero
  las horas deben entrar por importación o por API mientras se construye la
  pantalla. Sin horas, el seguimiento plan-contra-real queda vacío.
- **La generación automática de la factura desde el hito** está modelada
  (`milestone.invoice_id`, `invoice_lines.milestone_id`) pero no implementada:
  hoy el hito se marca como facturado a mano.
- **El reconocimiento de ingreso no genera el asiento contable** todavía. La
  tabla `sales_revenue_schedule` tiene el campo `journal_entry_id` previsto y
  el cálculo está en `calculateRevenueRecognition()`, pero el asiento de obra en
  curso / ingreso diferido aún se registra manualmente.
