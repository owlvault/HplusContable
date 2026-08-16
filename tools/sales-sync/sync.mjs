#!/usr/bin/env node
// sales-sync — Ingesta de la carpeta Comercial hacia el módulo de ventas.
//
// Se ejecuta en la máquina que tiene la carpeta sincronizada con OneDrive.
// Recorre Comercial/<Cliente>/..., clasifica propuestas y modelos
// financieros, extrae precios y costos unitarios de las hojas de cálculo y
// publica el resultado en el ERP.
//
// Los archivos nunca se modifican ni se suben: solo se lee su contenido y
// se envía el resumen normalizado más el SHA-256 para deduplicar.
//
//   node sync.mjs --root "C:\Users\ccarvajalino\OneDrive\H Plus\Comercial" \
//                 --api https://erp.hplus.co --token %HPLUS_SALES_TOKEN%
//
//   node sync.mjs --root "..." --dry-run --out manifiesto.json

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { groupByProposal, hashFile, scanCommercialFolder } from './lib/scanner.mjs';
import { parseFinancialModel } from './lib/workbook.mjs';
import { slug } from './lib/normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
    // Por debajo de esta confianza la propuesta entra marcada para revisión.
    min_confidence: 60,
    // Tamaño del lote al publicar, para no enviar un cuerpo enorme de una vez.
    chunk_size: 25,
    max_depth: 6,
    mappings: [],
};

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            args._.push(token);
            continue;
        }
        const [flag, inline] = token.slice(2).split('=');
        const key = flag.replace(/-/g, '_');
        if (inline !== undefined) {
            args[key] = inline;
        } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
            args[key] = argv[++i];
        } else {
            args[key] = true;
        }
    }
    return args;
}

const USAGE = `
sales-sync — carga las propuestas comerciales de la carpeta Comercial al ERP.

Uso:
  node sync.mjs --root <carpeta> [opciones]

Obligatorio:
  --root <ruta>        Raíz de la carpeta Comercial (una subcarpeta por cliente).

Publicación:
  --api <url>          URL base del ERP. Ej: https://erp.hplus.co
  --token <token>      Token de ingesta. Por defecto toma HPLUS_SALES_TOKEN.
  --dry-run            No publica: escribe el manifiesto y termina.
  --out <archivo>      Ruta del manifiesto en dry-run. Por defecto sales-sync-manifest.json.

Filtros:
  --client <nombre>    Procesar solo la carpeta de ese cliente.
  --since <YYYY-MM-DD> Solo archivos modificados desde esa fecha.

Configuración:
  --config <archivo>   Perfiles de mapeo y umbrales. Por defecto sales-sync.config.json.
  --verbose            Detalle archivo por archivo.
  --help               Esta ayuda.
`;

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

async function loadConfig(configPath) {
    const candidates = configPath
        ? [configPath]
        : [path.join(process.cwd(), 'sales-sync.config.json'), path.join(HERE, 'sales-sync.config.json')];

    for (const candidate of candidates) {
        try {
            const raw = await fs.readFile(candidate, 'utf8');
            return { ...DEFAULTS, ...JSON.parse(raw), _source: candidate };
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new Error(`Configuración inválida en ${candidate}: ${error.message}`);
            }
        }
    }

    if (configPath) throw new Error(`No se encontró el archivo de configuración "${configPath}".`);
    return { ...DEFAULTS, _source: null };
}

/**
 * Escoge el perfil de mapeo aplicable a un archivo.
 * Gana el de mayor prioridad entre los que coinciden con la ruta.
 */
function selectMapping(mappings, file) {
    const haystack = slug(`${file.detected_client_folder} ${file.relative_path}`);
    return mappings
        .filter((m) => !m.match_pattern || haystack.includes(slug(m.match_pattern)))
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))[0]?.mapping;
}

