// Aplica las migraciones SQL de supabase/migrations en orden, dentro de una
// transacción por archivo. Requiere la variable de entorno DATABASE_URL con la
// cadena de conexión de Postgres del proyecto Supabase, por ejemplo:
//
//   postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres
//   (o el pooler: postgresql://postgres.<ref>:[PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres)
//
// Uso:
//   DATABASE_URL="..." node scripts/apply-migrations.mjs           (todas)
//   DATABASE_URL="..." node scripts/apply-migrations.mjs 0003 0007 (rango por prefijo)
//
// Es idempotente: las migraciones usan IF NOT EXISTS / ON CONFLICT / CREATE OR
// REPLACE, por lo que re-ejecutarlas no daña datos existentes.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('ERROR: falta la variable de entorno DATABASE_URL.');
    process.exit(1);
}

// Filtro opcional por prefijos (ej. "0003" "0004"); si no, aplica solo 0003+.
const onlyPrefixes = process.argv.slice(2);
const shouldRun = (file) => {
    const prefix = file.slice(0, 4);
    if (onlyPrefixes.length > 0) return onlyPrefixes.includes(prefix);
    return prefix >= '0003'; // por defecto, solo las fases nuevas
};

const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter(shouldRun);

if (files.length === 0) {
    console.log('No hay migraciones que aplicar con ese filtro.');
    process.exit(0);
}

const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase requiere SSL
});

const run = async () => {
    await client.connect();
    console.log(`Conectado. Aplicando ${files.length} migración(es):\n`);

    for (const file of files) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        process.stdout.write(`→ ${file} ... `);
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('COMMIT');
            console.log('OK');
        } catch (err) {
            await client.query('ROLLBACK');
            console.log('FALLÓ (rollback)');
            console.error(`\n  ${err.message}\n`);
            throw err;
        }
    }
    console.log('\nTodas las migraciones se aplicaron correctamente.');
};

run()
    .catch((err) => {
        console.error('Abortado:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await client.end();
    });
