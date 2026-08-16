import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
    accumulateBatchCounters,
    closeImportBatch,
    importFiles,
    openImportBatch,
} from '@/lib/sales/import';
import type { ImportFilePayload } from '@/types/sales';

// La ingesta escribe en la base y nunca debe servirse desde caché.
export const dynamic = 'force-dynamic';

interface ImportRequestBody {
    source?: string;
    root_path?: string;
    machine_name?: string;
    min_confidence?: number;
    /** Presente a partir del segundo lote, para acumular en el mismo batch. */
    batch_id?: string | null;
    is_final?: boolean;
    files?: ImportFilePayload[];
}

/**
 * Compara en tiempo constante para no filtrar el token por diferencia de
 * tiempos de respuesta.
 */
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function authorize(request: NextRequest): string | null {
    const expected = process.env.SALES_IMPORT_TOKEN;
    if (!expected) return 'SALES_IMPORT_TOKEN no está configurado en el servidor.';

    const header = request.headers.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return 'Falta el encabezado Authorization: Bearer <token>.';
    if (!safeEqual(token, expected)) return 'Token de ingesta inválido.';

    return null;
}

export async function POST(request: NextRequest) {
    const authError = authorize(request);
    if (authError) {
        return NextResponse.json({ error: authError }, { status: 401 });
    }

    let body: ImportRequestBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'El cuerpo no es JSON válido.' }, { status: 400 });
    }

    const files = body.files ?? [];
    if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    // Cota defensiva: el CLI ya envía por lotes, un cuerpo mayor indica
    // un cliente mal configurado y no vale la pena procesarlo.
    if (files.length > 200) {
        return NextResponse.json(
            { error: 'Máximo 200 archivos por lote. Reduce chunk_size en la configuración.' },
            { status: 413 }
        );
    }

    try {
        const supabase = createServiceClient();

        const batchId =
            body.batch_id ??
            (await openImportBatch(supabase, {
                source: body.source ?? 'ONEDRIVE_CLI',
                rootPath: body.root_path ?? '',
                machineName: body.machine_name,
            }));

        const summary = await importFiles(supabase, batchId, files, {
            minConfidence: body.min_confidence,
        });

        await accumulateBatchCounters(supabase, batchId, {
            imported: summary.imported,
            skipped: summary.skipped,
            failed: summary.failed,
            scanned: files.length,
        });

        if (body.is_final) {
            await closeImportBatch(
                supabase,
                batchId,
                summary.errors.length > 0
                    ? summary.errors.map((e) => `${e.file_name}: ${e.message}`).join('\n')
                    : null
            );
        }

        return NextResponse.json({
            batch_id: batchId,
            imported: summary.imported,
            skipped: summary.skipped,
            failed: summary.failed,
            results: summary.results,
            errors: summary.errors,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error en la ingesta de ventas:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
