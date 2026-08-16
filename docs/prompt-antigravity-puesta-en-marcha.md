# Prompt para Google Antigravity

Copia todo el bloque de abajo y pégalo en Antigravity con este repositorio
abierto. Está escrito para que el agente trabaje solo hasta donde puede, y se
detenga donde hace falta una decisión tuya o una credencial.

---

```
Eres un ingeniero de datos y automatización trabajando sobre este repositorio.

## MISIÓN

Poner en marcha el módulo de Ventas del ERP siguiendo `docs/puesta-en-marcha-ventas.md`,
hasta dejar las propuestas comerciales cargadas y con márgenes reales.

## ENTORNO

- Repositorio local, rama `claude/sales-module-financial-tracking-vx5r4s`. Ya está en verde.
- Windows con PowerShell. Node 20+.
- Carpeta comercial: `C:\Users\ccarvajalino\OneDrive\H Plus\Comercial`
  (una subcarpeta por cliente, con propuestas y modelos financieros en Excel).
- Proyecto Supabase: `fitjpyqrecgvlrlpwipn`.
- El sincronizador vive en `tools\sales-sync` y usa ExcelJS.

## REGLAS DURAS

Violar cualquiera de estas invalida el trabajo completo.

1. **Nunca inventes una cifra financiera.** Ni salarios, ni factor prestacional, ni
   horas productivas, ni tarifas, ni costos. Si un dato no está en un archivo o no lo
   da el usuario: DETENTE y pídelo. Un margen calculado sobre un costo inventado es
   peor que no tener el dato, porque parece confiable.
2. **No redirijas salida con `>` ni `Out-File`.** PowerShell escribe UTF-16 y UTF-8
   con BOM respectivamente, y ambas corrompen los archivos de código. Usa los scripts
   de npm del repositorio, que escriben desde Node.
3. **No modifiques código fuente del módulo**: `src/`, `tools/sales-sync/lib/`,
   `sql/ventas_module.sql`. Están verificados. Si detectas un bug, repórtalo en tu
   informe; no lo arregles por tu cuenta.
4. **No publiques nada al ERP sin aprobación explícita** en la compuerta de la Fase 4.
5. **No hagas commit** de manifiestos, credenciales ni nada con precios de clientes.
   Todo eso va a `.local\`, que ya está ignorado por git.
6. **No crees ramas ni pull requests.**

## FASES

Al terminar cada fase, entrega un informe corto y DETENTE en las compuertas marcadas
con [GATE]. No avances sin respuesta del usuario.

### FASE 0 — Diagnóstico (solo lectura)

Verifica y reporta en una tabla:
- Versión de Node y npm.
- Si `npm install` está hecho en la raíz y en `tools\sales-sync`.
- Si la carpeta comercial existe y cuántas subcarpetas de cliente tiene.
- Cuántos archivos `.xlsx`, `.docx` y `.pdf` hay en total.
- Si existen las variables `SALES_IMPORT_TOKEN` y `SUPABASE_SERVICE_ROLE_KEY`.
- Si el módulo de ventas ya está creado en Supabase (si tienes acceso a la base).

[GATE 0] Presenta el diagnóstico y espera confirmación para continuar.

### FASE 1 — Crear las tablas en Supabase

Si tienes una cadena de conexión a la base (`SUPABASE_DB_URL` o similar), ejecuta
`sql/ventas_module.sql` contra ella y luego verifica:

```sql
select count(*) from information_schema.tables
where table_schema='public'
  and (table_name like 'sales_%' or table_name in ('projects','cost_centers','project_time_entries'));
