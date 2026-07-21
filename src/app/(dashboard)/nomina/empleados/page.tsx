import { getEmployees } from '@/actions/nomina';
import { EmployeesList } from '@/components/nomina/employees-list';
import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';

export default async function EmpleadosPage() {
    const employees = await getEmployees(false); // Get all employees

    return (
        <div className="space-y-6" data-testid="empleados-page">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link
                        href="/nomina"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
                        <p className="text-gray-600">Gestión de empleados de la empresa</p>
                    </div>
                </div>
                <Link
                    href="/nomina/empleados/nuevo"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    data-testid="new-employee-btn"
                >
                    <UserPlus size={18} />
                    Nuevo Empleado
                </Link>
            </div>

            <EmployeesList employees={employees} />
        </div>
    );
}
