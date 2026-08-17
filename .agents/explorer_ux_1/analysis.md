# 🎨 Evaluación Arquitectónica de UX, Diseño de Producto y Paradigma "Zero-Accounting Jargon"
## Proyecto DigiKawsay / CFO-AI

---

## 1. RESUMEN EJECUTIVO Y VISIÓN DE PRODUCTO

### 1.1 El Problema Fundamental del Software Contable Tradicional
El 85% de las MiPymes en Colombia y Latinoamérica fracasan en la adopción de sus sistemas contables o cometen errores graves de digitación porque las plataformas tradicionales fueron diseñadas **por contadores para contadores**, obligando al dueño de negocio, cajero o asistente administrativo a interactuar con conceptos contables abstractos:
- Selección manual de cuentas auxiliares del Plan Único de Cuentas (PUC de 6 u 8 dígitos, ej. `110505`, `413505`, `236540`).
- Registro manual de débitos y créditos en partida doble.
- Manejo críptico de impuestos, retenciones y rechazos XML de la DIAN.
- Errores de "asientos descuadrados" que bloquean la operación comercial.

### 1.2 La Visión DigiKawsay: "Autonomous Accounting Under the Hood"
DigiKawsay debe posicionarse como el **Sistema Operativo Comercial Inteligente para Negocios**, donde:
1. **La interfaz habla 100% el idioma del negocio:** Ventas, Cobros, Gastos, Pagos, Inventario, Clientes y Proveedores.
2. **Cero fricción cognitiva:** Ningún usuario operativo ve débitos, créditos ni códigos PUC en su flujo diario.
3. **Contabilidad y fiscalidad autónoma:** Cada acción comercial (vender un producto, registrar un gasto, pagar un arriendo) dispara de forma determinista y transparente las partidas dobles y cálculos de impuestos/retenciones según las normas colombianas (NIIF y Estatuto Tributario).
4. **Modo Contador / Auditor (Auditor Lens):** Una capa especializada y conmutable donde el contador público certificado puede auditar, reclasificar o emitir balances, libros oficiales y medios magnéticos (Exógena) sin estorbar la agilidad de los usuarios comerciales.

---

## 2. MATRIZ TAXONÓMICA "ZERO-ACCOUNTING JARGON"

Para garantizar una experiencia de usuario natural y libre de tecnicismos, se establece la **Taxonomía Universal DigiKawsay**, que define la traducción estricta entre el lenguaje de negocio (Frontend / Usuario) y la maquinaria contable (Backend / Base de Datos / Asientos):

