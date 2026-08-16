// Recorrido y clasificación de la carpeta Comercial.
//
// Convención asumida (la de C:\Users\<usuario>\OneDrive\H Plus\Comercial):
//   Comercial/
//     <Cliente>/
//       <lo que sea>/  propuestas y modelos financieros
//
// La carpeta de primer nivel es el cliente. Todo lo que cuelgue debajo,
// a cualquier profundidad, se le atribuye.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { slug } from './normalize.mjs';

/** Extensiones que se procesan; el resto se ignora en silencio. */
export const SUPPORTED_EXTENSIONS = new Set([
    '.xlsx', '.xlsm', '.xls',
    '.docx', '.doc',
    '.pdf',
    '.pptx', '.ppt',
]);

const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls']);

/** Carpetas que nunca aportan información comercial vigente. */
const IGNORED_DIRECTORIES = [
    'papelera', 'archivo', 'archivado', 'obsoleto', 'old', 'backup', 'temp', 'tmp',
    'plantillas', 'templates', 'no usar', 'descartado',
];

const KIND_KEYWORDS = [
    { kind: 'MODELO_FINANCIERO', words: ['modelo financiero', 'modelo', 'costeo', 'financiero', 'presupuesto', 'estimacion', 'pricing', 'tarifario'] },
    { kind: 'SOW', words: ['sow', 'statement of work', 'contrato', 'alcance contractual', 'otrosi'] },
    { kind: 'PROPUESTA', words: ['propuesta', 'oferta', 'cotizacion', 'proposal', 'quote', 'presupuesto comercial'] },
    { kind: 'PRESENTACION', words: ['pitch', 'presentacion', 'deck', 'kickoff'] },
    { kind: 'ANEXO', words: ['anexo', 'annex', 'adjunto', 'soporte'] },
];

/**
 * Clasifica un archivo por extensión y nombre.
 *
 * La extensión manda sobre el nombre: una hoja de cálculo llamada
 * "Propuesta Acme.xlsx" es el modelo financiero, no el documento de la
 * propuesta, y es de donde salen los números.
 */
export function classifyDocument(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const s = slug(path.basename(fileName, ext));

    if (SPREADSHEET_EXTENSIONS.has(ext)) return 'MODELO_FINANCIERO';

    for (const { kind, words } of KIND_KEYWORDS) {
        if (kind === 'MODELO_FINANCIERO') continue; // ya resuelto por extensión
        if (words.some((w) => s.includes(w))) return kind;
    }

    if (ext === '.pptx' || ext === '.ppt') return 'PRESENTACION';
    if (ext === '.docx' || ext === '.doc' || ext === '.pdf') return 'PROPUESTA';
    return 'DESCONOCIDO';
}

/**
 * Extrae la versión del nombre del archivo: v1, V2.1, ver 3, rev2, _v10_.
 * Devuelve la cadena normalizada ("v2.1") o null.
 */
