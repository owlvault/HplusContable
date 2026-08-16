// Extracción de propuestas desde los modelos financieros en Excel.
//
// Tres estrategias, de mayor a menor fidelidad:
//
//   1. Hoja ERP_EXPORT      Contrato explícito. HPlus controla sus plantillas,
//                           así que esta es la vía recomendada: 100% confiable.
//   2. Perfil de mapeo      Configuración que dice en qué hoja, fila y columna
//                           vive cada campo para un cliente o plantilla dada.
//   3. Heurística           Último recurso: busca la fila de encabezados por
//                           sinónimos. Marca la propuesta para revisión.
//
// Nunca se inventa un dato: lo que no se encuentra queda nulo y se reporta
// como advertencia. Un margen calculado sobre un costo inventado es peor
// que no tener el dato.

import ExcelJS from 'exceljs';
import {
    matchHeader,
    normalizeSeniority,
    normalizeUnit,
    round,
    slug,
    toISODate,
    toNumber,
    toPercent,
    toText,
} from './normalize.mjs';

/** Nombre de la hoja canónica de exportación. */
export const EXPORT_SHEET_NAME = 'ERP_EXPORT';

/** Prefijo de los rangos con nombre que se leen como supuestos. */
export const NAMED_RANGE_PREFIX = 'HPLUS_';

const REQUIRED_FIELDS = ['description', 'quantity', 'unit_price'];

/**
 * Lee un modelo financiero y devuelve una propuesta normalizada.
 *
 * @returns {{ proposal: object|null, confidence: number, strategy: string, warnings: string[] }}
 */
export async function parseFinancialModel(filePath, context = {}) {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(filePath);
    } catch (error) {
        return {
            proposal: null,
            confidence: 0,
            strategy: 'NINGUNA',
            warnings: [`No se pudo abrir el libro: ${error.message}`],
        };
    }

    const warnings = [];
    const assumptions = readNamedRanges(workbook, warnings);

    let extraction = extractFromExportSheet(workbook, warnings);
    let strategy = 'ERP_EXPORT';

    if (!extraction && context.mapping) {
        extraction = extractFromMapping(workbook, context.mapping, warnings);
        strategy = 'PERFIL_MAPEO';
    }

    if (!extraction) {
        extraction = extractByHeuristics(workbook, warnings);
        strategy = 'HEURISTICA';
    }

    if (!extraction || extraction.lines.length === 0) {
        return {
            proposal: null,
            confidence: 0,
            strategy: 'NINGUNA',
            warnings: [
                ...warnings,
                'No se encontró una tabla de líneas reconocible. Agrega una hoja ERP_EXPORT o define un perfil de mapeo.',
            ],
        };
    }

    const header = readHeaderFields(workbook, assumptions, context);
    const proposal = {
        title: header.title ?? context.default_title ?? 'Propuesta sin título',
        client_name: header.client_name ?? context.client_folder ?? 'Cliente sin identificar',
        currency: header.currency ?? 'COP',
        fx_rate: header.fx_rate ?? 1,
        engagement_model: header.engagement_model ?? null,
        issue_date: header.issue_date ?? context.detected_date ?? null,
        valid_until: header.valid_until ?? null,
        payment_terms_days: header.payment_terms_days ?? null,
        advance_payment_rate: header.advance_payment_rate ?? null,
        contingency_rate: header.contingency_rate ?? null,
        estimated_start_date: header.estimated_start_date ?? null,
        estimated_end_date: header.estimated_end_date ?? null,
        lines: extraction.lines,
        assumptions,
        scenarios: extractScenarios(workbook, warnings),
    };

    const confidence = scoreConfidence(strategy, extraction, proposal, warnings);
    return { proposal, confidence, strategy, warnings };
}

// ---------------------------------------------------------------------------
// Estrategia 1: hoja ERP_EXPORT
// ---------------------------------------------------------------------------

function extractFromExportSheet(workbook, warnings) {
    const sheet = workbook.worksheets.find((ws) => slug(ws.name) === slug(EXPORT_SHEET_NAME));
    if (!sheet) return null;

    const headerRow = sheet.getRow(1);
    const columns = mapColumns(headerRow);

    const missing = REQUIRED_FIELDS.filter((f) => !(f in columns));
    if (missing.length > 0) {
        warnings.push(
            `La hoja ${EXPORT_SHEET_NAME} existe pero le faltan columnas obligatorias: ${missing.join(', ')}.`
        );
        return null;
    }

    return { lines: readLines(sheet, columns, 2, warnings), columns, headerRow: 1, sheet: sheet.name };
}