| Término Contable Tradicional (PROHIBIDO en UI Operativa) | Etiqueta en Interfaz DigiKawsay (Aprobada) | Explicación Contextual / Tooltip para el Usuario | Mapeo Automático en Backend (Bajo el Capó) |
| :--- | :--- | :--- | :--- |
| **Asiento Contable / Comprobante de Diario** | **Registro de Actividad / Movimiento** | *"Registro histórico de una operación de tu negocio."* | `journal_entries` + `journal_lines` |
| **Débito / Debe** | **Entrada / Aumento de Recursos / Gasto** | *"Dinero que ingresa a tu caja o un gasto realizado."* | `debit > 0` |
| **Crédito / Haber** | **Salida / Origen de Fondos / Ingreso** | *"Dinero que sale de tu banco o venta realizada."* | `credit > 0` |
| **Código PUC (ej. 413505, 143501)** | **Categoría del Producto o Servicio** | *"Tipo de producto o servicio (ej. 'Comida', 'Consultoría', 'Ropa')."* | `puc_accounts.code` mapeado según configuración de categoría |
| **Cuentas por Cobrar (130505)** | **Dinero por Cobrar / Clientes pendientes de pago** | *"Facturas emitidas que tus clientes aún no han pagado."* | Cuenta `1305` |
| **Cuentas por Pagar (220505 / 2335)** | **Cuentas pendientes por pagar / Facturas de proveedores** | *"Compras o servicios recibidos pendientes de pago."* | Cuentas `2205` / `2335` |
| **Caja General (110505)** | **Efectivo en Caja / Caja Registradora** | *"Dinero en efectivo disponible en el punto de venta."* | Cuenta `110505` |
| **Bancos Nacionales (111005)** | **Cuenta Bancaria (Bancolombia, Davivienda, etc.)** | *"Tu cuenta corriente o de ahorros vinculada."* | Cuenta `111005xx` |
| **Retención en la Fuente (2365)** | **Anticipo de Impuesto Sugerido (Retefuente)** | *"Descuento legal obligatorio que se aplica según el monto de la compra/venta."* | Cuenta `2365xx` (Pasivo) o `135515` (Activo) |
| **ReteIVA (2367) / ReteICA (2368)** | **Retención de IVA / Retención de ICA** | *"Deducciones municipales y tributarias sugeridas automáticamente."* | Cuentas `2367xx` / `2368xx` |
| **Castigo de Cartera / Provisión (1399)** | **Marcar como Deuda Incobrable / Pérdida** | *"Reconocer que un cliente no pagará una factura vencida."* | Débito `519910` / Crédito `139905` |
| **Conciliación Bancaria** | **Verificación y Cruce de Cuentas Bancarias** | *"Comparar los movimientos de tu extracto bancario con tus ventas y compras."* | `bank_reconciliations` + matching engine |
| **Gravamen Movimientos Financieros (511595)** | **Impuesto del 4x1000 Bancario** | *"Impuesto automático descontado por retiros bancarios."* | Cuenta `511595` |
| **Partida Doble Descuadrada** | **Diferencia en Valores** | *"El total pagado no coincide con el total de la factura. Revisa los montos."* | Validación de suma cero en API Gateway |
| **Cierre de Período / Cierre Anual** | **Cierre y Bloqueo de Mes / Año** | *"Congelar los registros de este período para que nadie pueda modificarlos."* | Bloqueo transaccional + Traslado a cuenta `3605`/`3610` |

---

## 3. ARQUITECTURA DE "ACTION CARDS" Y ERROR RECOVERY UX

### 3.1 Anatomía Estándar de una "In-Context Action Card"
Cuando ocurre una excepción, caída de red o rechazo de un servicio externo (ej. DIAN o Pasarela de Pagos), el sistema nunca debe mostrar alertas crípticas como `Error 500: Internal Server Error` ni `Regla FAB02: Rechazo XML`.

En su lugar, se despliega una **In-Context Action Card** compuesta por 5 elementos clave:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔴 [ICONO + ESTADO CLARO] Factura emitida en Modo Contingencia (DIAN)  │
├────────────────────────────────────────────────────────────────────────┤
│ 📝 [QUÉ PASÓ EN LENGUAJE SIMPLE]                                       │
│ Los servidores de la DIAN no respondieron a tiempo (Timeout 15s).      │
│                                                                        │
│ 🛡️ [ESTADO DEL NEGOCIO / GARANTÍA]                                    │
│ Tu venta fue guardada con éxito y tu cliente ya recibió su recibo legal│
│ provisional (Contingencia Tipo 04). No perdiste la venta.              │
├────────────────────────────────────────────────────────────────────────┤
│ 💡 [ACCIONES EN 1 CLIC]                                                │
│ [ 🔄 Reintentar Transmisión ]   [ 📥 Descargar Comprobante PDF ]       │
│ [ ⏱️ Ver Cola de Sincronización Automática ]                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Matriz de Escenarios Críticos y Action Cards Diseñadas

