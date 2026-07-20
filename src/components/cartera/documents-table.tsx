'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerReceivablePayment, registerPayablePayment } from '@/actions/cartera';
import { Eye, DollarSign, AlertTriangle } from 'lucide-react';

interface DocumentsTableProps {
    documents: any[];
    type: 'receivable' | 'payable';
    title: string;
}

export function DocumentsTable({ documents, type, title }: DocumentsTableProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState({
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'TRANSFERENCIA',
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

    const getStatusBadge = (status: string, daysOverdue: number) => {
        if (status === 'PAID') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Pagado</span>;
        }
        if (status === 'PARTIAL') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Parcial</span>;
        }
        if (daysOverdue > 0) {
            return (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Vencido ({daysOverdue}d)
                </span>
            );
        }
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Pendiente</span>;
    };

    const handlePayment = async (documentId: string) => {
        if (paymentData.amount <= 0) {
            alert('Ingrese un monto válido');
            return;
        }

        setLoading(documentId);
        try {
            if (type === 'receivable') {
                await registerReceivablePayment(
                    documentId,
                    paymentData.amount,
                    paymentData.date,
                    paymentData.method,
                    paymentData.reference
                );
            } else {
                await registerPayablePayment(
                    documentId,
                    paymentData.amount,
                    paymentData.date,
                    paymentData.method,
                    paymentData.reference
                );
            }
            setShowPaymentModal(null);
            setPaymentData({
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                method: 'TRANSFERENCIA',
                reference: '',
            });
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const pendingDocs = documents.filter(d => d.status !== 'PAID' && d.status !== 'WRITTEN_OFF');

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid={`documents-table-${type}`}>
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{pendingDocs.length} documentos pendientes</p>
            </div>

            {pendingDocs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No hay documentos pendientes</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Documento
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {type === 'receivable' ? 'Cliente' : 'Proveedor'}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Vencimiento
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Valor Original
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Saldo
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Estado
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {pendingDocs.map((doc) => (
                                <tr key={doc.id} className={doc.days_overdue > 0 ? 'bg-red-50' : ''}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {doc.document_number}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {doc.third_party?.full_name || 'Sin asignar'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                        {formatDate(doc.due_date)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                        {formatCurrency(doc.original_amount)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                        {formatCurrency(doc.balance)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {getStatusBadge(doc.status, doc.days_overdue)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {doc.invoice_id && (
                                                <button
                                                    onClick={() => router.push(`/facturas/${doc.invoice_id}`)}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Ver factura"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setPaymentData(prev => ({ ...prev, amount: doc.balance }));
                                                    setShowPaymentModal(doc.id);
                                                }}
                                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                                title="Registrar pago"
                                            >
                                                <DollarSign size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Registrar Pago</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                                <input
                                    type="number"
                                    value={paymentData.amount}
                                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={paymentData.date}
                                    onChange={(e) => setPaymentData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                                <select
                                    value={paymentData.method}
                                    onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="EFECTIVO">Efectivo</option>
                                    <option value="TRANSFERENCIA">Transferencia</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="TARJETA">Tarjeta</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                                <input
                                    type="text"
                                    value={paymentData.reference}
                                    onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    placeholder="Número de transacción"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowPaymentModal(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handlePayment(showPaymentModal)}
                                disabled={loading === showPaymentModal}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {loading === showPaymentModal ? 'Procesando...' : 'Registrar Pago'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
