'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BankMovement, BankAccount } from '@/actions/tesoreria';
import { createBankMovement, reconcileMovement, transferBetweenAccounts } from '@/actions/tesoreria';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Check, Plus, ArrowLeftRight } from 'lucide-react';

interface MovementsTableProps {
    movements: BankMovement[];
    accounts: BankAccount[];
}

export function MovementsTable({ movements, accounts }: MovementsTableProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        bank_account_id: '',
        date: new Date().toISOString().split('T')[0],
        type: 'DEPOSITO' as 'DEPOSITO' | 'RETIRO' | 'COMISION' | 'INTERES',
        amount: 0,
        reference: '',
        description: '',
    });
    const [transferData, setTransferData] = useState({
        from_account_id: '',
        to_account_id: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        reference: '',
    });

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getMovementIcon = (type: string, amount: number) => {
        if (type === 'TRANSFERENCIA') {
            return <ArrowLeftRight size={16} className="text-purple-500" />;
        }
        if (amount > 0) {
            return <ArrowUpCircle size={16} className="text-green-500" />;
        }
        return <ArrowDownCircle size={16} className="text-red-500" />;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bank_account_id || formData.amount <= 0) {
            alert('Complete todos los campos requeridos');
            return;
        }

        setLoading('form');
        try {
            await createBankMovement(formData);
            setShowForm(false);
            setFormData({
                bank_account_id: '',
                date: new Date().toISOString().split('T')[0],
                type: 'DEPOSITO',
                amount: 0,
                reference: '',
                description: '',
            });
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferData.from_account_id || !transferData.to_account_id || transferData.amount <= 0) {
            alert('Complete todos los campos requeridos');
            return;
        }
        if (transferData.from_account_id === transferData.to_account_id) {
            alert('Las cuentas deben ser diferentes');
            return;
        }

        setLoading('transfer');
        try {
            await transferBetweenAccounts(
                transferData.from_account_id,
                transferData.to_account_id,
                transferData.amount,
                transferData.date,
                transferData.reference
            );
            setShowTransfer(false);
            setTransferData({
                from_account_id: '',
                to_account_id: '',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                reference: '',
            });
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleReconcile = async (id: string) => {
        setLoading(id);
        try {
            await reconcileMovement(id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="movements-table">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Movimientos Bancarios</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowTransfer(!showTransfer); setShowForm(false); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                        <ArrowLeftRight size={16} />
                        Transferencia
                    </button>
                    <button
                        onClick={() => { setShowForm(!showForm); setShowTransfer(false); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        data-testid="add-movement-btn"
                    >
                        <Plus size={16} />
                        Nuevo Movimiento
                    </button>
                </div>
            </div>

            {/* New Movement Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta *</label>
                            <select
                                value={formData.bank_account_id}
                                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bank_name} - {acc.account_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="DEPOSITO">Depósito</option>
                                <option value="RETIRO">Retiro</option>
                                <option value="COMISION">Comisión</option>
                                <option value="INTERES">Interés</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                min="0"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Nro. transacción"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading === 'form'} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                            {loading === 'form' ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            )}

            {/* Transfer Form */}
            {showTransfer && (
                <form onSubmit={handleTransfer} className="p-4 bg-purple-50 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
                            <select
                                value={transferData.from_account_id}
                                onChange={(e) => setTransferData({ ...transferData, from_account_id: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bank_name} ({formatCurrency(acc.current_balance)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hacia *</label>
                            <select
                                value={transferData.to_account_id}
                                onChange={(e) => setTransferData({ ...transferData, to_account_id: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bank_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                            <input
                                type="number"
                                value={transferData.amount}
                                onChange={(e) => setTransferData({ ...transferData, amount: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                min="0"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                            <input
                                type="date"
                                value={transferData.date}
                                onChange={(e) => setTransferData({ ...transferData, date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                            <input
                                type="text"
                                value={transferData.reference}
                                onChange={(e) => setTransferData({ ...transferData, reference: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setShowTransfer(false)} className="px-3 py-1.5 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading === 'transfer'} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50">
                            {loading === 'transfer' ? 'Transfiriendo...' : 'Transferir'}
                        </button>
                    </div>
                </form>
            )}

            {/* Movements Table */}
            {movements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <RefreshCw size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No hay movimientos registrados</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuenta</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {movements.map((mov) => (
                                <tr key={mov.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(mov.date)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{mov.bank_account?.bank_name}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            {getMovementIcon(mov.type, mov.amount)}
                                            <span className="text-gray-600">{mov.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {mov.description || mov.reference || '-'}
                                    </td>
                                    <td className={`px-4 py-3 text-sm text-right font-medium ${mov.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {mov.amount > 0 ? '+' : ''}{formatCurrency(mov.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                                        {formatCurrency(mov.balance_after)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {mov.is_reconciled ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                                <Check size={12} />
                                                Conciliado
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleReconcile(mov.id)}
                                                disabled={loading === mov.id}
                                                className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full hover:bg-orange-200"
                                            >
                                                {loading === mov.id ? '...' : 'Conciliar'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
