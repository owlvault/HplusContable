'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { createEmployee } from '@/actions/nomina';
import { useToast } from '@/hooks/use-toast';
import { getSpanishErrorMessage } from '@/lib/error-messages';

export default function NuevoEmpleadoPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        document_type: 'CC' as 'CC' | 'CE' | 'TI' | 'PA',
        document_number: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        hire_date: new Date().toISOString().split('T')[0],
        position: '',
        department: '',
        base_salary: 0,
        contract_type: 'INDEFINIDO' as 'INDEFINIDO' | 'FIJO' | 'OBRA_LABOR' | 'PRESTACION_SERVICIOS',
        payment_frequency: 'MENSUAL' as 'QUINCENAL' | 'MENSUAL',
        bank_name: '',
        bank_account_type: 'AHORROS' as 'AHORROS' | 'CORRIENTE',
        bank_account_number: '',
        eps: '',
        pension_fund: '',
        arl_risk_level: 1 as 1 | 2 | 3 | 4 | 5,
        is_active: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await createEmployee(formData);
            
            toast({ 
                title: 'Empleado Creado', 
                description: 'El empleado se ha registrado correctamente', 
                variant: 'success' 
            });
            
            router.push('/nomina/empleados');
        } catch (error) {
            toast({ 
                title: 'Error', 
                description: getSpanishErrorMessage(error), 
                variant: 'destructive' 
            });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO').format(value);
    };

    return (
        <div className="max-w-4xl mx-auto" data-testid="nuevo-empleado-page">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/nomina/empleados"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nuevo Empleado</h1>
                    <p className="text-gray-600">Registrar un nuevo empleado en el sistema</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                {/* Personal Info */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User size={20} />
                        Información Personal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tipo Documento *
                                </label>
                                <select
                                    value={formData.document_type}
                                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    required
                                >
                                    <option value="CC">Cédula de Ciudadanía</option>
                                    <option value="CE">Cédula de Extranjería</option>
                                    <option value="TI">Tarjeta de Identidad</option>
                                    <option value="PA">Pasaporte</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Número de Documento *
                                </label>
                                <input
                                    type="text"
                                    value={formData.document_number}
                                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombres *
                            </label>
                            <input
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Apellidos *
                            </label>
                            <input
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dirección
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Labor Info */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Laboral</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha de Ingreso *
                            </label>
                            <input
                                type="date"
                                value={formData.hire_date}
                                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cargo *
                            </label>
                            <input
                                type="text"
                                value={formData.position}
                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Departamento
                            </label>
                            <input
                                type="text"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Contrato *
                            </label>
                            <select
                                value={formData.contract_type}
                                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                            >
                                <option value="INDEFINIDO">Término Indefinido</option>
                                <option value="FIJO">Término Fijo</option>
                                <option value="OBRA_LABOR">Obra o Labor</option>
                                <option value="PRESTACION_SERVICIOS">Prestación de Servicios</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Salario Base *
                            </label>
                            <input
                                type="number"
                                value={formData.base_salary}
                                onChange={(e) => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                min="0"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {formatCurrency(formData.base_salary)} COP
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Frecuencia de Pago
                            </label>
                            <select
                                value={formData.payment_frequency}
                                onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="MENSUAL">Mensual</option>
                                <option value="QUINCENAL">Quincenal</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bank Info */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Bancaria</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Banco
                            </label>
                            <input
                                type="text"
                                value={formData.bank_name}
                                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Ej: Bancolombia"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Cuenta
                            </label>
                            <select
                                value={formData.bank_account_type}
                                onChange={(e) => setFormData({ ...formData, bank_account_type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="AHORROS">Ahorros</option>
                                <option value="CORRIENTE">Corriente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Número de Cuenta
                            </label>
                            <input
                                type="text"
                                value={formData.bank_account_number}
                                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Social Security */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Seguridad Social</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                EPS
                            </label>
                            <input
                                type="text"
                                value={formData.eps}
                                onChange={(e) => setFormData({ ...formData, eps: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Ej: Sura, Sanitas"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fondo de Pensiones
                            </label>
                            <input
                                type="text"
                                value={formData.pension_fund}
                                onChange={(e) => setFormData({ ...formData, pension_fund: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Ej: Porvenir, Protección"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nivel de Riesgo ARL
                            </label>
                            <select
                                value={formData.arl_risk_level}
                                onChange={(e) => setFormData({ ...formData, arl_risk_level: Number(e.target.value) as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value={1}>Nivel I - Riesgo Mínimo (0.522%)</option>
                                <option value={2}>Nivel II - Riesgo Bajo (1.044%)</option>
                                <option value={3}>Nivel III - Riesgo Medio (2.436%)</option>
                                <option value={4}>Nivel IV - Riesgo Alto (4.350%)</option>
                                <option value={5}>Nivel V - Riesgo Máximo (6.960%)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Link
                        href="/nomina/empleados"
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
                        {loading ? 'Guardando...' : 'Guardar Empleado'}
                    </button>
                </div>
            </form>
        </div>
    );
}
