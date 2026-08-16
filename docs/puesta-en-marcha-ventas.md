# Puesta en marcha del módulo de Ventas

Guía operativa, en orden. Los pasos 1 a 4 son el camino para **usar** el
módulo. El paso 5 es limpieza de deuda técnica y no bloquea nada: puede
esperar semanas sin consecuencias.

Todo lo que sigue se ejecuta en tu máquina Windows, dentro del repositorio.

```powershell
cd C:\ruta\donde\clonaste\HplusContable
git pull
git checkout claude/sales-module-financial-tracking-vx5r4s
```

---

## Paso 1 — Crear las tablas en Supabase  ·  ~10 min

Sin esto la pantalla `/ventas` no tiene de dónde leer.

1. Entra a tu proyecto en Supabase y abre el **SQL Editor**.
2. Abre `sql/ventas_module.sql` del repositorio, copia **todo** el contenido y
   pégalo en una consulta nueva.
3. Ejecútalo.

**Qué esperar:** varios avisos `NOTICE: policy ... does not exist, skipping`.
Son normales y esperados. Lo que no debe aparecer es ningún `ERROR`.

**Es seguro repetirlo.** El script está escrito para poder re-ejecutarse
cuando el esquema evolucione, sin duplicar ni perder datos.

Para confirmar que quedó bien, ejecuta esto en el mismo editor:

```sql
select count(*) as tablas
from information_schema.tables
where table_schema = 'public'
  and (table_name like 'sales_%' or table_name in ('projects','cost_centers','project_time_entries'));
```

Debe devolver **20**.

---

## Paso 2 — Cargar tus tarifas reales  ·  el paso que más te toma

Este es trabajo tuyo, no del código, y es el que determina si los márgenes que
verás son reales o ficción. El script dejó un catálogo de roles y una lista de
precios **de ejemplo** que hay que reemplazar.

Son tres tablas, en este orden:

### 2.1 `sales_items` — qué vendes

Ya trae 16 ítems de referencia. Revisa que los `role_family` y `seniority`
coincidan con cómo nombras tú los perfiles en los modelos financieros, porque
por ese nombre se emparejan las líneas al importar.

### 2.2 `sales_cost_rates` — cuánto te cuesta cada perfil

La tabla más importante. Sin ella no hay margen que valga.

```sql
insert into sales_cost_rates
  (item_id, role_family, seniority, currency, cost_type,
   base_monthly_salary, benefits_factor, productive_hours_month,
   tooling_cost_month, hourly_cost, overhead_rate, valid_from)
select
  i.id, i.role_family, i.seniority, 'COP', 'INTERNO',
  13000000,   -- salario base mensual del perfil
  1.52,       -- factor prestacional (el de tu modelo de Desempeño)
  152,        -- horas facturables reales al mes, no 160
  400000,     -- herramientas y licencias por persona/mes
  round((13000000 * 1.52 + 400000) / 152, 4),  -- costo hora resultante
  12,         -- overhead de estructura (%)
  date '2026-01-01'
from sales_items i
where i.code = 'ROL-PM-SR';
```

Repite por cada rol con sus cifras. El `hourly_cost` sale de la fórmula, no lo
inventes: es lo que hace auditable el margen.

> Tu modelo de HypnosAI ya trae los costos internos por hora en la hoja
> `Supuestos`. Esos números son el mejor punto de partida.

### 2.3 `sales_price_lists` — a cuánto lo vendes

Ya existe la lista `LP-COP-2026`. Falta llenarla, y sobre todo definir el
**piso** y el **descuento máximo**: sin eso no hay gobierno de precios y
cualquier descuento pasa sin que nadie lo mire.

```sql
insert into sales_price_list_items (price_list_id, item_id, list_price, floor_price, max_discount_rate)
select l.id, i.id, 160000, 130000, 15
from sales_price_lists l, sales_items i
where l.code = 'LP-COP-2026' and i.code = 'ROL-PM-SR';
```

### 2.4 Vincula tus clientes con sus carpetas

Para que el sincronizador reconozca solo a quién pertenece cada propuesta:

