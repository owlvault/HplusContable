// Normalización de valores crudos de Excel a tipos canónicos.
//
// Los modelos financieros vienen escritos por personas: hay pesos con
// símbolo, porcentajes como texto, fechas como cadena y celdas con fórmula.
// Todo eso entra aquí y sale como número, fecha ISO o texto limpio.

/** Quita tildes y normaliza a minúsculas para comparar encabezados. */
export function slug(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // marcas diacríticas combinantes
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Extrae el valor primitivo de una celda de ExcelJS.
 * Las celdas pueden ser fórmulas, texto enriquecido, hipervínculos o errores.
 */
export function cellValue(raw) {
    if (raw == null) return null;
    if (raw instanceof Date) return raw;
    if (typeof raw !== 'object') return raw;

    // Fórmula: interesa el resultado calculado, no la expresión.
    if ('result' in raw) return cellValue(raw.result);
    if ('richText' in raw) return raw.richText.map((r) => r.text).join('');
    if ('text' in raw) return raw.text;
    // Celda en error (#REF!, #DIV/0!): se trata como vacía.
    if ('error' in raw) return null;
    if ('sharedFormula' in raw) return null;
    return null;
}

/**
 * Convierte a número tolerando formato colombiano y europeo.
 *
 * "$ 1.234.567,89" -> 1234567.89
 * "1,234,567.89"   -> 1234567.89
 * "(1.500)"        -> -1500   (paréntesis contables)
 * "15%"            -> 15
 */
export function toNumber(raw) {
    const value = cellValue(raw);
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return null;

    let text = String(value).trim();
    if (!text) return null;

    const isNegative = /^\(.*\)$/.test(text) || text.startsWith('-');
    text = text.replace(/[()]/g, '').replace(/^-/, '');

    // Fuera símbolos de moneda, espacios (incluido el fino) y sufijos.
    text = text.replace(/[$€£]|COP|USD|EUR/gi, '').replace(/[\s\u00a0\u202f]/g, '');
    text = text.replace(/%/g, '');
    if (!text) return null;

    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    if (lastComma >= 0 && lastDot >= 0) {
        // El separador decimal es el que aparece de último.
        if (lastComma > lastDot) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (lastComma >= 0) {
        const decimals = text.length - lastComma - 1;
        // "1,234" con 3 dígitos es separador de miles; "1,23" es decimal.
        text = decimals === 3 ? text.replace(/,/g, '') : text.replace(',', '.');
    } else if (lastDot >= 0) {
        const decimals = text.length - lastDot - 1;
        const dotCount = (text.match(/\./g) || []).length;
        if (dotCount > 1 || decimals === 3) text = text.replace(/\./g, '');
    }

    const n = Number(text);
    if (!Number.isFinite(n)) return null;
    return isNegative ? -n : n;
}

/**
 * Normaliza un porcentaje a escala 0-100.
 * Excel guarda "15%" como 0.15, pero mucha gente escribe 15 directamente.
 */
export function toPercent(raw) {
    const n = toNumber(raw);
    if (n == null) return null;
    const value = cellValue(raw);
    const wasTextPercent = typeof value === 'string' && value.includes('%');
    // Un valor <= 1 sin signo de porcentaje explícito es fracción decimal.
    if (!wasTextPercent && n > 0 && n <= 1) return round(n * 100, 4);
    return round(n, 4);
}

export function round(n, decimals = 2) {
    const f = 10 ** decimals;
    return Math.round((n + Number.EPSILON) * f) / f;
}

/** Devuelve una fecha ISO (YYYY-MM-DD) o null. */
export function toISODate(raw) {
    const value = cellValue(raw);
    if (value == null || value === '') return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
        // Serial de Excel: días desde 1899-12-30 (base 1900 con el bug de 1900).
        if (value < 1 || value > 80000) return null;
        const ms = Math.round((value - 25569) * 86400 * 1000);
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    let m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) return isoFrom(m[1], m[2], m[3]);

    m = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return isoFrom(m[3], m[2], m[1]); // dd/mm/yyyy, convención local

    m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return isoFrom(m[1], m[2], m[3]);

    return null;
}

function isoFrom(y, mo, d) {
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toText(raw) {
    const value = cellValue(raw);
    if (value == null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    return text === '' ? null : text;
}

// ---------------------------------------------------------------------------
// Diccionario de sinónimos de encabezados
// ---------------------------------------------------------------------------

/**
 * Cada campo canónico lista las formas en que aparece en los modelos reales.
 * El orden importa: se elige la coincidencia más específica primero.
 */
export const HEADER_SYNONYMS = {
    description: ['descripcion', 'concepto', 'item', 'actividad', 'detalle', 'servicio', 'linea'],
    role_family: ['rol', 'perfil', 'recurso', 'cargo', 'posicion'],
    seniority: ['seniority', 'nivel', 'senioridad', 'experiencia'],
    workstream: ['frente', 'workstream', 'modulo', 'componente', 'area'],
    phase: ['fase', 'etapa', 'phase'],
    deliverable: ['entregable', 'producto', 'deliverable'],
    quantity: ['cantidad', 'qty', 'cant', 'unidades', 'volumen'],
    hours: ['horas', 'hh', 'hrs', 'esfuerzo', 'horas hombre', 'horas totales'],
    unit: ['unidad', 'um', 'unidad de medida'],
    unit_list_price: ['precio lista', 'tarifa lista', 'valor lista', 'precio de lista', 'tarifa plena'],
    unit_price: ['precio unitario', 'tarifa', 'precio', 'valor unitario', 'tarifa hora', 'precio venta', 'valor hora', 'tarifa venta'],
    discount_rate: ['descuento', 'dcto', 'rebaja', 'discount'],
    unit_direct_cost: ['costo unitario', 'costo hora', 'costo', 'coste', 'costo directo', 'tarifa costo', 'cost'],
    unit_indirect_cost: ['costo indirecto', 'overhead', 'gastos indirectos', 'indirecto'],
    tax_rate: ['iva', 'impuesto', 'tax'],
    total: ['total', 'valor total', 'subtotal', 'monto', 'importe'],
    is_passthrough: ['reembolsable', 'passthrough', 'pass through', 'costo reembolsable'],
};

/**
 * Empareja un encabezado con un campo canónico.
 * Devuelve null si no hay coincidencia razonable.
 */
export function matchHeader(header) {
    const s = slug(header);
    if (!s) return null;

    let best = null;
    for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
        for (const syn of synonyms) {
            if (s === syn) return field; // exacto gana siempre
            if ((s.includes(syn) || syn.includes(s)) && syn.length >= 4) {
                // Ante ambigüedad, gana el sinónimo más largo (más específico):
                // "precio lista" debe ganarle a "precio".
                if (!best || syn.length > best.length) best = { field, length: syn.length };
            }
        }
    }
    return best ? best.field : null;
}

/** Normaliza la unidad de medida a las que acepta el ERP. */
export function normalizeUnit(raw) {
    const s = slug(raw);
    if (!s) return null;
    if (/^(h|hr|hrs|hora|horas|hh)$/.test(s)) return 'HORA';
    if (/^(d|dia|dias|day|days|jornada)/.test(s)) return 'DIA';
    if (/sprint|iteracion/.test(s)) return 'SPRINT';
    if (/^(mes|meses|mensual|month)/.test(s)) return 'MES';
    if (/global|bolsa|paquete|fijo/.test(s)) return 'GLOBAL';
    if (/^(un|und|unidad|unidades|u)$/.test(s)) return 'UNIDAD';
    return null;
}

/** Normaliza el nivel de seniority a la enumeración del ERP. */
export function normalizeSeniority(raw) {
    const s = slug(raw);
    if (!s) return null;
    if (/trainee|practicante|aprendiz/.test(s)) return 'TRAINEE';
    if (/junior|jr|inicial/.test(s)) return 'JUNIOR';
    if (/semi|ssr|intermedio|mid/.test(s)) return 'SEMISENIOR';
    if (/principal|arquitecto jefe/.test(s)) return 'PRINCIPAL';
    if (/staff|lead|lider/.test(s)) return 'STAFF';
    if (/senior|sr|experto/.test(s)) return 'SENIOR';
    return null;
}
