# sales-sync

Carga las propuestas comerciales y los modelos financieros de la carpeta
**Comercial** hacia el módulo de Ventas del ERP.

El ERP corre en un servidor y la carpeta vive en OneDrive, en la máquina de
quien vende. No hay forma de que el servidor lea esa ruta, así que la ingesta
la ejecuta este sincronizador **en la máquina que sí tiene la carpeta**.

Los archivos nunca se modifican ni se suben: se leen, se normalizan y se envía
al ERP el resumen estructurado más el SHA-256 de cada archivo.

## Instalación

Requiere Node 20 o superior.

```
cd tools\sales-sync
npm install
```

## Uso rápido (doble clic)

| Archivo | Qué hace |
|---|---|
| `revisar.bat` | Recorre la carpeta y escribe `manifiesto.json`. **No toca el ERP.** |
| `publicar.bat` | Publica en el ERP. Pide la URL y el token si no están en variables de entorno. |

Ambos instalan las dependencias solos la primera vez. Si tu carpeta Comercial
está en otra ruta, ábrelos con el Bloc de notas y corrige la línea `set "CARPETA=..."`.

## Uso por línea de comandos

Primero, en seco, para ver qué se detectó sin escribir nada en el ERP:

```
node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" ^
              --dry-run --out manifiesto.json --verbose
```

Revisa `manifiesto.json`. Trae, archivo por archivo, las líneas extraídas, los
supuestos, los escenarios y un porcentaje de confianza. Cuando cuadre:

```
set HPLUS_SALES_TOKEN=<el token de ingesta>
node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" ^
              --api https://tu-erp --token %HPLUS_SALES_TOKEN%
```

### Opciones

| Opción | Para qué |
|---|---|
| `--root <ruta>` | Raíz de la carpeta Comercial. Obligatoria. |
| `--api <url>` | URL base del ERP. |
| `--token <token>` | Token de ingesta. Por defecto lee `HPLUS_SALES_TOKEN`. |
| `--dry-run` | No publica; escribe el manifiesto y termina. |
| `--out <archivo>` | Ruta del manifiesto en dry-run. |
| `--client <nombre>` | Procesa solo la carpeta de ese cliente. |
| `--since <YYYY-MM-DD>` | Solo archivos modificados desde esa fecha. |
| `--config <archivo>` | Perfiles de mapeo y umbrales. |
| `--verbose` | Detalle archivo por archivo. |

## Convención de carpetas

```
Comercial/
  <Cliente>/              <- el primer nivel es el cliente
    <lo que sea>/
      Modelo Financiero ... v2.1 2026-03-14.xlsx    <- de aquí salen los números
      Propuesta Comercial ... v2.1.docx             <- se registra como documento
```

- La carpeta de primer nivel se toma como cliente y se intenta emparejar con un
  tercero existente. **No se crean terceros**: dar de alta un cliente exige NIT
  y régimen tributario, no el nombre de una carpeta.
- Del nombre del archivo se extraen la **versión** (`v2`, `V2.1`, `rev3`) y la
  **fecha** (`2026-03-14`, `20260314`, `14-03-2026`).
- Se ignoran las carpetas `Archivo`, `Papelera`, `Obsoleto`, `Old`, `Backup`,
  `Plantillas`, `Temp` y `Descartado`, y los temporales de Office (`~$...`).
- Los archivos sueltos en la raíz se omiten con aviso: no tienen cliente.
- Solo la hoja de cálculo del grupo aporta líneas. El `.docx`/`.pdf`/`.pptx` que
  la acompaña se registra con su hash para trazabilidad, sin inventarle números.

## Cómo se extraen los datos

Tres estrategias, de mayor a menor fidelidad. Se usa la primera que funcione.

### 1. Hoja `ERP_EXPORT` — recomendada, confianza 100%

Añade esta hoja a la plantilla de modelo financiero de HPlus. Encabezados en la
fila 1, datos desde la fila 2:

| Columna | Obligatoria | Notas |
|---|---|---|
| Concepto | sí | Descripción de la línea. |
| Rol | | Familia de rol (`DESARROLLO`, `ARQUITECTURA`…). |
| Nivel | | Junior / Semi Senior / Senior / Staff / Principal. |
| Cantidad | sí | |
| Horas | | Horas equivalentes. Sin esto no hay margen por hora. |
| Unidad | | Hora, Día, Sprint, Mes, Unidad, Global. |
| Tarifa lista | | Precio antes de descuento. Si falta, se asume igual al ofrecido. |
| Descuento | | `15%` o `15`. |
| Precio unitario | sí | El precio efectivamente ofrecido. |
| Costo hora | | **Sin costo no hay margen.** La propuesta entra marcada para revisión. |
| Overhead | | Costo indirecto imputado a la unidad. |
| IVA | | Por defecto 19%. |
| Reembolsable | | `Si` para costos facturados al costo (cloud, viajes). |

