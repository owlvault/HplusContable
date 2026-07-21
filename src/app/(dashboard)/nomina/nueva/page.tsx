'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { createPayroll } from '@/actions/nomina';
import { useToast } from '@/hooks/use-toast';

export default function NuevaNominaPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const [formData, setFormData] = useState({
        year: currentYear,
        month: currentMonth,
        periodType: 'MENSUAL' as 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA' | 'MENSUAL',
    });

    const months = [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' },
    ];

    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await createPayroll(
                formData.year,
                formData.month,
                formData.periodType
            );
            
            toast({ 
                title: 'Nómina Creada', 
                description: 'La nómina se ha generado correctamente', 
                variant: 'success' 
            });
            
            router.push(`/nomina/${result.id}`);
        } catch (error: any) {
            toast({ 
                title: 'Error', 
                description: error.message, 
                variant: 'destructive' 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto" data-testid="nueva-nomina-page">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/nomina"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nueva Nómina</h1>
                    <p className="text-gray-600">Generar nómina para un período</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <Calendar className="text-blue-600" size={24} />
                    <div>
                        <p className="font-medium text-blue-900">Período de Nómina</p>
                        <p className="text-sm text-blue-700">
                            Seleccione el año, mes y tipo de período a generar
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Año
                        </label>
                        <select
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mes
                        </label>
                        <select
                            value={formData.month}
                            onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                        >
                            {months.map(month => (
                                <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Período
                        </label>
                        <select
                            value={formData.periodType}
                            onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            required
                        >
                            <option value="MENSUAL">Mensual</option>
                            <option value="PRIMERA_QUINCENA">Primera Quincena</option>
                            <option value="SEGUNDA_QUINCENA">Segunda Quincena</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        <strong>Nota:</strong> Al crear la nómina se calcularán automáticamente los 
                        devengados, deducciones y aportes patronales para todos los empleados activos.
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Link
                        href="/nomina"
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        {loading ? 'Generando...' : 'Generar Nómina'}
                    </button>
                </div>
            </form>
        </div>
    );
}