// ---------------------------------------------------------------------------
// Estrategia 2: perfil de mapeo declarado en la configuración
// ---------------------------------------------------------------------------

function extractFromMapping(workbook, mapping, warnings) {
    const sheet = mapping.sheet
        ? workbook.worksheets.find((ws) => slug(ws.name) === slug(mapping.sheet))
        : workbook.worksheets[0];

    if (!sheet) {
        warnings.push(`El perfil de mapeo apunta a la hoja "${mapping.sheet}", que no existe.`);
        return null;
    }

    const headerRowNumber = mapping.header_row ?? 1;
    const columns = {};

    if (mapping.columns) {
        // El perfil puede referirse a la columna por letra ("D") o por su título.
        const headerRow = sheet.getRow(headerRowNumber);
        const byTitle = mapColumns(headerRow, { useSynonyms: false });

        for (const [field, ref] of Object.entries(mapping.columns)) {
            if (typeof ref === 'number') {
                columns[field] = ref;
            } else if (/^[A-Z]{1,3}$/i.test(ref)) {
                columns[field] = columnLetterToNumber(ref);
            } else {
                const found = byTitle[slug(ref)];
                if (found) columns[field] = found;
                else warnings.push(`No se encontró la columna "${ref}" para el campo ${field}.`);
            }
        }
    } else {
        Object.assign(columns, mapColumns(sheet.getRow(headerRowNumber)));
    }

    const missing = REQUIRED_FIELDS.filter((f) => !(f in columns));
    if (missing.length > 0) {
        warnings.push(`El perfil de mapeo no resuelve: ${missing.join(', ')}.`);
        return null;
    }

    return {
        lines: readLines(sheet, columns, headerRowNumber + 1, warnings),
        columns,
        headerRow: headerRowNumber,
        sheet: sheet.name,
    };
}

// ---------------------------------------------------------------------------
// Estrategia 3: heurística
// ---------------------------------------------------------------------------

/**
 * Busca en cada hoja la fila que mejor funciona como encabezado.
 * Se queda con la hoja que produzca más líneas útiles.
 */
function extractByHeuristics(workbook, warnings) {
    let best = null;

    for (const sheet of workbook.worksheets) {
        if (sheet.state === 'hidden' || sheet.state === 'veryHidden') continue;

        const limit = Math.min(sheet.rowCount, 40); // los encabezados nunca están muy abajo
        for (let r = 1; r <= limit; r++) {
            const columns = mapColumns(sheet.getRow(r));
            const matched = Object.keys(columns);
            if (!REQUIRED_FIELDS.every((f) => matched.includes(f))) continue;

            const lines = readLines(sheet, columns, r + 1, []);
            if (lines.length === 0) continue;

            const score = lines.length * 10 + matched.length;
            if (!best || score > best.score) {
                best = { lines, columns, headerRow: r, sheet: sheet.name, score };
            }
        }
    }

    if (!best) return null;

    warnings.push(
        `Líneas deducidas por heurística de la hoja "${best.sheet}" (encabezados en la fila ${best.headerRow}). Revisar antes de dar el margen por bueno.`
    );

    // La exploración descarta los avisos de cada candidato para no ensuciar
    // el reporte con hojas que no se eligieron. Se releen los de la ganadora.
    const winner = workbook.worksheets.find((ws) => ws.name === best.sheet);
    best.lines = readLines(winner, best.columns, best.headerRow + 1, warnings);
    return best;
}

// ---------------------------------------------------------------------------
// Lectura de la tabla de líneas
// ---------------------------------------------------------------------------

function columnLetterToNumber(letters) {
    return letters
        .toUpperCase()
        .split('')
        .reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
}

/** Mapea el número de columna de cada campo canónico presente en la fila. */
function mapColumns(row, { useSynonyms = true } = {}) {
    const columns = {};
    const values = row?.values ?? [];

    for (let c = 1; c < values.length; c++) {
        const title = toText(values[c]);
        if (!title) continue;

        if (!useSynonyms) {
            columns[slug(title)] = c;
            continue;
        }

        const field = matchHeader(title);
        // La primera columna que reclama un campo se lo queda: en los modelos
        // reales la tabla principal está a la izquierda de las auxiliares.
        if (field && !(field in columns)) columns[field] = c;
    }
    return columns;
}