export function detectVersion(fileName) {
    const base = path.basename(fileName, path.extname(fileName));
    const m = base.match(/(?:^|[\s._\-([])(?:v|ver|version|rev)[\s._-]?(\d+(?:[._]\d+)?)/i);
    if (!m) return null;
    return `v${m[1].replace('_', '.')}`;
}

/** Extrae una fecha del nombre del archivo en los formatos usuales. */
export function detectDate(fileName) {
    const base = path.basename(fileName, path.extname(fileName));

    let m = base.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
    if (m) return validDate(m[1], m[2], m[3]);

    m = base.match(/(\d{2})[-_.](\d{2})[-_.](20\d{2})/);
    if (m) return validDate(m[3], m[2], m[1]);

    return null;
}

function validDate(y, mo, d) {
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** SHA-256 del contenido. Es la clave de idempotencia de toda la ingesta. */
export async function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

function isIgnoredDirectory(name) {
    if (name.startsWith('.') || name.startsWith('~$')) return true;
    const s = slug(name);
    return IGNORED_DIRECTORIES.some((ignored) => s === ignored || s.startsWith(`${ignored} `));
}

/**
 * Recorre la carpeta y devuelve los archivos candidatos con sus metadatos.
 *
 * @param {string} root Raíz de la carpeta Comercial.
 * @param {object} options
 * @param {string} [options.client] Procesar solo esta carpeta de cliente.
 * @param {string} [options.since] Solo archivos modificados desde esta fecha ISO.
 * @param {number} [options.maxDepth] Profundidad máxima bajo la carpeta de cliente.
 */
export async function scanCommercialFolder(root, options = {}) {
    const files = [];
    const warnings = [];
    const sinceTime = options.since ? new Date(`${options.since}T00:00:00Z`).getTime() : null;
    const maxDepth = options.maxDepth ?? 6;

    let clientDirs;
    try {
        clientDirs = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
        throw new Error(`No se pudo leer la carpeta raíz "${root}": ${error.message}`);
    }

    for (const entry of clientDirs) {
        if (!entry.isDirectory() || isIgnoredDirectory(entry.name)) continue;
        if (options.client && slug(entry.name) !== slug(options.client)) continue;

        await walk(path.join(root, entry.name), entry.name, 0);
    }

    // Archivos sueltos en la raíz: no tienen cliente atribuible, se avisan.
    for (const entry of clientDirs) {
        if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            warnings.push(`"${entry.name}" está en la raíz, sin carpeta de cliente. Se omite.`);
        }
    }

    return { files, warnings };

    async function walk(dir, clientFolder, depth) {
        if (depth > maxDepth) return;

        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            warnings.push(`No se pudo leer "${dir}": ${error.message}`);
            return;
        }

        for (const entry of entries) {
            const full = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!isIgnoredDirectory(entry.name)) await walk(full, clientFolder, depth + 1);
                continue;
            }
            if (!entry.isFile()) continue;

            // Archivos temporales de Office abiertos en ese momento.
            if (entry.name.startsWith('~$') || entry.name.startsWith('.')) continue;

            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

            let stat;
            try {
                stat = await fs.stat(full);
            } catch (error) {
                warnings.push(`No se pudo leer "${full}": ${error.message}`);
                continue;
            }

            if (sinceTime && stat.mtimeMs < sinceTime) continue;

            files.push({
                absolute_path: full,
                relative_path: path.relative(root, full).split(path.sep).join('/'),
                file_name: entry.name,
                file_extension: ext,
                file_size_bytes: stat.size,
                file_modified_at: new Date(stat.mtimeMs).toISOString(),
                detected_client_folder: clientFolder,
                document_kind: classifyDocument(entry.name),
                detected_version: detectVersion(entry.name),
                detected_date: detectDate(entry.name) ?? new Date(stat.mtimeMs).toISOString().slice(0, 10),
            });
        }
    }
}

/**
 * Agrupa los archivos por cliente y por "familia de propuesta".
 *
 * Un modelo financiero y su documento de propuesta suelen compartir carpeta
 * y versión; emparejarlos permite registrar una sola propuesta con
 * trazabilidad a ambos archivos en vez de dos registros sueltos.
 */
export function groupByProposal(files) {
    const groups = new Map();

    for (const file of files) {
        const folder = path.posix.dirname(file.relative_path);
        const key = `${file.detected_client_folder}::${folder}::${file.detected_version ?? 'sin-version'}`;

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                client_folder: file.detected_client_folder,
                folder,
                version: file.detected_version,
                model: null,
                document: null,
                others: [],
            });
        }

        const group = groups.get(key);
        if (file.document_kind === 'MODELO_FINANCIERO') {
            // Ante varios modelos, gana el más reciente.
            if (!group.model || file.file_modified_at > group.model.file_modified_at) {
                if (group.model) group.others.push(group.model);
                group.model = file;
            } else {
                group.others.push(file);
            }
        } else if (file.document_kind === 'PROPUESTA' || file.document_kind === 'SOW') {
            if (!group.document || file.file_modified_at > group.document.file_modified_at) {
                if (group.document) group.others.push(group.document);
                group.document = file;
            } else {
                group.others.push(file);
            }
        } else {
            group.others.push(file);
        }
    }

    return [...groups.values()];
}