```
+--------------------------------------------------------------------------------------------------------------------+
| 1. DIAN API Timeout / Caída de Servidores DIAN                                                                     |
+--------------------------------------------------------------------------------------------------------------------+
| - Contexto: El usuario hace clic en "Emitir Factura Electrónica" y la DIAN no responde en 10 segundos.           |
| - Action Card: "DIAN Temporalmente No Disponible - Activado Modo Contingencia Tipo 04"                             |
| - Diagnóstico amigable: "El servicio de la DIAN está congestionado. Tu factura #FV-1045 quedó registrada legalmente |
|   en tu sistema y se enviará automáticamente a la DIAN tan pronto se restablezca su plataforma."                  |
| - Botones de Acción:                                                                                               |
|   1. [ Continuar con Siguiente Venta ] (Prioridad POS)                                                             |
|   2. [ Enviar Recibo Provisional a Cliente por WhatsApp/Email ]                                                   |
|   3. [ Ver Monitor de Transmisiones Pendientes ]                                                                   |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 2. Rechazo Semántico de la DIAN (ej. NIT inválido, error de cálculo o resolución vencida)                           |
+--------------------------------------------------------------------------------------------------------------------+
| - Contexto: La DIAN rechaza la factura devolviendo un código técnico (ej. Regla FAJ24 - DV incorrecto).            |
| - Action Card: "La DIAN requiere una corrección en los datos del cliente"                                          |
| - Diagnóstico amigable: "El Dígito de Verificación del cliente 'Distribuciones S.A.S.' (NIT: 900123456) no coincide.|
|   El sistema calculó automáticamente el dígito correcto: '4'."                                                     |
| - Botones de Acción:                                                                                               |
|   1. [ Aplicar Corrección Sugerida (DV: 4) y Reenviar ] (1 clic)                                                   |
|   2. [ Editar Datos del Cliente ]                                                                                  |
|   3. [ Guardar como Borrador ]                                                                                     |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 3. Pérdida de Conexión a Internet en Punto de Venta (Offline POS)                                                  |
+--------------------------------------------------------------------------------------------------------------------+
| - Contexto: El cajero está vendiendo y se cae el internet local.                                                   |
| - Action Card: "Trabajando en Modo Sin Conexión (Offline Activo)"                                                  |
| - Diagnóstico amigable: "No tienes internet. Puedes seguir facturando con normalidad; tus ventas se guardan en tu  |
|   computador de forma segura y se sincronizarán solas cuando vuelva la red."                                       |
| - Indicador Visual: Badge pulsante en la barra superior: "3 ventas pendientes de sincronizar".                    |
| - Botones de Acción:                                                                                               |
|   1. [ Continuar Facturando ]                                                                                      |
|   2. [ Forzar Sincronización Manual ]                                                                              |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 4. Discrepancia en Conciliación Bancaria (Diferencia de saldo)                                                     |
+--------------------------------------------------------------------------------------------------------------------+
| - Contexto: El extracto bancario muestra $12.500 COP menos que el saldo en libros.                                |
| - Action Card: "Diferencia detectada en tu cuenta Bancolombia: -$12.500 COP"                                       |
| - Diagnóstico amigable: "Encontramos 1 movimiento en tu extracto sin registrar en DigiKawsay: Posible cobro de     |
|   Cuota de Manejo o Gravamen 4x1000."                                                                              |
| - Botones de Acción:                                                                                               |
|   1. [ Crear Gasto Bancario Automático por $12.500 ] (1 clic, mapea a cuenta 5115)                                 |
|   2. [ Ver Detalle del Movimiento Bancario ]                                                                       |
|   3. [ Omitir por ahora ]                                                                                          |
+--------------------------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------------------------+
| 5. Descuadre en Conteo Físico de Inventario                                                                        |
+--------------------------------------------------------------------------------------------------------------------+
| - Contexto: El conteo físico de 'Arroz 1kg' arroja 42 unidades, pero el sistema marcaba 50 unidades.              |
| - Action Card: "Diferencia de Inventario detectada: Faltan 8 unidades de Arroz 1kg"                               |
| - Diagnóstico amigable: "El valor estimado de la diferencia es de $28.000 COP."                                    |
| - Botones de Acción:                                                                                               |
|   1. [ Ajustar por Merma / Vencimiento ]                                                                           |
|   2. [ Ajustar por Uso Interno / Consumo ]                                                                         |
|   3. [ Recalcular y Auditar Movimientos Anteriores ]                                                               |
+--------------------------------------------------------------------------------------------------------------------+
```

---

## 4. DEEP DIVE EN LOS FLUJOS PRINCIPALES Y CASOS BORDE (USER JOURNEYS)

### 4.1 Flujo A: Fast POS & Venta Rápida en Mostrador