/** Lee las filas de datos hasta encontrar el fin de la tabla. */
function readLines(sheet, columns, startRow, warnings) {
    const lines = [];
    let blankStreak = 0;
    let lineNumber = 0;

    for (let r = startRow; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const description = toText(row.getCell(columns.description).value);
        const quantity = toNumber(row.getCell(columns.quantity).value);
        const unitPrice = toNumber(row.getCell(columns.unit_price).value);

        if (!description && quantity == null && unitPrice == null) {
            // Dos filas vacías seguidas cierran la tabla; una sola puede ser
            // un separador visual entre grupos de líneas.
            if (++blankStreak >= 2) break;
            continue;
        }
        blankStreak = 0;

        if (!description) continue;
        if (isTotalRow(description)) continue; // la fila de totales no es una línea

        const line = buildLine(row, columns, ++lineNumber, description, quantity, unitPrice);
        if (line) lines.push(line);
        else lineNumber--;
    }

    if (lines.length > 0) {
        const sinCosto = lines.filter((l) => !l.is_passthrough && !l.unit_direct_cost).length;
        if (sinCosto === lines.length) {
            warnings.push(
                'Ninguna línea trae costo unitario: el modelo no permite calcular margen. Se importa solo el precio.'
            );
        } else if (sinCosto > 0) {
            warnings.push(`${sinCosto} de ${lines.length} líneas no traen costo unitario.`);
        }
    }

    return lines;
}

const TOTAL_ROW_PATTERNS = /^(total|subtotal|gran total|suma|iva|impuesto|valor total|neto|descuento)\b/;

function isTotalRow(description) {
    return TOTAL_ROW_PATTERNS.test(slug(description));
}

function buildLine(row, columns, lineNumber, description, quantity, unitPrice) {
    const get = (field) => (columns[field] ? row.getCell(columns[field]).value : null);

    const qty = quantity ?? 1;
    let price = unitPrice;

    // Si no hay precio unitario pero sí total, se deriva.
    if (price == null && columns.total) {
        const total = toNumber(get('total'));
        if (total != null && qty !== 0) price = round(total / qty, 4);
    }
    if (price == null) return null;

    const listPrice = toNumber(get('unit_list_price'));
    const discountRate = toPercent(get('discount_rate'));
    const unit = normalizeUnit(toText(get('unit'))) ?? 'HORA';
    const hours = toNumber(get('hours'));

    const passthroughRaw = toText(get('is_passthrough'));
    const isPassthrough = passthroughRaw
        ? /^(si|sí|s|yes|y|true|1|x)$/i.test(passthroughRaw.trim())
        : false;

    const roleFamily = toText(get('role_family'));
    // Muchos modelos no tienen columna de nivel: escriben "Analista Senior"
    // o "Dev Jr" en la del rol. Se deduce de ahí antes de darlo por perdido.
    const seniority =
        normalizeSeniority(toText(get('seniority'))) ??
        normalizeSeniority(roleFamily) ??
        normalizeSeniority(description);

    return {
        line_number: lineNumber,
        description,
        workstream: toText(get('workstream')),
        phase: toText(get('phase')),
        deliverable: toText(get('deliverable')),
        role_family: roleFamily,
        seniority,
        quantity: qty,
        unit,
        hours: hours ?? (unit === 'HORA' ? qty : 0),
        // Sin precio de lista explícito, el precio ofrecido es el de lista:
        // asumir otra cosa inventaría un descuento que nunca existió.
        unit_list_price: listPrice ?? price,
        discount_rate: discountRate ?? (listPrice && listPrice > 0 ? round((1 - price / listPrice) * 100, 4) : 0),
        unit_price: price,
        unit_direct_cost: toNumber(get('unit_direct_cost')) ?? 0,
        unit_indirect_cost: toNumber(get('unit_indirect_cost')) ?? 0,
        is_passthrough: isPassthrough,
        tax_rate: toPercent(get('tax_rate')) ?? 19,
    };
}

// ---------------------------------------------------------------------------
// Cabecera, supuestos y escenarios
// ---------------------------------------------------------------------------

/**
 * Lee los rangos con nombre que empiezan por HPLUS_ y los convierte en
 * supuestos trazables. Es la forma más limpia de que un modelo declare
 * su factor prestacional, su TRM o sus horas productivas.
 */
