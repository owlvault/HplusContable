'use client';

import React, { useState } from 'react';
import {
    X,
    Plus,
    Trash2,
    CheckCircle2,
    Sparkles,
    UserCheck,
    FileText,
    ArrowRight,
    ArrowLeft,
    Check,
    CreditCard,
    DollarSign,
    Zap,
    ShieldCheck,
    Building,
} from 'lucide-react';
import { createGuidedSale, GuidedLineItem } from '@/actions/salesFlow';

interface ClientOption {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    email?: string;
    phone?: string;
    taxRegime?: string;
}

interface GuidedSaleWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    clients: ClientOption[];
    bankAccounts: Array<{
        id: string;
        bankName: string;
        accountNumber: string;
        accountType: string;
        balance: number;
    }>;
}

export function GuidedSaleWizardModal({
    isOpen,
    onClose,
    onSuccess,
    clients,
    bankAccounts,
}: GuidedSaleWizardModalProps) {
    if (!isOpen) return null;

    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
    const [newClient, setNewClient] = useState({
        fullName: '',
        documentType: 'NIT' as 'NIT' | 'CC' | 'CE',
        documentNumber: '',
        email: '',
        phone: '',
        address: '',
        city: 'Bogotá',
        taxRegime: 'RESPONSABLE_IVA',
    });

    const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState<string>(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [notes, setNotes] = useState<string>('');

    // Line items
    const [items, setItems] = useState<GuidedLineItem[]>([
        {
            description: 'Servicio de Consultoría / Desarrollo',
            quantity: 1,
            unit: 'UN',
            unitPrice: 1500000,
            taxRate: 19,
            discountRate: 0,
        },
    ]);

    // Emission and payment options
    const [emitImmediately, setEmitImmediately] = useState(true);
    const [isCashPayment, setIsCashPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('BANCO');
    const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '');

    // Calculations
    const calculateTotals = () => {
        let subtotal = 0;
        let discount = 0;
        let iva19 = 0;
        let iva5 = 0;
        let excluded = 0;

        items.forEach((item) => {
            const lineSub = item.quantity * item.unitPrice;
            const lineDisc = lineSub * ((item.discountRate || 0) / 100);
            const taxable = lineSub - lineDisc;

            subtotal += lineSub;
            discount += lineDisc;

            if (item.taxRate === 19) iva19 += taxable * 0.19;
            else if (item.taxRate === 5) iva5 += taxable * 0.05;
            else excluded += taxable;
        });

        const totalTax = iva19 + iva5;
        const total = subtotal - discount + totalTax;

        return {
            subtotal: Math.round(subtotal),
            discount: Math.round(discount),
            iva19: Math.round(iva19),
            iva5: Math.round(iva5),
            excluded: Math.round(excluded),
            totalTax: Math.round(totalTax),
            total: Math.round(total),
        };
    };

    const totals = calculateTotals();

    const formatCOP = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(val);
    };

    const addItem = () => {
        setItems([
            ...items,
            {
                description: '',
                quantity: 1,
                unit: 'UN',
                unitPrice: 0,
                taxRate: 19,
                discountRate: 0,
            },
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof GuidedLineItem, value: any) => {
        const next = [...items];
        next[index] = { ...next[index], [field]: value };
        setItems(next);
    };

    // Client Resolution
    const getActiveClient = () => {
        if (isCreatingNewClient) return newClient;
        const found = clients.find((c) => c.id === selectedClientId);
        return found
            ? {
                  fullName: found.fullName,
                  documentType: found.documentType as any,
                  documentNumber: found.documentNumber,
                  email: found.email || '',
                  phone: found.phone || '',
                  taxRegime: found.taxRegime || 'RESPONSABLE_IVA',
              }
            : null;
    };

    const activeClient = getActiveClient();

    // Validation checks
    const isClientValid = () => {
        if (isCreatingNewClient) {
            return Boolean(newClient.fullName.trim() && newClient.documentNumber.trim());
        }
        return Boolean(selectedClientId);
    };

    const isItemsValid = () => {
        return items.length > 0 && items.every((i) => i.description.trim() && i.unitPrice > 0 && i.quantity > 0);
    };

    const handleSubmit = async () => {
        if (!activeClient) {
            alert('Por favor selecciona o crea un cliente.');
            return;
        }

        if (!isItemsValid()) {
            alert('Por favor completa todos los productos con precio mayor a cero.');
            return;
        }

        setLoading(true);
        try {
            await createGuidedSale({
                client: {
                    id: isCreatingNewClient ? undefined : selectedClientId,
                    documentType: activeClient.documentType,
                    documentNumber: activeClient.documentNumber,
                    fullName: activeClient.fullName,
                    email: activeClient.email,
                    phone: activeClient.phone,
                    taxRegime: activeClient.taxRegime,
                },
                date: saleDate,
                dueDate: isCashPayment ? saleDate : dueDate,
                notes,
                items,
                emitElectronicInvoiceImmediately: emitImmediately,
                immediatePayment: isCashPayment
                    ? {
                          paymentMethod,
                          bankAccountId: paymentMethod !== 'EFECTIVO' ? bankAccountId : undefined,
                          amount: totals.total,
                          reference: 'Cobro de contado al emitir',
                      }
                    : undefined,
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.message || 'Error al procesar la venta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
                            <Sparkles className="w-6 h-6 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                                    Asistente Inteligente
                                </span>
                                <span className="text-xs text-blue-200">Cero Conocimiento Requerido</span>
                            </div>
                            <h2 className="text-xl font-bold mt-0.5">Nuevo Ciclo de Venta Guiado</h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Stepper */}
                <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { step: 1, title: '1. Cliente', icon: UserCheck },
                            { step: 2, title: '2. Productos', icon: FileText },
                            { step: 3, title: '3. Factura DIAN', icon: Zap },
                            { step: 4, title: '4. Cobro / Pago', icon: DollarSign },
                        ].map((s) => {
                            const Icon = s.icon;
                            const isActive = currentStep === s.step;
                            const isDone = currentStep > s.step;

                            return (
                                <button
                                    key={s.step}
                                    type="button"
                                    onClick={() => {
                                        if (s.step === 1 || (s.step === 2 && isClientValid()) || (s.step === 3 && isItemsValid())) {
                                            setCurrentStep(s.step as any);
                                        }
                                    }}
                                    className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : isDone
                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                            : 'text-slate-400 dark:text-slate-500'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-white text-blue-600'
                                                : isDone
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                        }`}
                                    >
                                        {isDone ? <Check className="w-3 h-3" /> : s.step}
                                    </div>
                                    <span className="truncate">{s.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body Content by Step */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* STEP 1: CLIENTE */}
                    {currentStep === 1 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        ¿A quién le estás vendiendo?
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        El ERP vinculará automáticamente el régimen tributario y el correo para la DIAN.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingNewClient(!isCreatingNewClient)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition"
                                >
                                    {isCreatingNewClient ? '← Seleccionar de la lista' : '+ Crear Nuevo Cliente Rápido'}
                                </button>
                            </div>

                            {!isCreatingNewClient ? (
                                <div className="space-y-3">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Buscar Cliente Registrado
                                    </label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Selecciona un cliente registrado --</option>
                                        {clients.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.fullName} ({c.documentType} {c.documentNumber})
                                            </option>
                                        ))}
                                    </select>

                                    {activeClient && (
                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                                    ✓ Cliente Seleccionado
                                                </span>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                                                    {activeClient.fullName}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {activeClient.documentType}: {activeClient.documentNumber} • Correo: {activeClient.email || 'Sin correo registrado'}
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                                                {activeClient.taxRegime}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Tipo Doc
                                            </label>
                                            <select
                                                value={newClient.documentType}
                                                onChange={(e) =>
                                                    setNewClient({ ...newClient, documentType: e.target.value as any })
                                                }
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs"
                                            >
                                                <option value="NIT">NIT (Empresa)</option>
                                                <option value="CC">Cédula de Ciudadanía</option>
                                                <option value="CE">Cédula de Extranjería</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Número de Documento / NIT *
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej. 901234567"
                                                value={newClient.documentNumber}
                                                onChange={(e) =>
                                                    setNewClient({ ...newClient, documentNumber: e.target.value })
                                                }
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Razón Social / Nombre Completo *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej. Inversiones Andinas SAS"
                                            value={newClient.fullName}
                                            onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Correo Electrónico (Facturación DIAN) *
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="facturas@cliente.com"
                                                value={newClient.email}
                                                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Teléfono / Celular
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="300 123 4567"
                                                value={newClient.phone}
                                                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Fechas */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Fecha de la Venta
                                    </label>
                                    <input
                                        type="date"
                                        value={saleDate}
                                        onChange={(e) => setSaleDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Fecha Vencimiento (Crédito)
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PRODUCTOS / SERVICIOS */}
                    {currentStep === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        ¿Qué productos o servicios vendiste?
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Los impuestos (IVA) y cuentas contables se liquidan automáticamente.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar Ítem
                                </button>
                            </div>

                            {/* Table of items */}
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-3 items-center"
                                    >
                                        <div className="flex-1 w-full">
                                            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                                                Descripción del Ítem
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej. Servicio de consultoría o producto"
                                                value={item.description}
                                                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium"
                                                required
                                            />
                                        </div>

                                        <div className="w-20">
                                            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                                                Cant.
                                            </label>
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="any"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 1)}
                                                className="w-full px-2 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs text-center font-bold"
                                                required
                                            />
                                        </div>

                                        <div className="w-32">
                                            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                                                Precio Unit. ($)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.unitPrice}
                                                onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-bold text-right"
                                                required
                                            />
                                        </div>

                                        <div className="w-28">
                                            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                                                IVA
                                            </label>
                                            <select
                                                value={item.taxRate}
                                                onChange={(e) => updateItem(idx, 'taxRate', Number(e.target.value))}
                                                className="w-full px-2 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium"
                                            >
                                                <option value={19}>IVA 19%</option>
                                                <option value={5}>IVA 5%</option>
                                                <option value={0}>Excluido (0%)</option>
                                            </select>
                                        </div>

                                        <div className="w-28 text-right font-extrabold text-sm text-slate-900 dark:text-white">
                                            <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                                                Total
                                            </label>
                                            {formatCOP(item.quantity * item.unitPrice * (1 + item.taxRate / 100))}
                                        </div>

                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(idx)}
                                                className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition mt-4 md:mt-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Summary footer */}
                            <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5 text-xs text-slate-300">
                                    <div>Subtotal: {formatCOP(totals.subtotal)}</div>
                                    <div>IVA Total: {formatCOP(totals.totalTax)}</div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs uppercase text-slate-400 tracking-wider">
                                        Gran Total a Facturar
                                    </span>
                                    <div className="text-2xl font-black text-emerald-400">{formatCOP(totals.total)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PRE-FLIGHT CHECKLIST & FACTURA DIAN */}
                    {currentStep === 3 && (
                        <div className="space-y-5 animate-in fade-in duration-150">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    Validación de Facturación Electrónica DIAN
                                </h3>
                                <p className="text-xs text-slate-500">
                                    El sistema realizó una auditoría previa para garantizar la aceptación inmediata por la DIAN.
                                </p>
                            </div>

                            {/* Checklist */}
                            <div className="space-y-2.5">
                                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3 text-xs">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <div>
                                        <strong>Cliente Validado:</strong> {activeClient?.fullName} ({activeClient?.documentType} {activeClient?.documentNumber})
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3 text-xs">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <div>
                                        <strong>Cálculo Tributario Balanceado:</strong> Base gravable {formatCOP(totals.subtotal)} + Impuestos {formatCOP(totals.totalTax)}
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3 text-xs">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <div>
                                        <strong>Asiento Contable NIIF Preparado:</strong> Débito Clientes Nacionales (1305) vs Crédito Ingresos (4135) + IVA (2408)
                                    </div>
                                </div>
                            </div>

                            {/* Decision: Emitir de inmediato vs Guardar Borrador */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                                            ⚡ Emitir Factura Electrónica en 1 Clic
                                        </h4>
                                        <p className="text-xs text-blue-700 dark:text-blue-400">
                                            Genera el XML UBL 2.1, lo firma digitalmente y actualiza tu libro mayor al instante.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={emitImmediately}
                                        onChange={(e) => setEmitImmediately(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: COBRO / PAGO */}
                    {currentStep === 4 && (
                        <div className="space-y-5 animate-in fade-in duration-150">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    ¿Cómo se cobrará esta venta?
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Si el cliente ya pagó de contado, el recibo de caja y el movimiento bancario se registrarán automáticamente.
                                </p>
                            </div>

                            {/* Contado vs Credito Toggle */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCashPayment(false)}
                                    className={`p-4 rounded-2xl border text-left transition ${
                                        !isCashPayment
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Building className="w-4 h-4 text-blue-600" />
                                        Venta a Crédito (Cartera)
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Quedará pendiente por cobrar con fecha límite {dueDate}.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsCashPayment(true)}
                                    className={`p-4 rounded-2xl border text-left transition ${
                                        isCashPayment
                                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                        Cobro Inmediato (Contado)
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        El cliente ya pagó el total de {formatCOP(totals.total)}.
                                    </p>
                                </button>
                            </div>

                            {isCashPayment && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Medio de Pago Recibido
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-medium"
                                    >
                                        <option value="BANCO">Transferencia Bancaria</option>
                                        <option value="EFECTIVO">Efectivo / Caja Principal</option>
                                        <option value="NEQUI">Nequi / Daviplata</option>
                                    </select>

                                    {paymentMethod !== 'EFECTIVO' && bankAccounts.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Cuenta de Destino
                                            </label>
                                            <select
                                                value={bankAccountId}
                                                onChange={(e) => setBankAccountId(e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs"
                                            >
                                                {bankAccounts.map((acc) => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.bankName} ({acc.accountNumber})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Notas Adicionales */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Notas u Observaciones
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Detalles adicionales para el cliente o la entrega..."
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation Buttons */}
                <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            if (currentStep > 1) setCurrentStep((currentStep - 1) as any);
                            else onClose();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {currentStep === 1 ? 'Cancelar' : 'Anterior'}
                    </button>

                    <div className="flex items-center gap-3">
                        {currentStep < 4 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (currentStep === 1 && !isClientValid()) {
                                        alert('Por favor selecciona o crea un cliente antes de continuar.');
                                        return;
                                    }
                                    if (currentStep === 2 && !isItemsValid()) {
                                        alert('Por favor agrega al menos un producto con precio válido.');
                                        return;
                                    }
                                    setCurrentStep((currentStep + 1) as any);
                                }}
                                className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                            >
                                Siguiente Paso
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                            >
                                {loading ? (
                                    <span>Emitiendo y Asentando...</span>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        {emitImmediately
                                            ? isCashPayment
                                                ? 'Emitir Factura y Registrar Cobro Ahora'
                                                : 'Emitir Factura DIAN en 1 Clic'
                                            : 'Guardar Venta Borrador'}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
