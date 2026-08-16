'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BankAccount } from '@/actions/tesoreria';
import { createBankAccount, deactivateBankAccount } from '@/actions/tesoreria';
import { Building2, Plus, Trash2, CreditCard } from 'lucide-react';
import { getSpanishErrorMessage } from '@/lib/error-messages';

interface BankAccountsListProps {
    accounts: BankAccount[];
}

export function BankAccountsList({ accounts }: BankAccountsListProps) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        bank_name: '',
        account_number: '',
        account_type: 'AHORROS' as 'AHORROS' | 'CORRIENTE',
        currency: 'COP',
        initial_balance: 0,
        is_active: true,
    });

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bank_name || !formData.account_number) {
            alert('Complete todos los campos requeridos');
            return;
        }

        setLoading(true);
        try {
            await createBankAccount(formData);
            setShowForm(false);
            setFormData({
                bank_name: '',
                account_number: '',
                account_type: 'AHORROS',
                currency: 'COP',
                initial_balance: 0,
                is_active: true,
            });
            router.refresh();
        } catch (error) {
            alert(getSpanishErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('¿Desactivar esta cuenta bancaria?')) return;
        try {
            await deactivateBankAccount(id);
            router.refresh();
        } catch (error) {
            alert(getSpanishErrorMessage(error));
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="bank-accounts-list">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Cuentas Bancarias</h2>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    data-testid="add-account-btn"
                >
                    <Plus size={16} />
                    Nueva Cuenta
                </button>
            </div>

            {/* New Account Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                            <input
                                type="text"
                                value={formData.bank_name}
                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Ej: Bancolombia"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta *</label>
                            <input
                                type="text"
                                value={formData.account_number}
                                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Ej: 123-456789-00"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                                value={formData.account_type}
                                onChange={(e) => setFormData({ ...formData, account_type: e.target.value as 'AHORROS' | 'CORRIENTE' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="AHORROS">Ahorros</option>
                                <option value="CORRIENTE">Corriente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                            <input
                                type="number"
                                value={formData.initial_balance}
                                onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-3 py-1.5 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            )}

            {/* Accounts Grid */}
            {accounts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No hay cuentas bancarias registradas</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {accounts.map((account) => (
                        <div
                            key={account.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            data-testid={`bank-account-${account.id}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <CreditCard className="text-blue-600" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{account.bank_name}</h3>
                                        <p className="text-sm text-gray-500">{account.account_number}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeactivate(account.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Desactivar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="mt-4">
                                <p className="text-xs text-gray-500 uppercase">{account.account_type}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {formatCurrency(account.current_balance)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