function readNamedRanges(workbook, warnings) {
    const assumptions = [];
    const model = workbook.definedNames?.model;
    if (!Array.isArray(model)) return assumptions;

    for (const entry of model) {
        if (!entry?.name?.toUpperCase().startsWith(NAMED_RANGE_PREFIX)) continue;
        const ranges = entry.ranges ?? [];
        if (ranges.length === 0) continue;

        const value = readRangeValue(workbook, ranges[0]);
        if (value == null) {
            warnings.push(`El rango con nombre ${entry.name} no tiene un valor legible.`);
            continue;
        }

        const key = entry.name.slice(NAMED_RANGE_PREFIX.length).toLowerCase();
        const numeric = toNumber(value);
        assumptions.push({
            category: categorizeAssumption(key),
            key,
            label: entry.name,
            value_numeric: numeric,
            value_text: numeric == null ? toText(value) : null,
            source_reference: ranges[0],
        });
    }

    return assumptions;
}

function categorizeAssumption(key) {
    if (/costo|salario|prestacional|hora|overhead/.test(key)) return 'COSTO';
    if (/precio|tarifa|descuento|margen/.test(key)) return 'PRECIO';
    if (/trm|fx|ipc|inflacion|tasa/.test(key)) return 'MACRO';
    if (/plazo|duracion|mes|fecha/.test(key)) return 'PLAZO';
    if (/riesgo|contingencia/.test(key)) return 'RIESGO';
    if (/equipo|recurso|fte/.test(key)) return 'EQUIPO';
    if (/alcance|entregable/.test(key)) return 'ALCANCE';
    return 'GENERAL';
}

/** Resuelve una referencia tipo 'Hoja'!$B$4 a su valor. */
function readRangeValue(workbook, ref) {
    const m = String(ref).match(/^'?([^'!]+)'?!(\$?[A-Z]+\$?\d+)/);
    if (!m) return null;
    const sheet = workbook.worksheets.find((ws) => ws.name === m[1]);
    if (!sheet) return null;
    return sheet.getCell(m[2].replace(/\$/g, '')).value;
}

/** Cabecera de la propuesta: primero los rangos con nombre, luego etiquetas. */
function readHeaderFields(workbook, assumptions, context) {
    const byKey = new Map(assumptions.map((a) => [a.key, a]));
    const named = (key) => byKey.get(key);

    const header = {
        title: named('titulo')?.value_text ?? null,
        client_name: named('cliente')?.value_text ?? null,
        currency: named('moneda')?.value_text ?? null,
        fx_rate: named('trm')?.value_numeric ?? named('fx_rate')?.value_numeric ?? null,
        engagement_model: normalizeEngagementModel(named('modalidad')?.value_text),
        issue_date: null,
        valid_until: null,
        payment_terms_days: named('plazo_pago')?.value_numeric ?? null,
        // Un modelo puede declarar el anticipo como 30 o como 0.30. El ERP
        // guarda porcentajes en escala 0-100, así que se normaliza aquí.
        advance_payment_rate: asPercent(named('anticipo')?.value_numeric),
        contingency_rate: asPercent(named('contingencia')?.value_numeric),
        estimated_start_date: null,
        estimated_end_date: null,
    };

    // Segundo intento: buscar etiquetas en las primeras filas de cada hoja,
    // que es como suelen venir los modelos escritos a mano.
    const labels = {
        client_name: ['cliente', 'client', 'razon social', 'empresa'],
        title: ['proyecto', 'propuesta', 'titulo', 'nombre del proyecto'],
        currency: ['moneda', 'currency'],
    };
    const dateLabels = {
        issue_date: ['fecha', 'fecha propuesta', 'fecha de emision', 'emision'],
        valid_until: ['vigencia', 'valida hasta', 'validez'],
        estimated_start_date: ['inicio', 'fecha inicio', 'fecha de inicio'],
        estimated_end_date: ['fin', 'fecha fin', 'fecha de fin', 'terminacion'],
    };

    for (const sheet of workbook.worksheets.slice(0, 5)) {
        const limit = Math.min(sheet.rowCount, 25);
        for (let r = 1; r <= limit; r++) {
            const values = sheet.getRow(r).values ?? [];
            for (let c = 1; c < values.length; c++) {
                const label = slug(toText(values[c]));
                if (!label) continue;
                const next = values[c + 1];
                if (next == null) continue;

                for (const [field, options] of Object.entries(labels)) {
                    if (!header[field] && options.includes(label)) header[field] = toText(next);
                }
                for (const [field, options] of Object.entries(dateLabels)) {
                    if (!header[field] && options.includes(label)) header[field] = toISODate(next);
                }
            }
        }
    }

    if (header.currency) {
        const cur = header.currency.toUpperCase().replace(/[^A-Z]/g, '');
        header.currency = /^(COP|USD|EUR|MXN|PEN|CLP|BRL)$/.test(cur) ? cur : null;
    }
    if (!header.client_name && context.client_folder) header.client_name = context.client_folder;

    return header;
}

