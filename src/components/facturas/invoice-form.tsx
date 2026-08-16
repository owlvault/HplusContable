'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createInvoice } from '@/actions/invoices';
import { calculateInvoiceTotals } from '@/lib/utils/invoice-calc';
import { getThirdParties } from '@/actions/third-parties';
import { TAX_RATES, InvoiceLine } from '@/types/invoices';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { getSpanishErrorMessage } from '@/lib/error-messages';

interface ThirdParty {
    id: string;
    full_name: string;
    document_type: string;
    document_number: string;
    is_client: boolean;
    is_provider: boolean;
}

export function InvoiceForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const type = (searchParams.get('type') as 'VENTA' | 'COMPRA') || 'VENTA';

    const [loading, setLoading] = useState(false);
    const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
    const [formData, setFormData] = useState({
        prefix: type === 'VENTA' ? 'FV' : 'FC',
        type: type,
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        third_party_id: '',
        notes: '',
        retention_source: 0,
        retention_iva: 0,
        retention_ica: 0,
    });

    const [lines, setLines] = useState<Omit<InvoiceLine, 'id'>[]>([
        {
            line_number: 1,
            description: '',
            quantity: 1,
            unit: 'UN',
            unit_price: 0,
            discount_rate: 0,
            discount_amount: 0,
            tax_rate: 19,
            tax_amount: 0,
            subtotal: 0,
            total: 0,
        },
    ]);

    useEffect(() => {
        loadThirdParties();
    }, []);

    const loadThirdParties = async () => {
        try {
            const parties = await getThirdParties();
            // Filter by type
            const filtered = parties.filter((p: ThirdParty) =>
                type === 'VENTA' ? p.is_client : p.is_provider
            );
            setThirdParties(filtered);
        } catch (error) {
            console.error('Error loading third parties:', error);
        }
    };

    const calculateLineTotals = (line: Omit<InvoiceLine, 'id'>) => {
        const subtotal = line.quantity * line.unit_price;
        const discountAmount = subtotal * (line.discount_rate / 100);
        const taxableAmount = subtotal - discountAmount;
        const taxAmount = taxableAmount * (line.tax_rate / 100);
        const total = taxableAmount + taxAmount;

        return {
            ...line,
            discount_amount: Math.round(discountAmount * 100) / 100,
            tax_amount: Math.round(taxAmount * 100) / 100,
            subtotal: Math.round(subtotal * 100) / 100,
            total: Math.round(total * 100) / 100,
        };
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        newLines[index] = calculateLineTotals(newLines[index]);
        setLines(newLines);
    };

    const addLine = () => {
        setLines([
            ...lines,
            {
                line_number: lines.length + 1,
                description: '',
                quantity: 1,
                unit: 'UN',
                unit_price: 0,
                discount_rate: 0,
                discount_amount: 0,
                tax_rate: 19,
                tax_amount: 0,
                subtotal: 0,
                total: 0,
            },
        ]);
    };

    const removeLine = (index: number) => {
        if (lines.length === 1) return;
        const newLines = lines.filter((_, i) => i !== index);
        setLines(newLines.map((l, i) => ({ ...l, line_number: i + 1 })));
    };

    const totals = calculateInvoiceTotals(lines);
    const grandTotal = totals.total - formData.retention_source - formData.retention_iva - formData.retention_ica;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const handleSubmit = async (e: React.FormEvent, asDraft: boolean = true) => {
        e.preventDefault();

        if (!formData.third_party_id) {
            alert('Seleccione un tercero');
            return;
        }

        if (lines.some((l) => !l.description || l.unit_price <= 0)) {
            alert('Complete todas las líneas correctamente');
            return;
        }

        setLoading(true);
        try {
            await createInvoice({
                ...formData,
                state: asDraft ? 'DRAFT' : 'APPROVED',
                subtotal: totals.subtotal,
                discount: totals.discount,
                iva_5: totals.iva_5,
                iva_19: totals.iva_19,
                iva_excluded: totals.iva_excluded,
                total: grandTotal,
                lines,
            });
            router.push('/facturas');
        } catch (error) {
            alert(getSpanishErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={20} />
                    Volver
                </button>
                <h1 className="text-xl font-semibold text-gray-900">
                    Nueva Factura de {type === 'VENTA' ? 'Venta' : 'Compra'}
                </h1>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Información General</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo</label>
                        <input
                            type="text"
                            value={formData.prefix}
                            onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            maxLength={4}
                            data-testid="invoice-prefix"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                            data-testid="invoice-date"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                        <input
                            type="date"
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            data-testid="invoice-due-date"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'VENTA' ? 'Cliente' : 'Proveedor'} *
                        </label>
                        <select
                            value={formData.third_party_id}
                            onChange={(e) => setFormData({ ...formData, third_party_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                            data-testid="invoice-third-party"
                        >
                            <option value="">Seleccionar...</option>
                            {thirdParties.map((party) => (
                                <option key={party.id} value={party.id}>
                                    {party.full_name} - {party.document_type} {party.document_number}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Lines */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Detalle</h2>
                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        data-testid="add-line-btn"
                    >
                        <Plus size={16} />
                        Agregar línea
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">Descripción</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Cant.</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">Unidad</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Precio Unit.</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Dcto %</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-28">IVA</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Total</th>
                                <th className="px-2 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {lines.map((line, index) => (
                                <tr key={index} data-testid={`invoice-line-${index}`}>
                                    <td className="px-2 py-2 text-gray-500">{index + 1}</td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="text"
                                            value={line.description}
                                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                            placeholder="Descripción del producto/servicio"
                                            required
                                            data-testid={`line-description-${index}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={line.quantity}
                                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500"
                                            min="0.001"
                                            step="0.001"
                                            required
                                            data-testid={`line-quantity-${index}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select
                                            value={line.unit}
                                            onChange={(e) => updateLine(index, 'unit', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="UN">UN</option>
                                            <option value="KG">KG</option>
                                            <option value="LT">LT</option>
                                            <option value="MT">MT</option>
                                            <option value="HR">HR</option>
                                            <option value="DIA">DIA</option>
                                            <option value="MES">MES</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={line.unit_price}
                                            onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500"
                                            min="0"
                                            required
                                            data-testid={`line-price-${index}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            value={line.discount_rate}
                                            onChange={(e) => updateLine(index, 'discount_rate', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500"
                                            min="0"
                                            max="100"
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select
                                            value={line.tax_rate}
                                            onChange={(e) => updateLine(index, 'tax_rate', parseFloat(e.target.value))}
                                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                            data-testid={`line-tax-${index}`}
                                        >
                                            {TAX_RATES.map((rate) => (
                                                <option key={rate.value} value={rate.value}>
                                                    {rate.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-2 py-2 text-right font-medium text-gray-900">
                                        {formatCurrency(line.total)}
                                    </td>
                                    <td className="px-2 py-2">
                                        {lines.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeLine(index)}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                                data-testid={`remove-line-${index}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Totals & Retentions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Retentions */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Retenciones</h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">Retención en la Fuente</label>
                            <input
                                type="number"
                                value={formData.retention_source}
                                onChange={(e) => setFormData({ ...formData, retention_source: parseFloat(e.target.value) || 0 })}
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500"
                                min="0"
                                data-testid="retention-source"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">Retención de IVA</label>
                            <input
                                type="number"
                                value={formData.retention_iva}
                                onChange={(e) => setFormData({ ...formData, retention_iva: parseFloat(e.target.value) || 0 })}
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500"
                                min="0"
                                data-testid="retention-iva"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-600">Retención de ICA</label>
                            <input
                                type="number"
                                value={formData.retention_ica}
                                onChange={(e) => setFormData({ ...formData, retention_ica: parseFloat(e.target.value) || 0 })}
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500"
                                min="0"
                                data-testid="retention-ica"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Resumen</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        {totals.discount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>Descuento</span>
                                <span>-{formatCurrency(totals.discount)}</span>
                            </div>
                        )}
                        {totals.iva_5 > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">IVA 5%</span>
                                <span>{formatCurrency(totals.iva_5)}</span>
                            </div>
                        )}
                        {totals.iva_19 > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">IVA 19%</span>
                                <span>{formatCurrency(totals.iva_19)}</span>
                            </div>
                        )}
                        {(formData.retention_source > 0 || formData.retention_iva > 0 || formData.retention_ica > 0) && (
                            <>
                                <hr className="my-2" />
                                {formData.retention_source > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>(-) Rete Fuente</span>
                                        <span>-{formatCurrency(formData.retention_source)}</span>
                                    </div>
                                )}
                                {formData.retention_iva > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>(-) Rete IVA</span>
                                        <span>-{formatCurrency(formData.retention_iva)}</span>
                                    </div>
                                )}
                                {formData.retention_ica > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>(-) Rete ICA</span>
                                        <span>-{formatCurrency(formData.retention_ica)}</span>
                                    </div>
                                )}
                            </>
                        )}
                        <hr className="my-2" />
                        <div className="flex justify-between text-lg font-bold">
                            <span>TOTAL</span>
                            <span data-testid="invoice-total">{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
                <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Notas adicionales..."
                    data-testid="invoice-notes"
                />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    data-testid="save-draft-btn"
                >
                    <Save size={18} />
                    {loading ? 'Guardando...' : 'Guardar Borrador'}
                </button>
                <button
                    type="button"
                    onClick={(e) => handleSubmit(e as any, false)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    data-testid="save-approve-btn"
                >
                    <Save size={18} />
                    {loading ? 'Guardando...' : 'Guardar y Aprobar'}
                </button>
            </div>
        </form>
    );
}
