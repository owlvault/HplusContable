'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Invoice, INVOICE_STATE_LABELS, INVOICE_STATE_COLORS, InvoiceState } from '@/types/invoices';
import { approveInvoice, cancelInvoice, deleteInvoice, markInvoiceAsPaid, getInvoiceLines } from '@/actions/invoices';
import { FileText, Eye, Trash2, CheckCircle, XCircle, DollarSign, Plus, FileImage } from 'lucide-react';
import { InvoicePreview } from './invoice-preview';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface InvoicesTableProps {
    invoices: any[];
    type: 'VENTA' | 'COMPRA';
}

export function InvoicesTable({ invoices, type }: InvoicesTableProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [previewInvoice, setPreviewInvoice] = useState<any>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState<{ type: string; id: string; title: string; message: string } | null>(null);
    const [cancelReason, setCancelReason] = useState('');

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
        setShowConfirmDialog({
            type: 'approve',
            id,
            title: 'Aprobar Factura',
            message: '¿Está seguro de aprobar esta factura? Se generará el asiento contable automáticamente.'
        });
    };

    const handleCancel = async (id: string) => {
        setShowConfirmDialog({
            type: 'cancel',
            id,
            title: 'Anular Factura',
            message: 'Ingrese el motivo de anulación:'
        });
        setCancelReason('');
    };

    const handleDelete = async (id: string) => {
        setShowConfirmDialog({
            type: 'delete',
            id,
            title: 'Eliminar Factura',
            message: '¿Está seguro de eliminar esta factura? Esta acción no se puede deshacer.'
        });
    };

    const handleMarkPaid = async (id: string) => {
        setShowConfirmDialog({
            type: 'paid',
            id,
            title: 'Marcar como Pagada',
            message: '¿Confirma que esta factura ha sido pagada?'
        });
    };

    const executeAction = async () => {
        if (!showConfirmDialog) return;
        
        const { type: actionType, id } = showConfirmDialog;
        setLoading(id);
        
        try {
            switch (actionType) {
                case 'approve':
                    await approveInvoice(id);
                    toast({ title: 'Aprobada', description: 'Factura aprobada correctamente', variant: 'success' });
                    break;
                case 'cancel':
                    if (!cancelReason.trim()) {
                        toast({ title: 'Error', description: 'Debe ingresar un motivo de anulación', variant: 'destructive' });
                        setLoading(null);
                        return;
                    }
                    await cancelInvoice(id, cancelReason);
                    toast({ title: 'Anulada', description: 'Factura anulada correctamente', variant: 'success' });
                    break;
                case 'delete':
                    await deleteInvoice(id);
                    toast({ title: 'Eliminada', description: 'Factura eliminada correctamente', variant: 'success' });
                    break;
                case 'paid':
                    await markInvoiceAsPaid(id);
                    toast({ title: 'Pagada', description: 'Factura marcada como pagada', variant: 'success' });
                    break;
            }
            router.refresh();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(null);
            setShowConfirmDialog(null);
            setCancelReason('');
        }
    };

    const openPreview = async (invoice: any) => {
        // Cargar las líneas de la factura para el preview
        let lines: any[] = [];
        try {
            lines = await getInvoiceLines(invoice.id);
        } catch (error) {
            console.error('Error loading invoice lines:', error);
        }
        
        setPreviewInvoice({
            type: invoice.type,
            number: `${invoice.prefix}-${String(invoice.number).padStart(5, '0')}`,
            date: invoice.date,
            dueDate: invoice.due_date,
            third_party: invoice.third_party ? {
                name: invoice.third_party.full_name,
                document_number: invoice.third_party.document_number,
                address: invoice.third_party.address,
                phone: invoice.third_party.phone,
                email: invoice.third_party.email,
            } : undefined,
            lines: lines.map((line: any) => ({
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
                iva_rate: line.iva_rate,
                total: line.total,
            })),
            subtotal: invoice.subtotal,
            iva_total: (invoice.iva_5 || 0) + (invoice.iva_19 || 0),
            retention_source: invoice.retention_source,
            retention_iva: invoice.retention_iva,
            retention_ica: invoice.retention_ica,
            total: invoice.total,
            notes: invoice.notes,
        });
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
                                                onClick={() => openPreview(invoice)}
                                                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                                                title="Vista previa"
                                                data-testid={`preview-invoice-${invoice.id}`}
                                            >
                                                <FileImage size={16} />
                                            </button>
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

            {/* Preview Dialog */}
            {previewInvoice && (
                <InvoicePreview
                    open={!!previewInvoice}
                    onClose={() => setPreviewInvoice(null)}
                    invoice={previewInvoice}
                />
            )}

            {/* Confirmation Dialog */}
            <Dialog open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{showConfirmDialog?.title}</DialogTitle>
                        <DialogDescription>
                            {showConfirmDialog?.message}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {showConfirmDialog?.type === 'cancel' && (
                        <div className="py-4">
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Motivo de anulación..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                                rows={3}
                            />
                        </div>
                    )}
                    
                    <DialogFooter>
                        <button
                            onClick={() => setShowConfirmDialog(null)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={executeAction}
                            disabled={loading === showConfirmDialog?.id}
                            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                                showConfirmDialog?.type === 'delete' || showConfirmDialog?.type === 'cancel'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {loading === showConfirmDialog?.id ? 'Procesando...' : 'Confirmar'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
