'use client';

import React, { useState } from 'react';
import { X, DollarSign, CreditCard, Building2, Wallet, CheckCircle2, ShieldCheck } from 'lucide-react';
import { quickRegisterPayment } from '@/actions/salesFlow';

interface QuickPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    invoice: {
        id: string;
        code: string;
        clientName: string;
        total: number;
        balance: number;
    } | null;
    bankAccounts: Array<{
        id: string;
        bankName: string;
        accountNumber: string;
        accountType: string;
        balance: number;
    }>;
}

export function QuickPaymentModal({
    isOpen,
    onClose,
    onSuccess,
    invoice,
    bankAccounts,
}: QuickPaymentModalProps) {
    if (!isOpen || !invoice) return null;

    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState<number>(invoice.balance || invoice.total);
    const [paymentMethod, setPaymentMethod] = useState<string>('BANCOLOMBIA');
    const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id || '');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState<string>('');
    const [applyReteFuente, setApplyReteFuente] = useState(false);
    const [applyReteIca, setApplyReteIca] = useState(false);

    // Calcular retenciones sugeridas si el usuario las activa
    const calculatedReteFuente = applyReteFuente ? Math.round((amount / 1.19) * 0.025) : 0;
    const calculatedReteIca = applyReteIca ? Math.round((amount / 1.19) * 0.00966) : 0;
    const netReceived = amount - (calculatedReteFuente + calculatedReteIca);

    const formatCOP = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(val);
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            alert('Por favor ingrese un monto válido.');
            return;
        }

        setLoading(true);
        try {
            await quickRegisterPayment({
                invoiceId: invoice.id,
                amount,
                paymentDate,
                paymentMethod,
                bankAccountId: bankAccountId || undefined,
                reference: reference || `Cobro ${invoice.code}`,
                retentionSource: calculatedReteFuente,
                retentionIca: calculatedReteIca,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.message || 'Error al registrar el cobro');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Registrar Cobro en 1 Clic</h3>
                            <p className="text-xs text-emerald-100">
                                Factura <span className="font-semibold">{invoice.code}</span> — {invoice.clientName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleConfirm} className="p-6 space-y-5">
                    {/* Resumen de Saldo */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Saldo Pendiente
                            </span>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatCOP(invoice.balance)}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Total Factura
                            </span>
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                {formatCOP(invoice.total)}
                            </div>
                        </div>
                    </div>

                    {/* Monto a Cobrar */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Monto Recibido ($ COP)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input
                                type="number"
                                min="1"
                                max={invoice.balance}
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                required
                            />
                        </div>
                        {amount < invoice.balance && (
                            <p className="text-xs text-amber-600 mt-1">
                                ℹ️ Quedará un saldo pendiente de {formatCOP(invoice.balance - amount)}.
                            </p>
                        )}
                    </div>

                    {/* Método de Pago */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            ¿Cómo pagó el cliente?
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'BANCO', label: 'Bancos / Transferencia', icon: Building2 },
                                { id: 'EFECTIVO', label: 'Efectivo / Caja', icon: Wallet },
                                { id: 'NEQUI', label: 'Nequi / Daviplata', icon: CreditCard },
                            ].map((m) => {
                                const Icon = m.icon;
                                const isSelected = paymentMethod === m.id;
                                return (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => setPaymentMethod(m.id)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                                            isSelected
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 mb-1 text-emerald-600" />
                                        <span className="text-xs font-medium">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cuenta Bancaria de Destino */}
                    {paymentMethod !== 'EFECTIVO' && bankAccounts.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Cuenta de Destino
                            </label>
                            <select
                                value={bankAccountId}
                                onChange={(e) => setBankAccountId(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {bankAccounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bankName} - {acc.accountType} ({acc.accountNumber})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Opciones Fiscales / Retenciones Asistidas */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                ¿El cliente aplicó Retención en la Fuente?
                            </label>
                            <input
                                type="checkbox"
                                checked={applyReteFuente}
                                onChange={(e) => setApplyReteFuente(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                        </div>
                        {applyReteFuente && (
                            <div className="text-xs text-slate-500 pl-6 flex justify-between">
                                <span>ReteFuente sugerida (2.5%):</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {formatCOP(calculatedReteFuente)}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                ¿El cliente aplicó ReteICA?
                            </label>
                            <input
                                type="checkbox"
                                checked={applyReteIca}
                                onChange={(e) => setApplyReteIca(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                        </div>
                        {applyReteIca && (
                            <div className="text-xs text-slate-500 pl-6 flex justify-between">
                                <span>ReteICA sugerido (0.966%):</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {formatCOP(calculatedReteIca)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Fecha y Referencia */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Fecha de Pago
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                No. Transacción / Ref
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. TR-89421"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                            />
                        </div>
                    </div>

                    {/* Resumen Neto y Contabilidad Transparente */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                        <div className="text-xs text-emerald-900 dark:text-emerald-300">
                            <strong>Monto que entra a Banco/Caja:</strong>
                        </div>
                        <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                            {formatCOP(netReceived)}
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="pt-2 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <span>Procesando...</span>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar Cobro y Asentar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