/** Lleva una tasa a escala 0-100 tanto si venía como 0.30 como si venía 30. */
function asPercent(value) {
    if (value == null) return null;
    return value > 0 && value <= 1 ? round(value * 100, 4) : round(value, 4);
}

function normalizeEngagementModel(raw) {
    const s = slug(raw);
    if (!s) return null;
    if (/precio fijo|fixed|llave en mano|alcance cerrado/.test(s)) return 'FIXED_PRICE';
    if (/tiempo y materiales|t m|time and materials|bolsa/.test(s)) return 'TIME_AND_MATERIALS';
    if (/retainer|mensualidad|iguala/.test(s)) return 'RETAINER';
    if (/suscripcion|subscription|saas/.test(s)) return 'SUBSCRIPTION';
    if (/resultado|outcome|exito/.test(s)) return 'OUTCOME_BASED';
    if (/mixto|hibrido/.test(s)) return 'MIXTO';
    return null;
}

/**
 * Lee la hoja ERP_ESCENARIOS si existe. Los modelos suelen traer
 * Base / Optimista / Conservador y conviene guardarlos todos.
 */
function extractScenarios(workbook, warnings) {
    const sheet = workbook.worksheets.find((ws) => slug(ws.name) === slug('ERP_ESCENARIOS'));
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const byTitle = {};
    const values = headerRow.values ?? [];
    for (let c = 1; c < values.length; c++) {
        const title = slug(toText(values[c]));
        if (title) byTitle[title] = c;
    }

    if (!byTitle.escenario && !byTitle.nombre) {
        warnings.push('La hoja ERP_ESCENARIOS no tiene columna "escenario".');
        return [];
    }

    const nameCol = byTitle.escenario ?? byTitle.nombre;
    const scenarios = [];

    for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const name = toText(row.getCell(nameCol).value);
        if (!name) continue;

        const num = (key) => (byTitle[key] ? toNumber(row.getCell(byTitle[key]).value) : null);
        const revenue = num('ingreso') ?? num('revenue') ?? 0;
        const directCost = num('costo directo') ?? num('costo') ?? 0;
        const indirectCost = num('costo indirecto') ?? 0;
        const grossMargin = num('margen') ?? revenue - directCost;

        scenarios.push({
            name,
            is_base: /base/i.test(name),
            probability: num('probabilidad'),
            revenue,
            direct_cost: directCost,
            indirect_cost: indirectCost,
            gross_margin: grossMargin,
            gross_margin_rate: revenue !== 0 ? round((grossMargin / revenue) * 100, 2) : 0,
            total_hours: num('horas') ?? 0,
            npv: num('vpn') ?? num('npv'),
            irr: num('tir') ?? num('irr'),
            payback_months: num('payback') ?? num('repago'),
            discount_rate: num('tasa descuento') ?? num('wacc'),
        });
    }

    return scenarios;
}

// ---------------------------------------------------------------------------
// Confianza de la extracción
// ---------------------------------------------------------------------------

/**
 * Puntúa qué tan fiable es lo extraído (0-100).
 *
 * Por debajo del umbral de la configuración, la propuesta entra al ERP
 * marcada como `needs_review` y no contamina los indicadores.
 */
function scoreConfidence(strategy, extraction, proposal, warnings) {
    let score = strategy === 'ERP_EXPORT' ? 100 : strategy === 'PERFIL_MAPEO' ? 85 : 45;

    const matched = Object.keys(extraction.columns ?? {});
    // Sin costo no hay margen, que es justo lo que este módulo existe para medir.
    const conCosto = proposal.lines.filter((l) => l.unit_direct_cost > 0 || l.is_passthrough).length;
    const ratioCosto = proposal.lines.length > 0 ? conCosto / proposal.lines.length : 0;

    if (ratioCosto === 0) score -= 30;
    else if (ratioCosto < 0.8) score -= 15;

    if (matched.includes('role_family')) score += 5;
    if (matched.includes('hours')) score += 5;
    if (proposal.assumptions.length > 0) score += 5;
    if (!proposal.client_name || proposal.client_name === 'Cliente sin identificar') score -= 10;
    score -= Math.min(warnings.length * 3, 15);

    return Math.max(0, Math.min(100, round(score, 2)));
}
