'use client';

import { useState } from 'react';
import { Download, Database, Loader2, Calendar, HardDrive, CheckCircle } from 'lucide-react';
import { generateBackupJSON, getBackupStats, exportPeriodData } from '@/actions/backup';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

export function BackupWidget() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [backupType, setBackupType] = useState<'full' | 'period'>('full');
    const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
    const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
    const [stats, setStats] = useState<any[]>([]);
    const [lastBackup, setLastBackup] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            const data = await getBackupStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleOpenDialog = async () => {
        setShowDialog(true);
        await loadStats();
    };

    const handleBackup = async () => {
        setLoading(true);
        
        try {
            let jsonData: string;
            let filename: string;
            
            if (backupType === 'full') {
                jsonData = await generateBackupJSON();
                filename = `hplus-contable-backup-completo-${new Date().toISOString().split('T')[0]}.json`;
            } else {
                const data = await exportPeriodData(periodYear, periodMonth);
                jsonData = JSON.stringify(data, null, 2);
                filename = `hplus-contable-backup-${periodYear}-${String(periodMonth).padStart(2, '0')}.json`;
            }
            
            // Download file
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setLastBackup(new Date().toISOString());
            
            toast({
                title: 'Backup completado',
                description: `El archivo ${filename} se ha descargado exitosamente`,
                variant: 'success',
            });
            
            setShowDialog(false);
        } catch {
            toast({
                title: 'Error',
                description: 'No se pudo generar el backup',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const months = [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' },
    ];

    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <HardDrive size={18} />
                        Backup de Datos
                    </h3>
                </div>

                <div className="p-4">
                    <div className="text-center py-4">
                        <Database className="mx-auto text-blue-500 mb-3" size={40} />
                        <p className="text-gray-600 text-sm mb-2">
                            Exporta tus datos contables para respaldo
                        </p>
                        {lastBackup && (
                            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                                <CheckCircle size={12} className="text-green-500" />
                                Último backup: {new Date(lastBackup).toLocaleString('es-CO')}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleOpenDialog}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Download size={18} />
                        Generar Backup
                    </button>

                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <p className="text-xs text-yellow-700">
                            <strong>Recomendación:</strong> Realiza backups semanales para proteger tu información contable.
                        </p>
                    </div>
                </div>
            </div>

            {/* Backup Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generar Backup</DialogTitle>
                        <DialogDescription>
                            Selecciona el tipo de backup que deseas generar
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Backup Type Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setBackupType('full')}
                                className={`p-4 rounded-lg border-2 text-left ${
                                    backupType === 'full' 
                                        ? 'border-blue-500 bg-blue-50' 
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <Database className={`mb-2 ${backupType === 'full' ? 'text-blue-600' : 'text-gray-400'}`} size={24} />
                                <p className="font-medium">Backup Completo</p>
                                <p className="text-xs text-gray-500 mt-1">Todos los datos contables</p>
                            </button>
                            <button
                                onClick={() => setBackupType('period')}
                                className={`p-4 rounded-lg border-2 text-left ${
                                    backupType === 'period' 
                                        ? 'border-blue-500 bg-blue-50' 
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <Calendar className={`mb-2 ${backupType === 'period' ? 'text-blue-600' : 'text-gray-400'}`} size={24} />
                                <p className="font-medium">Por Período</p>
                                <p className="text-xs text-gray-500 mt-1">Solo un mes específico</p>
                            </button>
                        </div>

                        {/* Period Selection */}
                        {backupType === 'period' && (
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                                    <select
                                        value={periodYear}
                                        onChange={(e) => setPeriodYear(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        {[2024, 2025, 2026].map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                                    <select
                                        value={periodMonth}
                                        onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        {months.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        {stats.length > 0 && backupType === 'full' && (
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">Registros a exportar:</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {stats.map((stat) => (
                                        <div key={stat.table} className="flex justify-between text-gray-600">
                                            <span>{stat.table.replace('_', ' ')}</span>
                                            <span className="font-medium">{stat.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <button
                            onClick={() => setShowDialog(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleBackup}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    Descargar Backup
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
