'use client';

import { useState, useEffect } from 'react';
import { 
    getBankAccountsForReconciliation, 
    getBankStatements, 
    createBankStatement,
    getStatementWithLines,
    getMovementsForPeriod,
    autoMatchStatementLines,
    manualMatchLine,
    excludeLine,
    completeReconciliation,
    importStatementLines,
    getReconciliationSummary
} from '@/actions/conciliacion';
import { Building2, FileSpreadsheet, Check, X, Link2, AlertTriangle, Loader2, Plus, RefreshCw, Upload, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function ConciliacionPage() {
    const { toast } = useToast();
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [statements, setStatements] = useState<any[]>([]);
    const [selectedStatement, setSelectedStatement] = useState<any>(null);
    const [movements, setMovements] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    
    // Dialog states
    const [showNewStatementDialog, setShowNewStatementDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showManualMatchDialog, setShowManualMatchDialog] = useState<any>(null);
    
    // New statement form
    const [newStatement, setNewStatement] = useState({
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
        openingBalance: 0,
        closingBalance: 0,
    });
    
    // CSV import
    const [csvData, setCsvData] = useState('');

    useEffect(() => {
        loadBankAccounts();
    }, []);

    useEffect(() => {
        if (selectedAccount) {
            loadStatements(selectedAccount);
        }
    }, [selectedAccount]);

    useEffect(() => {
        if (selectedStatement?.id) {
            loadStatementDetails(selectedStatement.id);
        }
    }, [selectedStatement?.id]);

    const loadBankAccounts = async () => {
        setLoading(true);
        try {
            const data = await getBankAccountsForReconciliation();
            setBankAccounts(data);
            if (data.length > 0) {
                setSelectedAccount(data[0].id);
            }
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar las cuentas bancarias', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const loadStatements = async (accountId: string) => {
        try {
            const data = await getBankStatements(accountId);
            setStatements(data);
        } catch (error) {
            console.error('Error loading statements:', error);
        }
    };

    const loadStatementDetails = async (statementId: string) => {
        try {
            const data = await getStatementWithLines(statementId);
            setSelectedStatement(data);
            
            if (data) {
                const movs = await getMovementsForPeriod(data.bank_account_id, data.period_start, data.period_end);
                setMovements(movs);
                
                const sum = await getReconciliationSummary(statementId);
                setSummary(sum);
            }
        } catch (error) {
            console.error('Error loading statement details:', error);
        }
    };

    const handleCreateStatement = async () => {
        if (!selectedAccount) return;
        
        setProcessing(true);
        try {
            const statement = await createBankStatement(
                selectedAccount,
                newStatement.periodStart,
                newStatement.periodEnd,
                newStatement.openingBalance,
                newStatement.closingBalance
            );
            toast({ title: 'Creado', description: 'Extracto bancario creado', variant: 'success' });
            setShowNewStatementDialog(false);
            loadStatements(selectedAccount);
            setSelectedStatement(statement);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleImportCSV = async () => {
        if (!selectedStatement?.id || !csvData.trim()) return;
        
        setProcessing(true);
        try {
            // Parse CSV
            const lines = csvData.trim().split('\n');
            const parsedLines = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
                return {
                    date: cols[0],
                    description: cols[1] || '',
                    reference: cols[2] || null,
                    amount: Math.abs(parseFloat(cols[3]) || 0),
                    type: parseFloat(cols[3]) >= 0 ? 'CREDIT' : 'DEBIT' as const,
                    balance_after: cols[4] ? parseFloat(cols[4]) : null,
                    status: 'PENDING' as const,
                    matched_movement_id: null,
                };
            }).filter(l => l.amount > 0);
            
            await importStatementLines(selectedStatement.id, parsedLines);
            toast({ title: 'Importado', description: `${parsedLines.length} líneas importadas`, variant: 'success' });
            setShowImportDialog(false);
            setCsvData('');
            loadStatementDetails(selectedStatement.id);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleAutoMatch = async () => {
        if (!selectedStatement?.id) return;
        
        setProcessing(true);
        try {
            const result = await autoMatchStatementLines(selectedStatement.id);
            toast({ 
                title: 'Conciliación automática', 
                description: `${result.matchedCount} de ${result.totalLines} líneas conciliadas`, 
                variant: 'success' 
            });
            loadStatementDetails(selectedStatement.id);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleManualMatch = async (lineId: string, movementId: string) => {
        setProcessing(true);
        try {
            await manualMatchLine(lineId, movementId);
            toast({ title: 'Conciliado', description: 'Línea conciliada manualmente', variant: 'success' });
            setShowManualMatchDialog(null);
            loadStatementDetails(selectedStatement.id);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleExclude = async (lineId: string) => {
        setProcessing(true);
        try {
            await excludeLine(lineId, 'Excluido manualmente');
            toast({ title: 'Excluido', description: 'Línea excluida de la conciliación', variant: 'success' });
            loadStatementDetails(selectedStatement.id);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!selectedStatement?.id) return;
        
        setProcessing(true);
        try {
            await completeReconciliation(selectedStatement.id);
            toast({ title: 'Completada', description: 'Conciliación finalizada exitosamente', variant: 'success' });
            loadStatements(selectedAccount);
            loadStatementDetails(selectedStatement.id);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { color: string; label: string }> = {
            PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
            MATCHED: { color: 'bg-green-100 text-green-800', label: 'Conciliado' },
            MANUAL: { color: 'bg-blue-100 text-blue-800', label: 'Manual' },
            EXCLUDED: { color: 'bg-gray-100 text-gray-800', label: 'Excluido' },
            DRAFT: { color: 'bg-gray-100 text-gray-800', label: 'Borrador' },
            IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', label: 'En Proceso' },
            COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completado' },
        };
        const badge = badges[status] || badges.PENDING;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>;
    };

    return (
        <div data-testid="conciliacion-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Conciliación Bancaria</h1>
                <p className="text-gray-500 mt-1">Concilia extractos bancarios con movimientos registrados</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Panel - Account & Statements */}
                <div className="space-y-4">
                    {/* Account Selector */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta Bancaria</label>
                        <select
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                            {bankAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} - {acc.account_number}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Statements List */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium text-gray-900">Extractos</h3>
                            <button
                                onClick={() => setShowNewStatementDialog(true)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {statements.map((stmt) => (
                                <button
                                    key={stmt.id}
                                    onClick={() => setSelectedStatement(stmt)}
                                    className={`w-full p-3 rounded-lg text-left transition-all ${
                                        selectedStatement?.id === stmt.id
                                            ? 'bg-blue-50 border-2 border-blue-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            {new Date(stmt.period_start).toLocaleDateString('es-CO')} - {new Date(stmt.period_end).toLocaleDateString('es-CO')}
                                        </span>
                                        {getStatusBadge(stmt.status)}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Saldo: {formatCurrency(stmt.closing_balance)}
                                    </p>
                                </button>
                            ))}
                            {statements.length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-4">Sin extractos</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Reconciliation */}
                <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 p-6">
                    {selectedStatement ? (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Extracto: {new Date(selectedStatement.period_start).toLocaleDateString('es-CO')} - {new Date(selectedStatement.period_end).toLocaleDateString('es-CO')}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {selectedStatement.bank_account?.name} - {selectedStatement.bank_account?.account_number}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedStatement.status !== 'COMPLETED' && (
                                        <>
                                            <button
                                                onClick={() => setShowImportDialog(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                            >
                                                <Upload size={14} />
                                                Importar CSV
                                            </button>
                                            <button
                                                onClick={handleAutoMatch}
                                                disabled={processing}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
                                                Auto-Conciliar
                                            </button>
                                            {summary?.pending_count === 0 && (
                                                <button
                                                    onClick={handleComplete}
                                                    disabled={processing}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    <CheckCircle size={14} />
                                                    Finalizar
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            {summary && (
                                <div className="grid grid-cols-5 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Saldo Extracto</p>
                                        <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.statement_balance)}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Saldo Libros</p>
                                        <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.book_balance)}</p>
                                    </div>
                                    <div className={`rounded-lg p-3 text-center ${Math.abs(summary.difference) < 0.01 ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <p className="text-xs text-gray-500">Diferencia</p>
                                        <p className={`text-lg font-bold ${Math.abs(summary.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(summary.difference)}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Conciliados</p>
                                        <p className="text-lg font-bold text-green-600">{summary.matched_count}</p>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-gray-500">Pendientes</p>
                                        <p className="text-lg font-bold text-yellow-600">{summary.pending_count}</p>
                                    </div>
                                </div>
                            )}

                            {/* Lines Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-gray-50">
                                            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Fecha</th>
                                            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Descripción</th>
                                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">Monto</th>
                                            <th className="text-center py-2 px-3 text-xs font-medium text-gray-600">Estado</th>
                                            <th className="text-center py-2 px-3 text-xs font-medium text-gray-600">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedStatement.lines || []).map((line: any) => (
                                            <tr key={line.id} className="border-b hover:bg-gray-50">
                                                <td className="py-2 px-3 text-sm">{new Date(line.date).toLocaleDateString('es-CO')}</td>
                                                <td className="py-2 px-3 text-sm">{line.description}</td>
                                                <td className={`py-2 px-3 text-sm text-right font-medium ${line.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {line.type === 'CREDIT' ? '+' : '-'}{formatCurrency(line.amount)}
                                                </td>
                                                <td className="py-2 px-3 text-center">{getStatusBadge(line.status)}</td>
                                                <td className="py-2 px-3 text-center">
                                                    {line.status === 'PENDING' && selectedStatement.status !== 'COMPLETED' && (
                                                        <div className="flex justify-center gap-1">
                                                            <button
                                                                onClick={() => setShowManualMatchDialog(line)}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Conciliar manualmente"
                                                            >
                                                                <Link2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleExclude(line.id)}
                                                                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                                                title="Excluir"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {line.status === 'MATCHED' && (
                                                        <Check size={14} className="mx-auto text-green-600" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {(selectedStatement.lines || []).length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-gray-500">
                                                    <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-300" />
                                                    <p>No hay líneas. Importa un extracto CSV.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
                            <p>Selecciona un extracto bancario para conciliar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Statement Dialog */}
            <Dialog open={showNewStatementDialog} onOpenChange={setShowNewStatementDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo Extracto Bancario</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo extracto para conciliar
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                                <input
                                    type="date"
                                    value={newStatement.periodStart}
                                    onChange={(e) => setNewStatement({ ...newStatement, periodStart: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                                <input
                                    type="date"
                                    value={newStatement.periodEnd}
                                    onChange={(e) => setNewStatement({ ...newStatement, periodEnd: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                                <input
                                    type="number"
                                    value={newStatement.openingBalance}
                                    onChange={(e) => setNewStatement({ ...newStatement, openingBalance: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Final</label>
                                <input
                                    type="number"
                                    value={newStatement.closingBalance}
                                    onChange={(e) => setNewStatement({ ...newStatement, closingBalance: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={() => setShowNewStatementDialog(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={handleCreateStatement} disabled={processing} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                            {processing ? <Loader2 className="animate-spin" size={16} /> : 'Crear'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import CSV Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar Extracto CSV/Excel</DialogTitle>
                        <DialogDescription>
                            Sube un archivo CSV o pega los datos directamente. Formato: fecha,descripcion,referencia,monto,saldo
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cargar archivo CSV
                            </label>
                            <input
                                type="file"
                                accept=".csv,.txt"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                            const text = ev.target?.result as string;
                                            setCsvData(text);
                                        };
                                        reader.readAsText(file);
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                        
                        <div className="text-center text-sm text-gray-500">— o pega los datos —</div>
                        
                        <textarea
                            value={csvData}
                            onChange={(e) => setCsvData(e.target.value)}
                            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                            placeholder="fecha,descripcion,referencia,monto,saldo
2024-01-15,Transferencia recibida,REF123,500000,1500000
2024-01-16,Pago servicio,FAC456,-150000,1350000"
                        />
                        
                        {csvData && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                {csvData.trim().split('\n').length - 1} líneas detectadas (excluyendo encabezado)
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <button onClick={() => { setShowImportDialog(false); setCsvData(''); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={handleImportCSV} disabled={processing || !csvData.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                            {processing ? <Loader2 className="animate-spin" size={16} /> : 'Importar'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Match Dialog */}
            <Dialog open={!!showManualMatchDialog} onOpenChange={() => setShowManualMatchDialog(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Conciliar Manualmente</DialogTitle>
                        <DialogDescription>
                            Línea: {showManualMatchDialog?.description} - {formatCurrency(showManualMatchDialog?.amount || 0)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-64 overflow-y-auto">
                        <p className="text-sm font-medium text-gray-700 mb-2">Selecciona el movimiento correspondiente:</p>
                        <div className="space-y-2">
                            {movements.filter(m => !m.reconciled_at).map((mov) => (
                                <button
                                    key={mov.id}
                                    onClick={() => handleManualMatch(showManualMatchDialog.id, mov.id)}
                                    className="w-full p-3 bg-gray-50 rounded-lg hover:bg-blue-50 text-left flex justify-between items-center"
                                >
                                    <div>
                                        <p className="text-sm font-medium">{mov.description}</p>
                                        <p className="text-xs text-gray-500">{new Date(mov.date).toLocaleDateString('es-CO')}</p>
                                    </div>
                                    <span className={`font-medium ${mov.type === 'DEPOSITO' ? 'text-green-600' : 'text-red-600'}`}>
                                        {mov.type === 'DEPOSITO' ? '+' : '-'}{formatCurrency(mov.amount)}
                                    </span>
                                </button>
                            ))}
                            {movements.filter(m => !m.reconciled_at).length === 0 && (
                                <p className="text-gray-500 text-center py-4">No hay movimientos disponibles</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={() => setShowManualMatchDialog(null)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancelar</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
