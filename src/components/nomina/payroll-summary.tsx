'use client';

import { Users, DollarSign, TrendingUp, Calendar } from 'lucide-react';

interface PayrollSummaryProps {
    summary: {
        employeeCount: number;
        currentPayroll: any;
        ytdNetPay: number;
        ytdEmployerCosts: number;
        ytdTotal: number;
    };
}

export function PayrollSummary({ summary }: PayrollSummaryProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const currentMonth = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Employees */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Empleados Activos</p>
                        <p className="text-2xl font-bold text-gray-900">{summary.employeeCount}</p>
                    </div>
                </div>
            </div>

            {/* Current Month */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Calendar className="text-green-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 capitalize">{currentMonth}</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {summary.currentPayroll 
                                ? formatCurrency(summary.currentPayroll.net_pay)
                                : 'Sin nómina'
                            }
                        </p>
                        {summary.currentPayroll && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                                summary.currentPayroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                summary.currentPayroll.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                                {summary.currentPayroll.status === 'PAID' ? 'Pagada' :
                                 summary.currentPayroll.status === 'APPROVED' ? 'Aprobada' : 'Borrador'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* YTD Net Pay */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <DollarSign className="text-purple-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Nómina Pagada (Año)</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.ytdNetPay)}</p>
                    </div>
                </div>
            </div>

            {/* YTD Total Cost */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <TrendingUp className="text-orange-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Costo Total (Año)</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.ytdTotal)}</p>
                        <p className="text-xs text-gray-400">Incluye aportes empleador</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
