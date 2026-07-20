'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Invoice, INVOICE_STATE_LABELS, INVOICE_STATE_COLORS, InvoiceState } from '@/types/invoices';
import { approveInvoice, cancelInvoice, deleteInvoice, markInvoiceAsPaid } from '@/actions/invoices';
import { FileText, Eye, Trash2, CheckCircle, XCircle, DollarSign, Plus } from 'lucide-react';

interface InvoicesTableProps {
    invoices: any[];
    type: 'VENTA' | 'COMPRA';
}

export function InvoicesTable({ invoices, type }: InvoicesTableProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);

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

    const handleApprove = async (id: string) => {
        if (!confirm('¿Aprobar esta factura?')) return;
        setLoading(id);
        try {
            await approveInvoice(id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleCancel = async (id: string) => {
        const reason = prompt('Motivo de anulación:');
        if (!reason) return;
        setLoading(id);
        try {
            await cancelInvoice(id, reason);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
        setLoading(id);
        try {
            await deleteInvoice(id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleMarkPaid = async (id: string) => {
        if (!confirm('¿Marcar como pagada?')) return;
        setLoading(id);
        try {
            await markInvoiceAsPaid(id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                    {type === 'VENTA' ? 'Facturas de Venta' : 'Facturas de Compra'}
                </h2>
                <button
                    onClick={() => router.push(`/facturas/nueva?type=${type}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    data-testid={`new-invoice-btn-${type}`}
                >
                    <Plus size={18} />
                    Nueva Factura
                </button>
            </div>

            {invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No hay facturas registradas</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full" data-testid="invoices-table">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Número
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Fecha
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {type === 'VENTA' ? 'Cliente' : 'Proveedor'}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Total
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
                            {invoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-gray-50" data-testid={`invoice-row-${invoice.id}`}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {invoice.prefix}-{String(invoice.number).padStart(5, '0')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {formatDate(invoice.date)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {invoice.third_party?.full_name || 'Sin asignar'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                        {formatCurrency(invoice.total)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${INVOICE_STATE_COLORS[invoice.state as InvoiceState]}`}>
                                            {INVOICE_STATE_LABELS[invoice.state as InvoiceState]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => router.push(`/facturas/${invoice.id}`)}
                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Ver detalle"
                                                data-testid={`view-invoice-${invoice.id}`}
                                            >
                                                <Eye size={16} />
                                            </button>

                                            {invoice.state === 'DRAFT' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(invoice.id)}
                                                        disabled={loading === invoice.id}
                                                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                                        title="Aprobar"
                                                        data-testid={`approve-invoice-${invoice.id}`}
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(invoice.id)}
                                                        disabled={loading === invoice.id}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Eliminar"
                                                        data-testid={`delete-invoice-${invoice.id}`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}

                                            {(invoice.state === 'APPROVED' || invoice.state === 'SENT') && (
                                                <>
                                                    <button
                                                        onClick={() => handleMarkPaid(invoice.id)}
                                                        disabled={loading === invoice.id}
                                                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                                        title="Marcar como pagada"
                                                        data-testid={`pay-invoice-${invoice.id}`}
                                                    >
                                                        <DollarSign size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancel(invoice.id)}
                                                        disabled={loading === invoice.id}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Anular"
                                                        data-testid={`cancel-invoice-${invoice.id}`}
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
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