```

Debe devolver 20. Los avisos `NOTICE ... skipping` son esperados; los `ERROR` no.

Si NO tienes acceso a la base: no intentes adivinar credenciales. Dilo, y pide al
usuario que pegue el script en el SQL Editor de Supabase, luego continúa.

### FASE 2 — Extraer las tarifas de costo reales  ← esta es la fase de más valor

Los modelos financieros ya contienen los costos internos por hora. Extráelos en vez
de pedirle al usuario que los teclee.

1. Recorre TODOS los `.xlsx` de la carpeta comercial usando ExcelJS
   (`tools\sales-sync\node_modules\exceljs`). Reutiliza los helpers de
   `tools\sales-sync\lib\normalize.mjs` (`matchHeader`, `toNumber`, `slug`) para no
   reimplementar la detección de encabezados.
2. En cada libro busca tablas que asocien un rol con un costo unitario: encabezados
   que mapeen a `role_family` + `unit_direct_cost`. Suelen estar en hojas llamadas
   `Supuestos`, `Margen_*`, `Equipo*` o `Costeo`.
3. Construye un consolidado y escríbelo en `.local\tarifas-detectadas.csv` con:
   `rol, seniority, costo_hora, moneda, archivo_origen, hoja, celda`.
4. **Señala la dispersión**: si el mismo rol aparece con costos distintos entre
   propuestas, lístalo aparte. Es información de negocio valiosa, no un error a
   promediar. No promedies nada por tu cuenta.
5. Extrae también los parámetros globales que encuentres: factor prestacional, horas
   productivas al mes, overhead, TRM. Reporta el archivo y la celda de cada uno.
6. Genera `.local\seed-tarifas.sql` con los `INSERT` a `sales_cost_rates`, calculando
   `hourly_cost` con la fórmula del repositorio:
   `(salario_base * factor_prestacional + herramientas) / horas_productivas`.
   Si para un rol falta alguno de esos componentes, usa el costo hora tal como viene
   en el modelo y **márcalo con un comentario SQL** indicando que no es derivable.

[GATE 2] Presenta el CSV, la lista de dispersión y el SQL propuesto. Espera que el
usuario los apruebe o corrija antes de ejecutar nada contra la base.

### FASE 3 — Lista de precios

Esto requiere decisión humana y no lo puedes deducir de los archivos: el precio de
lista, el **precio piso** y el **descuento máximo** por rol son política comercial.

Prepara un `.local\seed-precios.sql` con la estructura lista y las tarifas de venta
que sí encontraste en los modelos, dejando piso y descuento máximo como
`-- COMPLETAR`. Explica al usuario que sin el piso no hay gobierno de precios y
cualquier descuento pasa sin revisión.

[GATE 3] Espera los valores del usuario.

### FASE 4 — Cargar las propuestas

1. Ejecuta el sincronizador en modo revisión, sin escribir en el ERP:
   ```
   cd tools\sales-sync
   node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" --dry-run --out ..\..\.local\manifiesto.json --verbose
   ```
2. Analiza `.local\manifiesto.json` y reporta, por cliente:
   - cuántas propuestas se extrajeron y con qué confianza;
   - cuáles quedaron marcadas para revisión y por qué;
   - cuáles no se pudieron leer y cuál de estos tres casos es cada una:
     (a) modelo de costeo sin tarifa de venta por línea,
     (b) caso de negocio o TCO del cliente, que no es una propuesta,
     (c) formato no reconocido, que necesitaría un perfil de mapeo.
3. Para el caso (c), propón el perfil de mapeo concreto en
   `.local\sales-sync.config.json` siguiendo el formato de
   `tools\sales-sync\sales-sync.config.example.json`, y vuelve a correr el dry-run
   para comprobar que ahora sí extrae.

[GATE 4] Presenta el resumen. **No publiques nada todavía.** Solo cuando el usuario
apruebe explícitamente, ejecuta la publicación con `--api` y `--token`.

### FASE 5 — Verificación

Levanta la aplicación (`npm run dev`) y comprueba en el navegador:
- `/ventas/importar` muestra el lote con los archivos importados.
- `/ventas` lista las propuestas con margen y realización de precio.
- Abrir una propuesta muestra la cascada de margen y el detalle unitario por rol.

Contrasta el margen que muestra el ERP contra el que declara el modelo financiero
original de esa misma propuesta. Si no coinciden, repórtalo con ambos números; no
ajustes datos para que cuadren.

### FASE 6 — Opcional, solo si el usuario lo pide

`npx supabase login` y luego `npm run types:gen` para generar
`src/types/database.ts` desde el esquema real.

## FORMATO DE SALIDA

Tras cada fase, un informe de máximo 15 líneas:
- Qué hiciste.
- Qué encontraste (con cifras).
- Qué falta o qué necesitas del usuario.

Al final, una lista de verificación con el estado de cada fase y los pendientes que
quedaron abiertos.

## QUÉ NO HACER

- No optimices, refactorices ni "mejores" código que no te pedí tocar.
- No silencies un error ni ajustes un dato para que un total cuadre.
- No promedies tarifas dispares para producir un número único.
- No asumas que un archivo sin costos "seguramente usa la tarifa estándar".
- Si algo te parece ambiguo, pregunta. Es más barato que deshacerlo.
```

---

## Cómo usarlo

1. Abre el repositorio en Antigravity.
2. Pega el prompt.
3. Responde en cada `[GATE]`. Son cinco pausas; el resto lo hace solo.

La fase que más te ahorra es la **2**: recorre todos tus modelos y arma el tarifario
consolidado, que es el trabajo manual que de otro modo te tomaría horas. La 3 no se
puede automatizar porque el precio piso es una decisión de negocio, no un dato.
