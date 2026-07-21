'use client';

import { useState, useEffect } from 'react';
import { InvoiceTemplate, getActiveInvoiceTemplate } from '@/actions/invoice-templates';
import { X, FileText } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface InvoicePreviewProps {
    open: boolean;
    onClose: () => void;
    invoice: {
        type: 'VENTA' | 'COMPRA';
        number?: string;
        date?: string;
        dueDate?: string;
        third_party?: {
            name: string;
            document_number: string;
            address?: string;
            phone?: string;
            email?: string;
        };
        lines?: Array<{
            description: string;
            quantity: number;
            unit_price: number;
            iva_rate: number;
            total: number;
        }>;
        subtotal?: number;
        iva_total?: number;
        retention_source?: number;
        retention_iva?: number;
        retention_ica?: number;
        total?: number;
        notes?: string;
    };
}

export function InvoicePreview({ open, onClose, invoice }: InvoicePreviewProps) {
    const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (open) {
            loadTemplate();
        }
    }, [open]);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const t = await getActiveInvoiceTemplate();
            setTemplate(t);
        } catch (error) {
            console.error('Error loading template:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            minimumFractionDigits: 0 
        }).format(value || 0);
    };

    const formatDate = (date?: string) => {
        if (!date) return new Date().toLocaleDateString('es-CO');
        return new Date(date).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (!template) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="p-4 border-b sticky top-0 bg-white z-10">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText size={20} />
                        Vista Previa de Factura
                    </DialogTitle>
                </DialogHeader>
                
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Cargando plantilla...</p>
                    </div>
                ) : (
                    <div className="p-8 bg-gray-100">
                        {/* Preview Container - Paper look */}
                        <div 
                            className="bg-white shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-8"
                            style={{ fontFamily: 'Arial, sans-serif' }}
                        >
                            {/* Header */}
                            <div 
                                className="flex justify-between items-start pb-4 mb-4 border-b-2"
                                style={{ borderColor: template.primary_color }}
                            >
                                <div>
                                    {template.show_logo && template.logo_url ? (
                                        <img 
                                            src={template.logo_url} 
                                            alt="Logo" 
                                            className="h-16 object-contain mb-2"
                                        />
                                    ) : (
                                        <div 
                                            className="text-2xl font-bold"
                                            style={{ color: template.primary_color }}
                                        >
                                            {template.company_name}
                                        </div>
                                    )}
                                    <div className="text-sm text-gray-600 space-y-0.5">
                                        <p>NIT: {template.company_nit}</p>
                                        <p>{template.company_address}</p>
                                        <p>{template.company_phone}</p>
                                        <p>{template.company_email}</p>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    <div 
                                        className="text-xl font-bold"
                                        style={{ color: template.primary_color }}
                                    >
                                        {invoice.type === 'VENTA' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA'}
                                    </div>
                                    <div className="text-lg font-medium text-gray-700 mt-1">
                                        N° {invoice.number || 'FV-00001'}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                                        <p>Fecha: {formatDate(invoice.date)}</p>
                                        <p>Vencimiento: {formatDate(invoice.dueDate)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Client Info */}
                            <div 
                                className="rounded-lg p-4 mb-6"
                                style={{ backgroundColor: `${template.secondary_color}10` }}
                            >
                                <div 
                                    className="text-sm font-semibold mb-2"
                                    style={{ color: template.secondary_color }}
                                >
                                    {invoice.type === 'VENTA' ? 'CLIENTE' : 'PROVEEDOR'}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {invoice.third_party?.name || 'Nombre del Cliente'}
                                        </p>
                                        <p className="text-gray-600">
                                            NIT/CC: {invoice.third_party?.document_number || '000.000.000-0'}
                                        </p>
                                    </div>
                                    <div className="text-gray-600">
                                        <p>{invoice.third_party?.address || 'Dirección'}</p>
                                        <p>{invoice.third_party?.phone || 'Teléfono'}</p>
                                        <p>{invoice.third_party?.email || 'email@ejemplo.com'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full mb-6">
                                <thead>
                                    <tr style={{ backgroundColor: template.primary_color }}>
                                        <th className="text-left py-2 px-3 text-white text-sm">Descripción</th>
                                        <th className="text-center py-2 px-3 text-white text-sm w-20">Cant.</th>
                                        <th className="text-right py-2 px-3 text-white text-sm w-28">Precio Unit.</th>
                                        <th className="text-center py-2 px-3 text-white text-sm w-20">IVA</th>
                                        <th className="text-right py-2 px-3 text-white text-sm w-32">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(invoice.lines && invoice.lines.length > 0) ? (
                                        invoice.lines.map((line, idx) => (
                                            <tr key={idx} className="border-b border-gray-200">
                                                <td className="py-2 px-3 text-sm">{line.description}</td>
                                                <td className="py-2 px-3 text-sm text-center">{line.quantity}</td>
                                                <td className="py-2 px-3 text-sm text-right">{formatCurrency(line.unit_price)}</td>
                                                <td className="py-2 px-3 text-sm text-center">{line.iva_rate}%</td>
                                                <td className="py-2 px-3 text-sm text-right font-medium">{formatCurrency(line.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <>
                                            <tr className="border-b border-gray-200">
                                                <td className="py-2 px-3 text-sm">Producto o Servicio de ejemplo</td>
                                                <td className="py-2 px-3 text-sm text-center">1</td>
                                                <td className="py-2 px-3 text-sm text-right">{formatCurrency(1000000)}</td>
                                                <td className="py-2 px-3 text-sm text-center">19%</td>
                                                <td className="py-2 px-3 text-sm text-right font-medium">{formatCurrency(1190000)}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="py-2 px-3 text-sm">Segundo producto de ejemplo</td>
                                                <td className="py-2 px-3 text-sm text-center">2</td>
                                                <td className="py-2 px-3 text-sm text-right">{formatCurrency(500000)}</td>
                                                <td className="py-2 px-3 text-sm text-center">19%</td>
                                                <td className="py-2 px-3 text-sm text-right font-medium">{formatCurrency(1190000)}</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="flex justify-end mb-6">
                                <div className="w-72">
                                    <div className="flex justify-between py-1 text-sm">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span>{formatCurrency(invoice.subtotal || 2000000)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 text-sm">
                                        <span className="text-gray-600">IVA 19%:</span>
                                        <span>{formatCurrency(invoice.iva_total || 380000)}</span>
                                    </div>
                                    {(invoice.retention_source && invoice.retention_source > 0) && (
                                        <div className="flex justify-between py-1 text-sm">
                                            <span className="text-gray-600">Ret. Fuente:</span>
                                            <span className="text-red-600">-{formatCurrency(invoice.retention_source)}</span>
                                        </div>
                                    )}
                                    {(invoice.retention_iva && invoice.retention_iva > 0) && (
                                        <div className="flex justify-between py-1 text-sm">
                                            <span className="text-gray-600">Ret. IVA:</span>
                                            <span className="text-red-600">-{formatCurrency(invoice.retention_iva)}</span>
                                        </div>
                                    )}
                                    {(invoice.retention_ica && invoice.retention_ica > 0) && (
                                        <div className="flex justify-between py-1 text-sm">
                                            <span className="text-gray-600">Ret. ICA:</span>
                                            <span className="text-red-600">-{formatCurrency(invoice.retention_ica)}</span>
                                        </div>
                                    )}
                                    <div 
                                        className="flex justify-between py-2 mt-2 border-t-2 text-lg font-bold"
                                        style={{ borderColor: template.primary_color, color: template.primary_color }}
                                    >
                                        <span>TOTAL:</span>
                                        <span>{formatCurrency(invoice.total || 2380000)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {invoice.notes && (
                                <div className="mb-6 p-3 bg-gray-50 rounded text-sm">
                                    <span className="font-medium">Observaciones: </span>
                                    {invoice.notes}
                                </div>
                            )}

                            {/* Payment Terms & Bank Info */}
                            <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                                {template.payment_terms && (
                                    <div>
                                        <span className="font-medium text-gray-700">Condiciones de Pago:</span>
                                        <p className="text-gray-600">{template.payment_terms}</p>
                                    </div>
                                )}
                                {template.bank_info && (
                                    <div>
                                        <span className="font-medium text-gray-700">Información Bancaria:</span>
                                        <p className="text-gray-600">{template.bank_info}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div 
                                className="pt-4 mt-8 border-t text-center text-sm"
                                style={{ borderColor: template.primary_color }}
                            >
                                {template.footer_text && (
                                    <p style={{ color: template.accent_color }} className="font-medium">
                                        {template.footer_text}
                                    </p>
                                )}
                                {template.company_website && (
                                    <p className="text-gray-500 mt-1">{template.company_website}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
