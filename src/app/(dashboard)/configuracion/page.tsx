'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { seedDatabase } from '@/actions/seed';
import { Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { InvoiceTemplateConfig } from '@/components/configuracion/invoice-template-config';
import { BackupWidget } from '@/components/configuracion/backup-widget';
import { BankIntegration } from '@/components/tesoreria/bank-integration';
import { getSpanishErrorMessage } from '@/lib/error-messages';

export default function ConfigPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSeed = async () => {
        setLoading(true);
        setError(null);
        try {
            const seedResults = await seedDatabase();
            setResults(seedResults);
            router.refresh();
        } catch (err) {
            setError(getSpanishErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div data-testid="config-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                <p className="text-gray-500 mt-1">
                    Configura los parámetros del sistema
                </p>
            </div>

            <div className="space-y-6">
                {/* Seed Data Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Database className="text-blue-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900">Datos Semilla</h2>
                            <p className="text-gray-600 mt-1 text-sm">
                                Esta acción creará:
                            </p>
                            <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                                <li>Plan Único de Cuentas (PUC) básico colombiano</li>
                                <li>Terceros de prueba (3 clientes, 2 proveedores, 1 mixto)</li>
                            </ul>
                            
                            <button
                                onClick={handleSeed}
                                disabled={loading}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                data-testid="seed-btn"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Inicializando...
                                    </>
                                ) : (
                                    <>
                                        <Database size={18} />
                                        Inicializar Datos
                                    </>
                                )}
                            </button>

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="text-red-600 shrink-0" size={18} />
                                    <p className="text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            {results && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="text-green-600" size={18} />
                                        <span className="font-medium text-green-800">Datos inicializados</span>
                                    </div>
                                    <div className="text-sm text-green-700 space-y-1">
                                        <p>PUC: {results.puc.inserted} cuentas creadas</p>
                                        <p>Terceros: {results.thirdParties.inserted} registros creados</p>
                                        {results.puc.errors.length > 0 && (
                                            <p className="text-orange-600">
                                                Errores PUC: {results.puc.errors.length}
                                            </p>
                                        )}
                                        {results.thirdParties.errors.length > 0 && (
                                            <p className="text-orange-600">
                                                Errores Terceros: {results.thirdParties.errors.length}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Invoice Templates Section */}
                <InvoiceTemplateConfig />

                {/* Backup & Bank Integration Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <BackupWidget />
                    <BankIntegration connections={[]} onRefresh={() => router.refresh()} />
                </div>

                {/* Note */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl">
                    <h3 className="font-medium text-yellow-800 mb-2">Nota Importante</h3>
                    <p className="text-sm text-yellow-700">
                        Si ya existen datos, no se duplicarán (upsert). Esta operación es segura de ejecutar múltiples veces.
                    </p>
                </div>
            </div>
        </div>
    );
}
