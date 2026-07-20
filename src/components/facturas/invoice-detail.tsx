'use client';

import { useRouter } from 'next/navigation';
import { InvoiceWithDetails, INVOICE_STATE_LABELS, INVOICE_STATE_COLORS, InvoiceState } from '@/types/invoices';
import { approveInvoice, cancelInvoice, markInvoiceAsPaid } from '@/actions/invoices';
import { useState } from 'react';
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Printer, Edit } from 'lucide-react';

interface InvoiceDetailProps {
    invoice: InvoiceWithDetails;
}

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

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
            month: 'long',
            day: 'numeric',
        });
    };

    const handleApprove = async () => {
        if (!confirm('¿Aprobar esta factura?')) return;
        setLoading(true);
        try {
            await approveInvoice(invoice.id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        const reason = prompt('Motivo de anulación:');
        if (!reason) return;
        setLoading(true);
        try {
            await cancelInvoice(invoice.id, reason);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!confirm('¿Marcar como pagada?')) return;
        setLoading(true);
        try {
            await markInvoiceAsPaid(invoice.id);
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6" data-testid="invoice-detail">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push('/facturas')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={20} />
                    Volver a Facturas
                </button>
                <div className="flex items-center gap-2">
                    {invoice.state === 'DRAFT' && (
                        <>
                            <button
                                onClick={() => router.push(`/facturas/${invoice.id}/editar`)}
                                className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                data-testid="edit-btn"
                            >
                                <Edit size={18} />
                                Editar
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={loading}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                data-testid="approve-btn"
                            >
                                <CheckCircle size={18} />
                                Aprobar
                            </button>
                        </>
                    )}
                    {(invoice.state === 'APPROVED' || invoice.state === 'SENT') && (
                        <>
                            <button
                                onClick={handleMarkPaid}
                                disabled={loading}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                data-testid="mark-paid-btn"
                            >
                                <DollarSign size={18} />
                                Marcar Pagada
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                data-testid="cancel-btn"
                            >
                                <XCircle size={18} />
                                Anular
                            </button>
                        </>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        data-testid="print-btn"
                    >
                        <Printer size={18} />
                        Imprimir
                    </button>
                </div>
            </div>

            {/* Invoice Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:border-none print:shadow-none">
                {/* Invoice Header */}
                <div className="p-6 border-b border-gray-200 bg-gray-50 print:bg-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                FACTURA {invoice.type === 'VENTA' ? 'DE VENTA' : 'DE COMPRA'}
                            </h1>
                            <p className="text-3xl font-mono font-bold text-blue-600 mt-1" data-testid="invoice-number">
                                {invoice.prefix}-{String(invoice.number).padStart(5, '0')}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${INVOICE_STATE_COLORS[invoice.state as InvoiceState]} print:border print:border-gray-300`}>
                                {INVOICE_STATE_LABELS[invoice.state as InvoiceState]}
                            </span>
                            <p className="text-sm text-gray-500 mt-2">
                                Fecha: {formatDate(invoice.date)}
                            </p>
                            {invoice.due_date && (
                                <p className="text-sm text-gray-500">
                                    Vencimiento: {formatDate(invoice.due_date)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Third Party Info */}
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">
                        {invoice.type === 'VENTA' ? 'Cliente' : 'Proveedor'}
                    </h2>
                    {invoice.third_party ? (
                        <div data-testid="third-party-info">
                            <p className="text-lg font-semibold text-gray-900">{invoice.third_party.full_name}</p>
                            <p className="text-sm text-gray-600">
                                {invoice.third_party.document_type}: {invoice.third_party.document_number}
                                {invoice.third_party.dv && `-${invoice.third_party.dv}`}
                            </p>
                            {invoice.third_party.address && (
                                <p className="text-sm text-gray-600">{invoice.third_party.address}</p>
                            )}
                            {invoice.third_party.city && (
                                <p className="text-sm text-gray-600">{invoice.third_party.city}</p>
                            )}
                            {invoice.third_party.email && (
                                <p className="text-sm text-gray-600">{invoice.third_party.email}</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500">Sin asignar</p>
                    )}
                </div>

                {/* Lines Table */}
                <div className="p-6 border-b border-gray-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                <th className="pb-2 text-center text-xs font-medium text-gray-500 uppercase">Cant.</th>
                                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">Descuento</th>
                                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {invoice.lines.map((line, index) => (
                                <tr key={line.id || index}>
                                    <td className="py-3 text-gray-500">{line.line_number}</td>
                                    <td className="py-3 text-gray-900">{line.description}</td>
                                    <td className="py-3 text-center text-gray-600">
                                        {line.quantity} {line.unit}
                                    </td>
                                    <td className="py-3 text-right text-gray-600">{formatCurrency(line.unit_price)}</td>
                                    <td className="py-3 text-right text-gray-600">
                                        {line.discount_rate > 0 ? `${line.discount_rate}%` : '-'}
                                    </td>
                                    <td className="py-3 text-right text-gray-600">{line.tax_rate}%</td>
                                    <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(line.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="p-6 bg-gray-50 print:bg-white">
                    <div className="flex justify-end">
                        <div className="w-64 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>Descuento</span>
                                    <span>-{formatCurrency(invoice.discount)}</span>
                                </div>
                            )}
                            {invoice.iva_5 > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">IVA 5%</span>
                                    <span>{formatCurrency(invoice.iva_5)}</span>
                                </div>
                            )}
                            {invoice.iva_19 > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">IVA 19%</span>
                                    <span>{formatCurrency(invoice.iva_19)}</span>
                                </div>
                            )}
                            {invoice.retention_source > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>(-) Rete Fuente</span>
                                    <span>-{formatCurrency(invoice.retention_source)}</span>
                                </div>
                            )}
                            {invoice.retention_iva > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>(-) Rete IVA</span>
                                    <span>-{formatCurrency(invoice.retention_iva)}</span>
                                </div>
                            )}
                            {invoice.retention_ica > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>(-) Rete ICA</span>
                                    <span>-{formatCurrency(invoice.retention_ica)}</span>
                                </div>
                            )}
                            <hr className="my-2" />
                            <div className="flex justify-between text-lg font-bold">
                                <span>TOTAL</span>
                                <span data-testid="invoice-total">{formatCurrency(invoice.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {invoice.notes && (
                    <div className="p-6 border-t border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Observaciones</h3>
                        <p className="text-gray-700">{invoice.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
