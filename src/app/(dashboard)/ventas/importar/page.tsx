import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { getImportBatches } from '@/actions/sales';
import { formatDate } from '@/lib/utils/format';

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
    COMPLETADO: { icon: CheckCircle2, className: 'text-green-600', label: 'Completado' },
    EN_PROCESO: { icon: Clock, className: 'text-blue-600', label: 'En proceso' },
    CON_ERRORES: { icon: XCircle, className: 'text-red-600', label: 'Con errores' },
    CANCELADO: { icon: XCircle, className: 'text-gray-400', label: 'Cancelado' },
};

export default async function ImportarPage() {
    const batches = await getImportBatches().catch(() => []);

    return (
        <div data-testid="ventas-importar">
            <Link href="/ventas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
                <ArrowLeft size={16} /> Volver a Ventas
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Importar carpeta Comercial</h1>
                <p className="text-gray-500 mt-1">
                    Las propuestas viven en OneDrive, en la máquina de cada comercial. El ERP no puede
                    leer esa carpeta directamente, así que la ingesta la ejecuta un sincronizador local.
                </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <h2 className="font-semibold text-gray-900 mb-3">Cómo cargar las propuestas</h2>
                <ol className="space-y-3 text-sm text-gray-700">
                    <li>
                        <strong>1. Instalar el sincronizador</strong> (una sola vez, en la máquina que tiene
                        la carpeta sincronizada):
                        <pre className="mt-1 bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
{`cd tools\\sales-sync
npm install`}
                        </pre>
                    </li>
                    <li>
                        <strong>2. Revisar qué se va a cargar</strong> sin escribir nada en el ERP:
                        <pre className="mt-1 bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
{`node sync.mjs --root "C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Comercial" ^
              --dry-run --out manifiesto.json`}
                        </pre>
                        <span className="text-gray-500">
                            Revisa <code>manifiesto.json</code>: trae, por archivo, las líneas detectadas y
                            el nivel de confianza de la extracción.
                        </span>
                    </li>
                    <li>
                        <strong>3. Publicar en el ERP:</strong>
                        <pre className="mt-1 bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
{`node sync.mjs --root "C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Comercial" ^
              --api https://tu-erp --token %HPLUS_SALES_TOKEN%`}
                        </pre>
                    </li>
                </ol>

                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-1">
                    <p>
                        <strong>Nada se sobrescribe por accidente:</strong> cada archivo se identifica por el
                        hash de su contenido, así que reejecutar el comando no duplica propuestas.
                    </p>
                    <p>
                        <strong>Para extracción exacta,</strong> añade una hoja <code>ERP_EXPORT</code> a la
                        plantilla del modelo financiero. Sin ella el sincronizador deduce las columnas y
                        marca la propuesta para revisión.
                    </p>
                </div>
            </div>

            <h2 className="font-semibold text-gray-900 mb-3">Historial de cargas</h2>

            {batches.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                    Todavía no se ha ejecutado ninguna carga.
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="text-left font-medium px-4 py-3">Fecha</th>
                                <th className="text-left font-medium px-4 py-3">Estado</th>
                                <th className="text-left font-medium px-4 py-3">Origen</th>
                                <th className="text-right font-medium px-4 py-3">Revisados</th>
                                <th className="text-right font-medium px-4 py-3">Importados</th>
                                <th className="text-right font-medium px-4 py-3">Ya existentes</th>
                                <th className="text-right font-medium px-4 py-3">Con error</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {batches.map((batch) => {
                                const style = STATUS_STYLE[batch.status] ?? STATUS_STYLE.EN_PROCESO;
                                const Icon = style.icon;
                                return (
                                    <tr key={batch.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-700">{formatDate(batch.started_at)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 ${style.className}`}>
                                                <Icon size={16} />
                                                {style.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {batch.machine_name ?? batch.source}
                                            <div className="text-gray-400 truncate max-w-xs">{batch.root_path}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{batch.files_scanned}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-green-600 font-medium">
                                            {batch.files_imported}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{batch.files_skipped}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{batch.files_failed}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
