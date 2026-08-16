#!/usr/bin/env node
// Genera src/types/database.ts desde el esquema real de Supabase.
//
// Se escribe el archivo desde Node y no con una redirección del shell porque
// PowerShell emite UTF-16 con `>` y UTF-8 con BOM con `Out-File`, y ambas
// cosas dejan el archivo inservible para TypeScript.
//
//   npm run types:gen
//
// Autenticación, en este orden:
//   1. SUPABASE_DB_URL   cadena de conexión directa (no necesita login)
//   2. supabase login    o la variable SUPABASE_ACCESS_TOKEN
//
// El id del proyecto sale de SUPABASE_PROJECT_ID o del valor por defecto.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT = path.join(process.cwd(), 'src', 'types', 'database.ts');
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID ?? 'fitjpyqrecgvlrlpwipn';
const DB_URL = process.env.SUPABASE_DB_URL;

const args = ['--yes', 'supabase@latest', 'gen', 'types', 'typescript', '--schema', 'public'];
args.push(...(DB_URL ? ['--db-url', DB_URL] : ['--project-id', PROJECT_ID]));

console.log(`Generando tipos desde ${DB_URL ? 'la URL de base de datos' : `el proyecto ${PROJECT_ID}`}...`);

const result = spawnSync('npx', args, {
    encoding: 'utf8',
    // El CLI se descarga en la primera ejecución; en Windows npx es un .cmd.
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
});

if (result.error) {
    fail(`No se pudo ejecutar npx: ${result.error.message}`);
}

const output = result.stdout ?? '';
// El CLI reporta los fallos como JSON por la salida estándar, no por stderr,
// así que hay que mirar las dos para diagnosticar.
const diagnostics = [output, result.stderr ?? ''].join('\n').trim();

if (!output.includes('export type Database')) {
    fail(buildFailureMessage(diagnostics));
}

// El CLI a veces antepone líneas de progreso antes del contenido del módulo.
const start = output.indexOf('export type Json');
const contents = start > 0 ? output.slice(start) : output;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
// utf8 sin BOM: Node no lo añade, a diferencia de Out-File en PowerShell.
fs.writeFileSync(OUTPUT, contents, 'utf8');

const tables = (contents.match(/^ {6}\w+: \{$/gm) ?? []).length;
console.log(`Escrito ${path.relative(process.cwd(), OUTPUT)} (${contents.length} bytes).`);
console.log(`Tablas y vistas detectadas: ~${tables}.`);
console.log('\nRevisa el archivo, haz commit y avísame para tipar el cliente de Supabase.');

/** Extrae el mensaje del envoltorio JSON de error del CLI, si viene en él. */
function cliErrorMessage(text) {
    const match = text.match(/\{"_tag":"Error".*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0])?.error?.message ?? null;
    } catch {
        return null;
    }
}

function buildFailureMessage(diagnostics) {
    const message = cliErrorMessage(diagnostics) ?? diagnostics;

    if (/access token|not logged in|unauthorized|AuthRequired/i.test(message)) {
        return (
            `${message}\n\n` +
            'Elige una de las dos vías:\n\n' +
            '  A) Iniciar sesión una vez (abre el navegador):\n' +
            '       npx supabase login\n' +
            '       npm run types:gen\n\n' +
            '  B) Sin login, con la cadena de conexión de la base:\n' +
            '     Dashboard → Project Settings → Database → Connection string → URI\n' +
            '       $env:SUPABASE_DB_URL = "postgresql://postgres:TU_PASSWORD@db.<ref>.supabase.co:5432/postgres"\n' +
            '       npm run types:gen'
        );
    }
    return message || 'El CLI no devolvió un tipo Database válido.';
}

function fail(message) {
    console.error(`\nError: ${message}`);
    process.exit(1);
}
