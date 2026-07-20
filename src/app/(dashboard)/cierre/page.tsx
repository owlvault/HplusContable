'use client';

import { useState, useEffect } from 'react';
import { 
    getYearClosingSummary, 
    validatePeriodForClosing, 
    closeAccountingPeriod, 
    reopenAccountingPeriod,
    lockAccountingPeriod
} from '@/actions/cierre';
import { Calendar, Lock, Unlock, CheckCircle, AlertTriangle, XCircle, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function CierrePage() {
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear());
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<{ year: number; month: number } | null>(null);
    const [validation, setValidation] = useState<any>(null);
    const [validating, setValidating] = useState(false);
    const [closing, setClosing] = useState(false);
    const [closingNotes, setClosingNotes] = useState('');
    
    // Dialogs
    const [confirmReopenDialog, setConfirmReopenDialog] = useState<{ open: boolean; month: number | null }>({ open: false, month: null });
    const [confirmLockDialog, setConfirmLockDialog] = useState<{ open: boolean; month: number | null }>({ open: false, month: null });

    useEffect(() => {
        loadSummary();
    }, [year]);

    const loadSummary = async () => {
        setLoading(true);
        try {
            const data = await getYearClosingSummary(year);
            setSummary(data);
        } catch (error) {
            console.error('Error loading summary:', error);
            toast({
                title: 'Error',
                description: 'No se pudo cargar el resumen del año',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (month: number) => {
        setSelectedPeriod({ year, month });
        setValidating(true);
        setValidation(null);
        
        try {
            const result = await validatePeriodForClosing(year, month);
            setValidation(result);
        } catch (error: any) {
            toast({
                title: 'Error de validación',
                description: error.message || 'No se pudo validar el período',
                variant: 'destructive',
            });
        } finally {
            setValidating(false);
        }
    };

    const handleClose = async () => {
        if (!selectedPeriod || !validation?.isValid) return;
        
        setClosing(true);
        try {
            await closeAccountingPeriod(selectedPeriod.year, selectedPeriod.month, closingNotes);
            toast({
                title: 'Período cerrado',
                description: `${MONTHS[selectedPeriod.month - 1]} ${selectedPeriod.year} ha sido cerrado exitosamente`,
                variant: 'success',
            });
            setSelectedPeriod(null);
            setValidation(null);
            setClosingNotes('');
            loadSummary();
        } catch (error: any) {
            toast({
                title: 'Error al cerrar',
                description: error.message || 'No se pudo cerrar el período',
                variant: 'destructive',
            });
        } finally {
            setClosing(false);
        }
    };

    const handleReopen = async () => {
        if (!confirmReopenDialog.month) return;
        const month = confirmReopenDialog.month;
        setConfirmReopenDialog({ open: false, month: null });
        
        try {
            await reopenAccountingPeriod(year, month);
            toast({
                title: 'Período reabierto',
                description: `${MONTHS[month - 1]} ${year} ha sido reabierto`,
                variant: 'success',
            });
            loadSummary();
        } catch (error: any) {
            toast({
                title: 'Error al reabrir',
                description: error.message || 'No se pudo reabrir el período',
                variant: 'destructive',
            });
        }
    };

    const handleLock = async () => {
        if (!confirmLockDialog.month) return;
        const month = confirmLockDialog.month;
        setConfirmLockDialog({ open: false, month: null });
        
        try {
            await lockAccountingPeriod(year, month);
            toast({
                title: 'Período bloqueado',
                description: `${MONTHS[month - 1]} ${year} ha sido bloqueado permanentemente`,
                variant: 'success',
            });
            loadSummary();
        } catch (error: any) {
            toast({
                title: 'Error al bloquear',
                description: error.message || 'No se pudo bloquear el período',
                variant: 'destructive',
            });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'OPEN':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        <Unlock size={12} />
                        Abierto
                    </span>
                );
            case 'CLOSED':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        <Lock size={12} />
                        Cerrado
                    </span>
                );
            case 'LOCKED':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        <Shield size={12} />
                        Bloqueado
                    </span>
                );
            default:
                return null;
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div data-testid="cierre-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Cierre Contable</h1>
                <p className="text-gray-500 mt-1">Gestiona el cierre de períodos contables</p>
            </div>

            {/* Year Selector */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center gap-4">
                    <label className="font-medium text-gray-700">Año:</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        {[2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    
                    {summary && (
                        <div className="flex gap-4 ml-auto text-sm">
                            <span className="text-green-600">Abiertos: {summary.openCount}</span>
                            <span className="text-yellow-600">Cerrados: {summary.closedCount}</span>
                            <span className="text-red-600">Bloqueados: {summary.lockedCount}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Periods Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                    {MONTHS.map((monthName, index) => {
                        const month = index + 1;
                        const period = summary?.periods?.find((p: any) => p.month === month);
                        const status = period?.status || 'OPEN';
                        const isSelected = selectedPeriod?.month === month && selectedPeriod?.year === year;

                        return (
                            <div
                                key={month}
                                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                                    isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={18} className="text-gray-400" />
                                        <span className="font-semibold text-gray-900">{monthName}</span>
                                    </div>
                                    {getStatusBadge(status)}
                                </div>

                                {period?.closed_at && (
                                    <p className="text-xs text-gray-500 mb-3">
                                        Cerrado: {new Date(period.closed_at).toLocaleDateString('es-CO')}
                                    </p>
                                )}

                                <div className="flex gap-2">
                                    {status === 'OPEN' && (
                                        <button
                                            onClick={() => handleValidate(month)}
                                            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Validar
                                        </button>
                                    )}
                                    {status === 'CLOSED' && (
                                        <>
                                            <button
                                                onClick={() => setConfirmReopenDialog({ open: true, month })}
                                                className="flex-1 px-3 py-1.5 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                            >
                                                Reabrir
                                            </button>
                                            <button
                                                onClick={() => setConfirmLockDialog({ open: true, month })}
                                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                                title="Bloquear permanentemente"
                                            >
                                                <Shield size={14} />
                                            </button>
                                        </>
                                    )}
                                    {status === 'LOCKED' && (
                                        <span className="flex-1 text-center text-sm text-gray-500 py-1.5">
                                            Período bloqueado
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Validation Results */}
            {selectedPeriod && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Validación: {MONTHS[selectedPeriod.month - 1]} {selectedPeriod.year}
                    </h2>

                    {validating ? (
                        <div className="flex items-center gap-3 py-8 justify-center">
                            <Loader2 className="animate-spin text-blue-600" size={24} />
                            <span className="text-gray-600">Validando período...</span>
                        </div>
                    ) : validation ? (
                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">{validation.stats.totalEntries}</p>
                                    <p className="text-xs text-gray-500">Asientos</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(validation.stats.totalDebit)}</p>
                                    <p className="text-xs text-gray-500">Total Débitos</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(validation.stats.totalCredit)}</p>
                                    <p className="text-xs text-gray-500">Total Créditos</p>
                                </div>
                                <div className="text-center">
                                    <p className={`text-2xl font-bold ${validation.stats.draftEntries > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {validation.stats.draftEntries}
                                    </p>
                                    <p className="text-xs text-gray-500">Borradores</p>
                                </div>
                                <div className="text-center">
                                    <p className={`text-2xl font-bold ${validation.stats.unbalancedEntries > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {validation.stats.unbalancedEntries}
                                    </p>
                                    <p className="text-xs text-gray-500">Desbalanceados</p>
                                </div>
                            </div>

                            {/* Errors */}
                            {validation.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="text-red-600" size={18} />
                                        <span className="font-medium text-red-800">Errores (debe corregir)</span>
                                    </div>
                                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                        {validation.errors.map((error: string, i: number) => (
                                            <li key={i}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Warnings */}
                            {validation.warnings.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="text-yellow-600" size={18} />
                                        <span className="font-medium text-yellow-800">Advertencias</span>
                                    </div>
                                    <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                                        {validation.warnings.map((warning: string, i: number) => (
                                            <li key={i}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Success */}
                            {validation.isValid && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="text-green-600" size={18} />
                                        <span className="font-medium text-green-800">El período está listo para cerrar</span>
                                    </div>
                                </div>
                            )}

                            {/* Close Form */}
                            {validation.isValid && (
                                <div className="border-t pt-4 mt-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Notas de cierre (opcional)
                                        </label>
                                        <textarea
                                            value={closingNotes}
                                            onChange={(e) => setClosingNotes(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            rows={2}
                                            placeholder="Observaciones del cierre..."
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleClose}
                                            disabled={closing}
                                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {closing ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Cerrando...
                                                </>
                                            ) : (
                                                <>
                                                    <Lock size={18} />
                                                    Cerrar Período
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { setSelectedPeriod(null); setValidation(null); }}
                                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Confirm Reopen Dialog */}
            <Dialog open={confirmReopenDialog.open} onOpenChange={(open) => setConfirmReopenDialog({ ...confirmReopenDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reabrir Período</DialogTitle>
                        <DialogDescription>
                            ¿Está seguro de reabrir el período de {confirmReopenDialog.month ? MONTHS[confirmReopenDialog.month - 1] : ''} {year}?
                            Esto permitirá modificar los asientos contables de ese mes.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            onClick={() => setConfirmReopenDialog({ open: false, month: null })}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleReopen}
                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                        >
                            Sí, Reabrir
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Lock Dialog */}
            <Dialog open={confirmLockDialog.open} onOpenChange={(open) => setConfirmLockDialog({ ...confirmLockDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Bloquear Período Permanentemente</DialogTitle>
                        <DialogDescription>
                            <span className="text-red-600 font-medium">¡ATENCIÓN!</span> Esta acción es <strong>IRREVERSIBLE</strong>.
                            <br /><br />
                            El período de {confirmLockDialog.month ? MONTHS[confirmLockDialog.month - 1] : ''} {year} quedará bloqueado permanentemente y no podrá ser modificado ni reabierto.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            onClick={() => setConfirmLockDialog({ open: false, month: null })}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleLock}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Sí, Bloquear Permanentemente
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