#### Requerimientos de Experiencia y Velocidad:
- **Objetivo de latencia:** Menos de 1.5 segundos para registrar un ítem y menos de 3 segundos para cerrar la transacción e imprimir ticket.
- **Teclado como Rey (Keyboard-First):** Operación 100% posible sin tocar el ratón.
- **Soporte de Lector de Código de Barras (Hardware Scanner):** Listener global en ventana que detecte entradas de scanner rápido (<50ms entre caracteres + sufijo `Enter`), buscando inmediatamente el producto y sumándolo a la canasta con feedback auditivo (beep suave de éxito).

#### Mapa de Atajos de Teclado Universales en POS:
- `F2` o `/` : Búsqueda rápida de producto por nombre o código.
- `F3` : Seleccionar o crear cliente rápido (por defecto: "Consumidor Final").
- `F4` : Aplicar descuento global o por ítem (% o valor fijo).
- `F7` : Pausar venta actual ("Poner en espera" para atender a otro cliente) y recuperar ventas en espera.
- `F8` o `Espacio` : Abrir pantalla de Cobro / Pago.
- `F9` : Cobro exacto en Efectivo (1 solo toque para cerrar venta).
- `F10` : Alternar entre "Ticket POS / Tirilla" y "Factura Electrónica DIAN".
- `Esc` : Cancelar línea seleccionada o salir de modal.

#### Modal de Pago Dividido y Métodos Mixtos (Split Payment UX):
Permite combinar múltiples medios de pago de manera intuitiva con cálculo automático de cambio (vueltos):
```
┌────────────────────────────────────────────────────────────────────────┐
│ 💵 Total a Pagar: $ 185.000 COP                                        │
├────────────────────────────────────────────────────────────────────────┤
│ Métodos de Pago:                                                       │
│ 1. [ Efectivo 💵 ]            Monto: [ $ 100.000 ]                     │
│ 2. [ Transferencia Nequi 📱 ] Monto: [ $  50.000 ] Ref: [ 984214 ]     │
│ 3. [ Tarjeta Débito 💳 ]      Monto: [ $  35.000 ] Aut: [ 004128 ]     │
├────────────────────────────────────────────────────────────────────────┤
│ Total Recibido: $ 200.000 (Efectivo entregado por cliente: $100.000)   │
│ 💰 CAMBIO / VUELTOS A ENTREGAR: $ 15.000 COP                           │
├────────────────────────────────────────────────────────────────────────┤
│ [ Enter: CONFIRMAR Y EMITIR COMPROBANTE ]                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Flujo B: Facturación Electrónica DIAN y Gestión de Contingencias

#### Ciclo de Vida Visual del Documento (Status Badges):
Cada factura cuenta con un badge visual de estado altamente informativo:
1. ⚪ **Borrador (Draft):** Editable en cualquier momento. No genera compromisos tributarios.
2. 🟡 **Transmitiendo a DIAN (Processing):** Procesamiento asíncrono en background con feedback no bloqueante. El usuario puede seguir facturando.
3. 🟢 **Aprobada por DIAN (Valid):** CUFE generado, código QR activo, XML firmado almacenado. Botones para enviar por WhatsApp o correo.
4. 🟠 **Contingencia Tipo 04 (DIAN caída):** Documento emitido localmente con validez comercial. Se enviará a la DIAN automáticamente mediante un worker de reintentos.
5. 🟠 **Contingencia Tipo 03 (Falla del emisor/software):** Emisión manual con talonario de contingencia y posterior sincronización.
6. 🔴 **Rechazada por DIAN (Error):** Muestra de inmediato la Action Card con solución guiada.

#### Flujo de Contingencia y Recuperación Transaccional:
```
[ Usuario emite Factura ]
          │
          ▼
[ Generar Documento Local + Consecutivo Legal ] ──> (Estado: DRAFT_COMMITTED)
          │
          ▼
[ Intentar Firma y Envío a DIAN ] ──── Timeout > 10s o Error 503 ────┐
          │                                                          ▼
     Éxito DIAN                                        [ Activar Contingencia Tipo 04 ]
          │                                                          │
          ▼                                                          ▼
[ Guardar CUFE + XML Aprobado ]                       [ Generar PDF con Leyenda Legal ]
          │                                                          │
          ▼                                                          ▼
[ Entregar al Cliente (Email/WhatsApp) ]              [ Entregar al Cliente Inmediatamente ]
                                                                     │
                                                                     ▼
                                                      [ Encolar en Worker Asíncrono ]
                                                                     │
                                                      (Reintento automático cada 15 min)