Hoja opcional `ERP_ESCENARIOS` con columnas `Escenario`, `Probabilidad`,
`Ingreso`, `Costo directo`, `Costo indirecto`, `Margen`, `Horas`, `VPN`, `TIR`,
`Payback`.

Y **rangos con nombre** que empiecen por `HPLUS_` para los supuestos, que quedan
guardados con la celda de origen para poder auditar el precio después:
`HPLUS_FACTOR_PRESTACIONAL`, `HPLUS_HORAS_PRODUCTIVAS`, `HPLUS_TRM`,
`HPLUS_CONTINGENCIA`, `HPLUS_ANTICIPO`, `HPLUS_PLAZO_PAGO`, `HPLUS_MONEDA`,
`HPLUS_CLIENTE`, `HPLUS_MODALIDAD`.

### 2. Perfil de mapeo — confianza 85%

Para modelos heredados que no se van a rehacer. Copia
`sales-sync.config.example.json` a `sales-sync.config.json` y declara en qué
hoja, fila y columna vive cada campo. Las columnas se pueden referenciar por
título o por letra.

### 3. Heurística — confianza 45% o menos

Último recurso. Busca la fila de encabezados por sinónimos en español
(`Actividad`, `Perfil`, `Cant.`, `Tarifa`, `Costo unitario`…), entiende el
formato de miles colombiano (`$ 1.234.567,89`) y los paréntesis contables.
Las propuestas así extraídas entran al ERP marcadas **para revisión** y no
contaminan los indicadores hasta que alguien las valide.

## Qué pasa con los modelos reales de HPlus

El parser se probó contra tres modelos reales. Salieron tres arquetipos, y no
todos son importables — por buenas razones:

### 1. Modelo de venta por rol (HypnosAI) — se importa completo

Una tabla con `Rol | Horas | Tarifa venta | Costo interno`. Es el caso ideal:
trae los dos lados del margen en la misma fila.

El parser lo extrae con **77% de confianza** y los totales cuadran al peso con
los que el propio modelo declara en su hoja de margen: 1.750 h, $290.600.000 de
venta, $153.050.000 de costo, 47,33% de margen bruto.

Si el precio está en una hoja (`CAPEX_Implementacion`) y el costo en otra
(`Margen_HPlus`), el sincronizador las cruza solo, emparejando por nombre de rol.

### 2. Modelo de costeo sin precio por línea (Presupuesto Plataforma) — no se importa

Costea por `Rol | Headcount | Salario | Dedicación por fase | Costo total`, y
el precio se fija después a nivel agregado aplicando un margen objetivo
(20% CAPEX / 25% OPEX) en una hoja simuladora.

**No hay precio de venta por línea, así que no hay margen unitario que extraer.**
El sincronizador lo dice explícitamente en vez de inventarlo: importar el costo
como si fuera precio daría márgenes de cero y contaminaría todos los indicadores.

Para que entre: añade una columna de tarifa de venta por rol al modelo, o
cotiza las líneas directamente en el ERP usando las tarifas de la lista de precios.

### 3. Caso de negocio / TCO del cliente (PLATEA) — no es una propuesta

Un modelo de costo total de propiedad a 10 años, en USD, con la plantilla de
personal del *cliente*. No es una oferta de HPlus con precios de venta.

El sincronizador lo registra como documento con su hash, para trazabilidad,
pero no fabrica líneas de propuesta. Es el comportamiento correcto: un caso de
negocio no pertenece al pipeline de márgenes.

### La recomendación

Añade la hoja `ERP_EXPORT` a la plantilla de modelo financiero. Con ella la
extracción sube a 100% y deja de depender de dónde quedó cada tabla. Mientras
tanto la heurística cubre bien el arquetipo 1, que es el que se vende.

## Idempotencia

Cada archivo se identifica por el SHA-256 de su contenido. Reejecutar el
comando sobre la misma carpeta no duplica nada. Si el archivo cambió, su hash
cambia y se registra como una versión nueva de la propuesta.

## Configuración del servidor

El ERP necesita estas variables:

```
SALES_IMPORT_TOKEN=<el mismo token que usa el CLI>
SUPABASE_SERVICE_ROLE_KEY=<clave de servicio de Supabase>
```

El token viaja como `Authorization: Bearer` y se compara en tiempo constante.
La clave de servicio solo la usa la ruta de ingesta, que no tiene sesión de
usuario; nunca se expone al navegador.
