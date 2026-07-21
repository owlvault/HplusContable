'use client';

import { useState } from 'react';
import { Building2, RefreshCw, Link2, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface BankConnection {
    id: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    status: 'connected' | 'pending' | 'error' | 'disconnected';
    lastSync?: string;
    logo?: string;
}

// Bancos colombianos disponibles para conexión
const AVAILABLE_BANKS = [
    { code: 'bancolombia', name: 'Bancolombia', logo: '🏦' },
    { code: 'davivienda', name: 'Davivienda', logo: '🏛️' },
    { code: 'bbva', name: 'BBVA Colombia', logo: '🔵' },
    { code: 'bogota', name: 'Banco de Bogotá', logo: '🟡' },
    { code: 'occidente', name: 'Banco de Occidente', logo: '🟢' },
    { code: 'popular', name: 'Banco Popular', logo: '🔴' },
    { code: 'avvillas', name: 'Banco AV Villas', logo: '🟠' },
    { code: 'scotiabank', name: 'Scotiabank Colpatria', logo: '🔷' },
];

interface BankIntegrationProps {
    connections: BankConnection[];
    onRefresh: () => void;
}

export function BankIntegration({ connections, onRefresh }: BankIntegrationProps) {
    const { toast } = useToast();
    const [showConnectDialog, setShowConnectDialog] = useState(false);
    const [selectedBank, setSelectedBank] = useState<typeof AVAILABLE_BANKS[0] | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);

    const handleConnect = async () => {
        if (!selectedBank) return;
        
        setConnecting(true);
        
        // Simular proceso de conexión OAuth
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast({
            title: 'Conexión iniciada',
            description: `Se ha iniciado el proceso de conexión con ${selectedBank.name}. Recibirás una notificación cuando esté lista.`,
            variant: 'success',
        });
        
        setConnecting(false);
        setShowConnectDialog(false);
        setSelectedBank(null);
    };

    const handleSync = async (connectionId: string, bankName: string) => {
        setSyncing(connectionId);
        
        // Simular sincronización
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        toast({
            title: 'Sincronización completada',
            description: `Los movimientos de ${bankName} se han importado correctamente.`,
            variant: 'success',
        });
        
        setSyncing(null);
        onRefresh();
    };

    const getStatusIcon = (status: BankConnection['status']) => {
        switch (status) {
            case 'connected':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'pending':
                return <Clock size={16} className="text-yellow-500" />;
            case 'error':
                return <AlertCircle size={16} className="text-red-500" />;
            default:
                return <AlertCircle size={16} className="text-gray-400" />;
        }
    };

    const getStatusLabel = (status: BankConnection['status']) => {
        switch (status) {
            case 'connected': return 'Conectado';
            case 'pending': return 'Pendiente';
            case 'error': return 'Error';
            default: return 'Desconectado';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Building2 size={18} />
                    Integración Bancaria
                </h3>
                <button
                    onClick={() => setShowConnectDialog(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Link2 size={14} />
                    Conectar Banco
                </button>
            </div>

            <div className="p-4">
                {connections.length === 0 ? (
                    <div className="text-center py-8">
                        <Building2 className="mx-auto text-gray-300 mb-3" size={48} />
                        <p className="text-gray-500 text-sm">No hay bancos conectados</p>
                        <p className="text-gray-400 text-xs mt-1">
                            Conecta tu banco para importar movimientos automáticamente
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connections.map((conn) => (
                            <div 
                                key={conn.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{conn.logo || '🏦'}</span>
                                    <div>
                                        <div className="font-medium text-gray-900">{conn.bankName}</div>
                                        <div className="text-sm text-gray-500">
                                            {conn.accountNumber}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-sm">
                                            {getStatusIcon(conn.status)}
                                            <span className="text-gray-600">{getStatusLabel(conn.status)}</span>
                                        </div>
                                        {conn.lastSync && (
                                            <div className="text-xs text-gray-400">
                                                Última sync: {new Date(conn.lastSync).toLocaleString('es-CO')}
                                            </div>
                                        )}
                                    </div>
                                    {conn.status === 'connected' && (
                                        <button
                                            onClick={() => handleSync(conn.id, conn.bankName)}
                                            disabled={syncing === conn.id}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                                            title="Sincronizar movimientos"
                                        >
                                            {syncing === conn.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={18} />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info Banner */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm text-blue-700">
                        <strong>Open Banking:</strong> Conecta tus cuentas bancarias de forma segura para importar 
                        movimientos automáticamente y facilitar la conciliación bancaria.
                    </p>
                </div>
            </div>

            {/* Connect Dialog */}
            <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Conectar Banco</DialogTitle>
                        <DialogDescription>
                            Selecciona tu banco para iniciar el proceso de conexión segura
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {AVAILABLE_BANKS.map((bank) => (
                            <button
                                key={bank.code}
                                onClick={() => setSelectedBank(bank)}
                                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                                    selectedBank?.code === bank.code
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <span className="text-xl">{bank.logo}</span>
                                <span className="text-sm font-medium text-gray-700">{bank.name}</span>
                            </button>
                        ))}
                    </div>

                    <DialogFooter>
                        <button
                            onClick={() => setShowConnectDialog(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConnect}
                            disabled={!selectedBank || connecting}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {connecting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    <Link2 size={16} />
                                    Conectar
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
