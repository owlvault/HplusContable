'use client';

import { AlertTriangle } from 'lucide-react';

interface ClientReport {
    third_party_id: string;
    third_party_name: string;
    document_number: string;
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
    documents_count: number;
    overdue_amount: number;
    oldest_due_date: string | null;
}

interface CarteraReportProps {
    title: string;
    data: ClientReport[];
    type: 'receivable' | 'payable';
}

export function CarteraReport({ title, data, type }: CarteraReportProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const totals = data.reduce(
        (acc, item) => ({
            invoiced: acc.invoiced + item.total_invoiced,
            paid: acc.paid + item.total_paid,
            pending: acc.pending + item.total_pending,
            overdue: acc.overdue + item.overdue_amount,
        }),
        { invoiced: 0, paid: 0, pending: 0, overdue: 0 }
    );

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid={`cartera-report-${type}`}>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-500">{data.length} terceros con saldo pendiente</p>
            </div>

            {data.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No hay datos para mostrar</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {type === 'receivable' ? 'Cliente' : 'Proveedor'}
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Documento
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Docs
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Total Facturado
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Pagado
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Saldo Pendiente
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Vencido
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Más Antiguo
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {data.map((item) => (
                                <tr key={item.third_party_id} className={item.overdue_amount > 0 ? 'bg-red-50' : ''}>
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        <div className="flex items-center gap-2">
                                            {item.overdue_amount > 0 && (
                                                <AlertTriangle size={14} className="text-red-500" />
                                            )}
                                            {item.third_party_name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{item.document_number}</td>
                                    <td className="px-4 py-3 text-gray-600 text-center">{item.documents_count}</td>
                                    <td className="px-4 py-3 text-gray-600 text-right">{formatCurrency(item.total_invoiced)}</td>
                                    <td className="px-4 py-3 text-green-600 text-right">{formatCurrency(item.total_paid)}</td>
                                    <td className="px-4 py-3 text-gray-900 text-right font-medium">
                                        {formatCurrency(item.total_pending)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium ${item.overdue_amount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {formatCurrency(item.overdue_amount)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-center">{formatDate(item.oldest_due_date)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td className="px-4 py-3 text-gray-900" colSpan={3}>TOTALES</td>
                                <td className="px-4 py-3 text-gray-900 text-right">{formatCurrency(totals.invoiced)}</td>
                                <td className="px-4 py-3 text-green-600 text-right">{formatCurrency(totals.paid)}</td>
                                <td className="px-4 py-3 text-gray-900 text-right">{formatCurrency(totals.pending)}</td>
                                <td className="px-4 py-3 text-red-600 text-right">{formatCurrency(totals.overdue)}</td>
                                <td className="px-4 py-3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
