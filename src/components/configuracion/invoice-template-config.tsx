'use client';

import { useState, useEffect } from 'react';
import { getInvoiceTemplates, saveInvoiceTemplate, setDefaultTemplate, deleteInvoiceTemplate, getDefaultTemplate, InvoiceTemplate } from '@/actions/invoice-templates';
import { FileText, Palette, Building2, Plus, Trash2, Check, Star, Loader2, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function InvoiceTemplateConfig() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await getInvoiceTemplates();
            setTemplates(data);
            if (data.length > 0) {
                setSelectedTemplate(data.find(t => t.is_default) || data[0]);
            }
        } catch (error) {
            const defaultTemplate = await getDefaultTemplate();
            setTemplates([defaultTemplate]);
            setSelectedTemplate(defaultTemplate);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field: keyof InvoiceTemplate, value: any) => {
        if (!selectedTemplate) return;
        setSelectedTemplate({ ...selectedTemplate, [field]: value });
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;
        
        setSaving(true);
        try {
            await saveInvoiceTemplate(selectedTemplate);
            toast({
                title: 'Guardado',
                description: 'Plantilla actualizada correctamente',
                variant: 'success',
            });
            loadTemplates();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo guardar la plantilla',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async () => {
        if (!selectedTemplate || selectedTemplate.is_default) return;
        
        try {
            await setDefaultTemplate(selectedTemplate.id);
            toast({
                title: 'Plantilla por defecto',
                description: `"${selectedTemplate.name}" es ahora la plantilla por defecto`,
                variant: 'success',
            });
            loadTemplates();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async () => {
        if (!selectedTemplate) return;
        
        try {
            await deleteInvoiceTemplate(selectedTemplate.id);
            toast({
                title: 'Eliminada',
                description: 'Plantilla eliminada correctamente',
                variant: 'success',
            });
            setShowDeleteDialog(false);
            setSelectedTemplate(null);
            loadTemplates();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleNewTemplate = async () => {
        const newTemplate: Partial<InvoiceTemplate> = {
            name: 'Nueva Plantilla',
            is_default: false,
            primary_color: '#1e3a5f',
            secondary_color: '#2563eb',
            accent_color: '#10b981',
            company_name: '',
            company_nit: '',
            company_address: '',
            company_phone: '',
            company_email: '',
            show_logo: true,
            show_qr: false,
        };
        
        try {
            await saveInvoiceTemplate(newTemplate);
            toast({
                title: 'Creada',
                description: 'Nueva plantilla creada',
                variant: 'success',
            });
            loadTemplates();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <FileText className="text-purple-600" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Plantillas de Factura</h2>
                        <p className="text-sm text-gray-500">Personaliza el diseño de tus facturas</p>
                    </div>
                </div>
                <button
                    onClick={handleNewTemplate}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                    <Plus size={16} />
                    Nueva
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Template List */}
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600 mb-3">Plantillas disponibles</p>
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                                selectedTemplate?.id === template.id
                                    ? 'bg-purple-50 border-2 border-purple-500'
                                    : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                {template.is_default && (
                                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                )}
                                <span className="font-medium text-sm">{template.name}</span>
                            </div>
                            <div 
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: template.primary_color }}
                            />
                        </button>
                    ))}
                </div>

                {/* Template Editor */}
                {selectedTemplate && (
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Building2 size={16} />
                                Información de la Empresa
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Nombre plantilla</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.name}
                                        onChange={(e) => handleFieldChange('name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Razón Social</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.company_name}
                                        onChange={(e) => handleFieldChange('company_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">NIT</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.company_nit || ''}
                                        onChange={(e) => handleFieldChange('company_nit', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.company_phone || ''}
                                        onChange={(e) => handleFieldChange('company_phone', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs text-gray-500 mb-1">Dirección</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.company_address || ''}
                                        onChange={(e) => handleFieldChange('company_address', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={selectedTemplate.company_email || ''}
                                        onChange={(e) => handleFieldChange('company_email', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Sitio Web</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.company_website || ''}
                                        onChange={(e) => handleFieldChange('company_website', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Colors */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <Palette size={16} />
                                Colores Corporativos
                            </h3>
                            <div className="flex gap-6">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Principal</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedTemplate.primary_color}
                                            onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedTemplate.primary_color}
                                            onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Secundario</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedTemplate.secondary_color}
                                            onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedTemplate.secondary_color}
                                            onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Acento</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedTemplate.accent_color}
                                            onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedTemplate.accent_color}
                                            onChange={(e) => handleFieldChange('accent_color', e.target.value)}
                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Información Adicional</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Términos de Pago</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.payment_terms || ''}
                                        onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Ej: Pago a 30 días"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Información Bancaria</label>
                                    <textarea
                                        value={selectedTemplate.bank_info || ''}
                                        onChange={(e) => handleFieldChange('bank_info', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        rows={2}
                                        placeholder="Banco, número de cuenta, etc."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Texto del Pie</label>
                                    <input
                                        type="text"
                                        value={selectedTemplate.footer_text || ''}
                                        onChange={(e) => handleFieldChange('footer_text', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Gracias por su preferencia"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedTemplate.show_logo}
                                    onChange={(e) => handleFieldChange('show_logo', e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-700">Mostrar logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedTemplate.show_qr}
                                    onChange={(e) => handleFieldChange('show_qr', e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-700">Mostrar código QR</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                Guardar Cambios
                            </button>
                            {!selectedTemplate.is_default && (
                                <>
                                    <button
                                        onClick={handleSetDefault}
                                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                                    >
                                        <Star size={16} />
                                        Establecer por Defecto
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteDialog(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        <Trash2 size={16} />
                                        Eliminar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Eliminar Plantilla</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de eliminar la plantilla &quot;{selectedTemplate?.name}&quot;?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            onClick={() => setShowDeleteDialog(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