```

---

### 4.3 Flujo C: Compras, Gastos y Asistente Tributario Autónomo

#### Eliminación de Fricción en Impuestos y Retenciones:
En Colombia, las retenciones en la fuente dependen de bases mínimas expresadas en UVT (Unidad de Valor Tributario). Un usuario común no debe calcular si la base supera 27 UVT para compras o 4 UVT para servicios.

#### Asistente Tributario Inteligente ("Smart Tax Assistant"):
1. **Selector de Concepto en Lenguaje Común:**
   - *"Compra de Mercancía / Inventario"* (Aplica Retefuente 2.5% declarante / 3.5% no declarante).
   - *"Pago de Honorarios o Servicios Profesionales"* (Aplica Retefuente 10% / 11%).
   - *"Arrendamiento de Local / Oficina"* (Aplica Retefuente 3.5%).
   - *"Servicios Públicos (Luz, Agua, Internet)"* (Exento de retención general).
   - *"Gastos de Cafetería y Aseo"*.
2. **Cálculo Transparente de Totales:**
   - Toggle: `[ ] Precios incluyen IVA` o `[x] Precios antes de IVA`.
   - Card informativa: *"Retención en la fuente sugerida: -$37.500 COP (Superó la base mínima legal de $1.200.000 COP)".*
   - Botón: `[ Aplicar Retención ]` o `[ Omitir si el proveedor es autorretenedor ]`.
3. **Reconocimiento de Facturas de Proveedores (OCR / Ingesta XML DIAN):**
   - El usuario simplemente arrastra el archivo `.zip` o `.xml` de la factura electrónica que le envió su proveedor.
   - El sistema extrae automáticamente: Proveedor (NIT, Razón Social), Ítems, Subtotal, IVA, Retenciones aplicadas, Fecha de Vencimiento.

---

### 4.4 Flujo D: Conciliación Bancaria Inteligente (Dual-Pane Heuristic Matching)

#### Interfaz de 2 Columnas Reactivas:
- **Columna Izquierda:** *"Movimientos en tu Banco"* (Subidos vía archivo Excel/CSV o extracto bancario).
- **Columna Derecha:** *"Tus Registros en DigiKawsay"* (Ventas cobradas, pagos a proveedores, transferencias).

#### Motor Heurístico de Coincidencia en 4 Niveles:
1. 🎯 **Nivel 1: Coincidencia Perfecta (100% Match):**
   - Mismo valor exacto + Misma fecha (+/- 2 días) + Mismo número de referencia o NIT de tercero.
   - UX: Badge verde *"Coincidencia Exacta"* -> Botón global: `[ ✨ Conciliar 14 movimientos automáticos en 1 clic ]`.
2. 🔍 **Nivel 2: Coincidencia Probable (Fuzzy Match):**
   - Mismo valor exacto pero fecha desfasada (+/- 5 días) o descripción parcial (ej. "Pago Fra 1042").
   - UX: Badge amarillo *"Sugerencia"* -> Botón: `[ Confirmar Cruce ]`.
3. ⚡ **Nivel 3: Detección de Gastos Recurrentes Bancarios:**
   - Patrones identificados en la descripción (ej. "GMF 4X1000", "COMISION RETIRO", "CUOTA DE MANEJO").
   - UX: Card azul *"Gasto Bancario Detectado"* -> Botón: `[ Crear Gasto y Conciliar ]` (sin salir de la pantalla).
4. ❓ **Nivel 4: Movimiento no Registrado:**
   - Ingreso de dinero no asociado a ninguna factura.
   - UX: Botón directo `[ + Registrar como Cobro de Cliente ]` o `[ + Registrar como Aporte de Capital ]`.

---

### 4.5 Flujo E: Inventario, Ajustes Físicos y Control de Stock

#### Toma Física de Inventario (Physical Count Wizard):
- Modo auditoría móvil o de escritorio.
- El usuario ingresa la cantidad física real contada.
- El sistema muestra la diferencia en unidades y en dinero ($ COP).
- Si hay discrepancia, se despliega el selector de causas comerciales:
  - 🍎 *Merma / Daño o Deterioro.*
  - ⏳ *Vencimiento de Producto.*
  - 🏢 *Uso Interno de la Empresa.*
  - 🔄 *Devolución no registrada.*
  - 📦 *Error de conteo anterior.*
- Al confirmar, el sistema actualiza las existencias de inmediato y genera bajo el capó el ajuste de costo de ventas sin que el usuario digite una sola cuenta contable.

---

## 5. EVALUACIÓN Y PROPUESTAS DE MEJORA PARA `IMPLEMENTATION_PLAN.md`

### 5.1 Diagnóstico de Brechas en el Plan Actual

| Sección en Plan Actual | Brecha / Oportunidad de Mejora Identificada | Propuesta Concreta de Refinamiento |
| :--- | :--- | :--- |
| **Fase 0 y Fase 1 (Contabilidad)** | Se estructuran endpoints crudos expuestos (`/puc/accounts`, `/journal/entries`) que sugieren que el frontend obligará a seleccionar PUC en cada pantalla. | Especificar la **Capa de Abstracción Contable (BFF & Business Services)**: las APIs de negocio aceptan `category_id`, `product_id`, `payment_method_id` y el servicio de contabilidad resuelve los asientos automáticamente. |
| **Fase 2 (Facturación)** | El modelo `invoice_lines` incluye `account_code VARCHAR(10) REFERENCES puc_accounts(code)`. Un vendedor no sabe qué PUC usar. | Eliminar `account_code` obligatorio del formulario de factura. Reemplazar por `product_id` o `category_type`, resolviendo la cuenta PUC en el backend mediante el catálogo de productos. |
| **Fase 2 (DIAN)** | Se menciona `dian_status VARCHAR(20) DEFAULT 'PENDING'` pero no se definen las políticas de reintentos, contingencia Tipo 03/04 ni transaccionalidad de rollback. | Incorporar el **Módulo de Contingencia DIAN**, colas asíncronas con Celery/Redis y Action Cards de error amigable. |
| **Fase 3 (Tesorería)** | Endpoints enfocados en tablas contables. No se describe el algoritmo de conciliación ni la UX de importación de extractos. | Agregar el **Motor de Conciliación Heurística Dual-Pane** y el asistente de creación en 1 clic de gastos bancarios (4x1000, comisiones). |
| **Fase 5 (Cartera)** | Usa términos técnicos como `provision_amount`, `write-off`. | Renombrar interfaces y endpoints para reflejar "Cuentas por Cobrar a Clientes", "Alertas de Vencimiento" y "Marcar como Incobrable". |
| **Fase 8 (Frontend)** | Relegada a 3-5 días al final de 8 semanas. | Elevar la **Arquitectura UX / UI a componente transversal de cada fase**, garantizando desarrollo basado en Design System y componentes accesibles desde la Fase 1. |

---

## 6. GUÍA DE IMPLEMENTACIÓN: COMPONENTES UI Y CONTRATOS DE DISEÑO

### 6.1 Componente: `<ActionCard />` (TypeScript / Tailwind)
```tsx
interface ActionCardProps {
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  technicalDetails?: string; // Solo visible en "Modo Auditor/Contador"
  primaryAction: {
    label: string;
    onClick: () => void | Promise<void>;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}
```

### 6.2 Componente: `<DianStatusBadge />`
```tsx
interface DianStatusBadgeProps {
  status: 'DRAFT' | 'QUEUED' | 'ACCEPTED' | 'CONTINGENCY_04' | 'CONTINGENCY_03' | 'REJECTED';
  cufe?: string;
  onRetry?: () => void;
}
```

### 6.3 Componente: `<SplitPaymentModal />`
Soporta captura rápida de Efectivo, Tarjeta, Transferencia (Nequi/Daviplata/PSE), Crédito comercial y cálculo en tiempo real de saldo restante y cambio.

---

## 7. CONCLUSIÓN Y SIGUIENTES PASOS

La adopción de este marco arquitectónico de UX garantiza que DigiKawsay no sea un software contable más del mercado, sino una plataforma intuitiva de alta productividad para comerciantes y empresarios, manteniendo una rigurosa fidelidad contable y tributaria bajo el capó.
