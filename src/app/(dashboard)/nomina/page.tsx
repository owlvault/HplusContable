import { getPayrolls, getPayrollSummary } from '@/actions/nomina';
import { PayrollList } from '@/components/nomina/payroll-list';
import { PayrollSummary } from '@/components/nomina/payroll-summary';
import Link from 'next/link';
import { Users, Plus, FileText } from 'lucide-react';

export default async function NominaPage() {
    const [payrolls, summary] = await Promise.all([
        getPayrolls(),
        getPayrollSummary(),
    ]);

    return (
        <div className="space-y-6" data-testid="nomina-page">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nómina</h1>
                    <p className="text-gray-600">Gestión de nómina y empleados</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/nomina/empleados"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        data-testid="manage-employees-btn"
                    >
                        <Users size={18} />
                        Empleados
                    </Link>
                    <Link
                        href="/nomina/nueva"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        data-testid="new-payroll-btn"
                    >
                        <Plus size={18} />
                        Nueva Nómina
                    </Link>
                </div>
            </div>

            {/* Summary Cards */}
            <PayrollSummary summary={summary} />

            {/* Payroll List */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                    <FileText size={20} className="text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Historial de Nóminas</h2>
                </div>
                <PayrollList payrolls={payrolls} />
            </div>
        </div>
    );
}