```sql
update third_parties
set commercial_folder = 'HypnosAI'   -- el nombre exacto de la carpeta
where document_number = '900123456';
```

---

## Paso 3 — Configurar la ingesta  ·  ~5 min

En las variables de entorno del servidor donde corre el ERP (Vercel, o tu
`.env.local` si es local):

```
SALES_IMPORT_TOKEN=<una cadena larga y aleatoria que inventes>
SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Project Settings → API → service_role>
```

La `service_role` salta las políticas RLS. Solo la usa la ruta de ingesta, que
se autentica con el token de arriba. **Nunca debe llegar al navegador.**

---

## Paso 4 — Cargar las propuestas  ·  ~15 min

### 4.1 Revisar sin escribir nada

```powershell
cd tools\sales-sync
npm install
```

Luego doble clic en **`revisar.bat`**, o desde la consola:

```powershell
node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" --dry-run --out manifiesto.json --verbose
```

**Qué esperar:** una línea por archivo con el número de líneas detectadas y un
porcentaje de confianza. Recuerda lo que se verificó con tus tres modelos:

| Tipo de modelo | Resultado |
|---|---|
| Cotiza por rol con tarifa de venta y costo interno | Se importa completo |
| Costea por dedicación y fija el precio al final con un margen objetivo | No se importa, y dice por qué |
| Caso de negocio / TCO del cliente | Se registra como documento, sin líneas |

Abre `manifiesto.json` y revisa que las tarifas y los costos coincidan con tus
modelos antes de seguir.

### 4.2 Publicar

Doble clic en **`publicar.bat`**, o:

```powershell
node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" --api https://tu-erp --token %HPLUS_SALES_TOKEN%
```

**Es seguro repetirlo:** cada archivo se identifica por el hash de su
contenido, así que volver a correrlo no duplica nada.

### 4.3 Verificar en la aplicación

Entra a **Ventas**:

- **Importar** → historial de la carga, con cuántos archivos entraron.
- **Propuestas** → las importadas, con su margen y realización de precio. Las
  que quedaron marcadas **Revisar** son las que el parser no pudo leer con
  certeza: ábrelas y contrasta las líneas contra el modelo original.
- Abre una propuesta: verás la cascada de margen y el detalle unitario por rol.

---

## Paso 5 — Tipar el cliente de Supabase  ·  opcional, cuando quieras

**Esto no bloquea nada.** El build pasa y el módulo funciona sin ello. Es para
eliminar los ~114 `any` que hoy salen como advertencia en cada build.

```powershell
npx supabase login      # abre el navegador, una sola vez
npm run types:gen
```

Si prefieres no iniciar sesión, sirve la cadena de conexión
(Dashboard → Project Settings → Database → Connection string → URI):

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres:TU_PASSWORD@db.fitjpyqrecgvlrlpwipn.supabase.co:5432/postgres"
npm run types:gen
```

No uses `>` ni `Out-File` para redirigir la salida del CLI: PowerShell escribe
UTF-16 y UTF-8 con BOM respectivamente, y las dos dejan el archivo ilegible
para TypeScript. Por eso existe `npm run types:gen`, que lo escribe desde Node.

Haz commit del `src/types/database.ts` generado y avísame: con el esquema real
se puede tipar `createServerClient<Database>` y quitar los `any` de verdad.

---

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `/ventas` da error al cargar | Falta el paso 1, o el usuario no tiene permiso en el módulo `ventas`. |
| Todas las propuestas salen con margen 0 | Falta el paso 2.2: sin costos no hay margen. |
| El sincronizador dice "sin líneas legibles" | El modelo no tiene tarifa de venta por línea. Ver la tabla del paso 4.1. |
| `401` al publicar | `SALES_IMPORT_TOKEN` del servidor no coincide con el del CLI. |
| El CLI no arranca | Falta Node 20+. Instálalo desde nodejs.org. |

Los `.bat` se escribieron sin poder probarlos en Windows. Si alguno falla,
los comandos `node sync.mjs ...` equivalentes están en cada sección.