// ---------------------------------------------------------------------------
// Proceso principal
// ---------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help || (!args.root && args._.length === 0)) {
        console.log(USAGE);
        process.exit(args.help ? 0 : 1);
    }

    const root = args.root ?? args._[0];
    const config = await loadConfig(args.config);
    const token = args.token ?? process.env.HPLUS_SALES_TOKEN;
    const dryRun = Boolean(args.dry_run);

    if (!dryRun && (!args.api || !token)) {
        fail('Faltan --api y/o --token para publicar. Usa --dry-run para solo generar el manifiesto.');
    }

    log(`Raíz     : ${root}`);
    log(`Config   : ${config._source ?? '(valores por defecto)'}`);
    log(`Modo     : ${dryRun ? 'dry-run (no publica)' : `publicar en ${args.api}`}`);
    if (args.client) log(`Cliente  : ${args.client}`);
    if (args.since) log(`Desde    : ${args.since}`);
    log('');

    // 1. Recorrido
    const { files, warnings: scanWarnings } = await scanCommercialFolder(root, {
        client: args.client,
        since: args.since,
        maxDepth: config.max_depth,
    });

    for (const w of scanWarnings) warn(w);

    if (files.length === 0) {
        log('No se encontraron archivos que procesar.');
        return;
    }

    const clients = new Set(files.map((f) => f.detected_client_folder));
    log(`Encontrados ${files.length} archivos en ${clients.size} clientes.`);

    // 2. Agrupación en familias propuesta + modelo
    const groups = groupByProposal(files);
    log(`Agrupados en ${groups.length} propuestas candidatas.\n`);

    // 3. Hash y extracción
    const payloadFiles = [];
    let parsed = 0;
    let unparsed = 0;

    for (const group of groups) {
        const groupFiles = [group.model, group.document, ...group.others].filter(Boolean);

        for (const file of groupFiles) {
            const entry = {
                relative_path: file.relative_path,
                file_name: file.file_name,
                file_extension: file.file_extension,
                file_size_bytes: file.file_size_bytes,
                file_modified_at: file.file_modified_at,
                file_hash: await hashFile(file.absolute_path),
                detected_client_folder: file.detected_client_folder,
                document_kind: file.document_kind,
                detected_version: file.detected_version,
                detected_date: file.detected_date,
                parse_confidence: 0,
                proposal: null,
                warnings: [],
            };

            // Solo el modelo financiero del grupo aporta las líneas. El resto
            // se registra como documento asociado, con su hash, para
            // trazabilidad; extraerles números sería adivinar.
            if (file === group.model) {
                const mapping = selectMapping(config.mappings ?? [], file);
                const result = await parseFinancialModel(file.absolute_path, {
                    mapping,
                    client_folder: file.detected_client_folder,
                    detected_date: file.detected_date,
                    default_title: path.basename(file.file_name, file.file_extension),
                });

                entry.proposal = result.proposal;
                entry.parse_confidence = result.confidence;
                entry.warnings = result.warnings;
                entry.parse_strategy = result.strategy;

                if (result.proposal) {
                    parsed++;
                    // El documento de la propuesta acompaña al modelo: se
                    // referencia para poder abrirlo desde el ERP.
                    if (group.document) {
                        entry.companion_document = {
                            relative_path: group.document.relative_path,
                            file_name: group.document.file_name,
                        };
                    }
                    const flag = result.confidence < config.min_confidence ? ' [REVISAR]' : '';
                    log(
                        `  ✓ ${file.detected_client_folder} · ${file.file_name} → ` +
                        `${result.proposal.lines.length} líneas, confianza ${result.confidence}% (${result.strategy})${flag}`
                    );
                } else {
                    unparsed++;
                    log(`  ✗ ${file.detected_client_folder} · ${file.file_name} → sin líneas legibles`);
                }

                if (args.verbose) for (const w of result.warnings) warn(`      ${w}`);
            }

            payloadFiles.push(entry);
        }
    }

    log(`\nModelos con líneas: ${parsed}. Sin líneas: ${unparsed}. Archivos totales: ${payloadFiles.length}.`);

    const payload = {
        source: 'ONEDRIVE_CLI',
        root_path: root,
        machine_name: os.hostname(),
        min_confidence: config.min_confidence,
        files: payloadFiles,
    };

    // 4. Salida
    if (dryRun) {
        const out = args.out ?? 'sales-sync-manifest.json';
        await fs.writeFile(out, JSON.stringify(payload, null, 2), 'utf8');
        log(`\nManifiesto escrito en ${path.resolve(out)}.`);
        log('Revísalo y vuelve a ejecutar sin --dry-run para publicarlo.');
        return;
    }

    await publish(payload, args.api, token, config.chunk_size);
}

/** Publica el manifiesto en el ERP por lotes. */
async function publish(payload, apiBase, token, chunkSize) {
    const url = new URL('/api/sales/import', apiBase).toString();
    const chunks = [];
    for (let i = 0; i < payload.files.length; i += chunkSize) {
        chunks.push(payload.files.slice(i, i + chunkSize));
    }

    const totals = { imported: 0, skipped: 0, failed: 0 };
    let batchId = null;

    log(`\nPublicando ${payload.files.length} archivos en ${chunks.length} lote(s)...`);

    for (const [index, chunk] of chunks.entries()) {
        const body = {
            ...payload,
            files: chunk,
            batch_id: batchId,
            is_final: index === chunks.length - 1,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        if (!response.ok) {
            fail(`El ERP respondió ${response.status}: ${text.slice(0, 500)}`);
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            fail(`Respuesta no válida del ERP: ${text.slice(0, 300)}`);
        }

        batchId ??= result.batch_id;
        totals.imported += result.imported ?? 0;
        totals.skipped += result.skipped ?? 0;
        totals.failed += result.failed ?? 0;

        log(`  Lote ${index + 1}/${chunks.length}: ${result.imported ?? 0} importados, ` +
            `${result.skipped ?? 0} ya existentes, ${result.failed ?? 0} con error.`);

        for (const err of result.errors ?? []) warn(`    ${err.file_name}: ${err.message}`);
    }

    log(`\nLote ${batchId}: ${totals.imported} importados, ${totals.skipped} ya existentes, ${totals.failed} con error.`);
    if (totals.failed > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------

function log(message) {
    console.log(message);
}

function warn(message) {
    console.warn(`  ! ${message}`);
}

function fail(message) {
    console.error(`\nError: ${message}`);
    process.exit(1);
}

main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
});
