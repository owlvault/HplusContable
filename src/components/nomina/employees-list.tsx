'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Edit, UserX, UserCheck, Search } from 'lucide-react';
import { deactivateEmployee, updateEmployee } from '@/actions/nomina';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface EmployeesListProps {
    employees: any[];
}

const CONTRACT_LABELS: Record<string, string> = {
    'INDEFINIDO': 'Indefinido',
    'FIJO': 'Término Fijo',
    'OBRA_LABOR': 'Obra o Labor',
    'PRESTACION_SERVICIOS': 'Prestación de Servicios',
};

export function EmployeesList({ employees }: EmployeesListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(true);
    const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = 
            emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.document_number?.includes(searchTerm);
        
        const matchesActive = showActiveOnly ? emp.is_active : true;
        
        return matchesSearch && matchesActive;
    });

    const handleDeactivate = async () => {
        if (!confirmDeactivate) return;
        
        setLoading(confirmDeactivate);
        try {
            await deactivateEmployee(confirmDeactivate);
            toast({ title: 'Desactivado', description: 'Empleado desactivado correctamente', variant: 'success' });
            setConfirmDeactivate(null);
            router.refresh();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    };

    const handleReactivate = async (id: string) => {
        setLoading(id);
        try {
            await updateEmployee(id, { is_active: true, termination_date: undefined });
            toast({ title: 'Reactivado', description: 'Empleado reactivado correctamente', variant: 'success' });
            router.refresh();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    };

    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200">
                {/* Filters */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o documento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showActiveOnly}
                            onChange={(e) => setShowActiveOnly(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">Solo activos</span>
                    </label>
                </div>

                {/* Table */}
                {filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <p>No se encontraron empleados</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full" data-testid="employees-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salario Base</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredEmployees.map((employee) => (
                                    <tr key={employee.id} className={`hover:bg-gray-50 ${!employee.is_active ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {employee.first_name} {employee.last_name}
                                                </p>
                                                {employee.email && (
                                                    <p className="text-xs text-gray-500">{employee.email}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {employee.document_type} {employee.document_number}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {employee.position}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {CONTRACT_LABELS[employee.contract_type] || employee.contract_type}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                            {formatCurrency(employee.base_salary)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                employee.is_active 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {employee.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => router.push(`/nomina/empleados/${employee.id}`)}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => router.push(`/nomina/empleados/${employee.id}/editar`)}
                                                    className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                {employee.is_active ? (
                                                    <button
                                                        onClick={() => setConfirmDeactivate(employee.id)}
                                                        disabled={loading === employee.id}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                                        title="Desactivar"
                                                    >
                                                        <UserX size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleReactivate(employee.id)}
                                                        disabled={loading === employee.id}
                                                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                                        title="Reactivar"
                                                    >
                                                        <UserCheck size={18} />
                                                    </button>
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

            {/* Deactivate Confirmation */}
            <Dialog open={!!confirmDeactivate} onOpenChange={() => setConfirmDeactivate(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Desactivar Empleado</DialogTitle>
                        <DialogDescription>
                            ¿Está seguro de desactivar este empleado? No se incluirá en futuras nóminas.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            onClick={() => setConfirmDeactivate(null)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDeactivate}
                            disabled={loading !== null}
                            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? 'Procesando...' : 'Desactivar'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
