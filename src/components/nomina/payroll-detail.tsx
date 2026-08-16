'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckCircle, 
    DollarSign, 
    Users, 
    Calculator,
    Building2,
    FileText,
    AlertCircle
} from 'lucide-react';
import { approvePayroll, markPayrollAsPaid } from '@/actions/nomina';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getSpanishErrorMessage } from '@/lib/error-messages';

interface PayrollDetailProps {
    payroll: any;
}

const STATUS_COLORS: Record<string, string> = {
    'DRAFT': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'APPROVED': 'bg-blue-100 text-blue-700 border-blue-200',
    'PAID': 'bg-green-100 text-green-700 border-green-200',
    'CANCELLED': 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
    'DRAFT': 'Borrador',
    'APPROVED': 'Aprobada',
    'PAID': 'Pagada',
    'CANCELLED': 'Anulada',
};

export function PayrollDetail({ payroll }: PayrollDetailProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPayDialog, setShowPayDialog] = useState(false);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value || 0);
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            await approvePayroll(payroll.id);
            toast({ title: 'Aprobada', description: 'Nómina aprobada correctamente', variant: 'success' });
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: getSpanishErrorMessage(error), variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async () => {
        setLoading(true);
        try {
            await markPayrollAsPaid(payroll.id, paymentDate);
            toast({ title: 'Pagada', description: 'Nómina marcada como pagada', variant: 'success' });
            setShowPayDialog(false);
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: getSpanishErrorMessage(error), variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const lines = payroll.lines || [];

    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Empleados</p>
                            <p className="text-2xl font-bold text-gray-900">{lines.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Calculator className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Devengado</p>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(payroll.total_earnings)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <AlertCircle className="text-red-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Deducciones</p>
                            <p className="text-xl font-bold text-red-600">-{formatCurrency(payroll.total_deductions)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <DollarSign className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Neto a Pagar</p>
                            <p className="text-xl font-bold text-purple-600">{formatCurrency(payroll.net_pay)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status and Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 text-sm font-medium rounded-full border ${STATUS_COLORS[payroll.status]}`}>
                        {STATUS_LABELS[payroll.status]}
                    </span>
                    {payroll.payment_date && (
                        <span className="text-sm text-gray-600">
                            Pagada el {new Date(payroll.payment_date).toLocaleDateString('es-CO')}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {payroll.status === 'DRAFT' && (
                        <button
                            onClick={handleApprove}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            data-testid="approve-payroll-btn"
                        >
                            <CheckCircle size={18} />
                            Aprobar Nómina
                        </button>
                    )}
                    {payroll.status === 'APPROVED' && (
                        <button
                            onClick={() => setShowPayDialog(true)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            data-testid="pay-payroll-btn"
                        >
                            <DollarSign size={18} />
                            Marcar como Pagada
                        </button>
                    )}
                </div>
            </div>

            {/* Employee Lines */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                    <FileText size={20} className="text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Detalle por Empleado</h2>
                </div>
                
                {lines.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No hay líneas de nómina
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="payroll-lines-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Empleado</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Salario</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Aux. Transp.</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Devengado</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Salud 4%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Pensión 4%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Otras Ded.</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Total Ded.</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500 bg-purple-50">Neto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {lines.map((line: any) => (
                                    <tr key={line.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {line.employee?.first_name} {line.employee?.last_name}
                                                </p>
                                                <p className="text-xs text-gray-500">{line.employee?.position}</p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.salary_earned)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.transportation_allowance)}</td>
                                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.total_earnings)}</td>
                                        <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(line.health_employee)}</td>
                                        <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(line.pension_employee)}</td>
                                        <td className="px-3 py-2 text-right text-red-600">
                                            -{formatCurrency(line.solidarity_fund + line.retention_source + line.other_deductions)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-red-600 font-medium">-{formatCurrency(line.total_deductions)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-purple-700 bg-purple-50">
                                            {formatCurrency(line.net_pay)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-semibold">
                                <tr>
                                    <td className="px-3 py-2">TOTALES</td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.salary_earned || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.transportation_allowance || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(payroll.total_earnings)}</td>
                                    <td className="px-3 py-2 text-right text-red-600">
                                        -{formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.health_employee || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600">
                                        -{formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.pension_employee || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600">
                                        -{formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.solidarity_fund || 0) + (l.retention_source || 0) + (l.other_deductions || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600">{formatCurrency(payroll.total_deductions)}</td>
                                    <td className="px-3 py-2 text-right text-purple-700 bg-purple-50">{formatCurrency(payroll.net_pay)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Employer Costs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                    <Building2 size={20} className="text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Aportes Empleador</h2>
                </div>
                
                {lines.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No hay datos de aportes
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="employer-costs-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Empleado</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Salud 8.5%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Pensión 12%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">ARL</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">SENA 2%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">ICBF 3%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Caja 4%</th>
                                    <th className="px-3 py-2 text-right font-medium text-gray-500 bg-orange-50">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {lines.map((line: any) => (
                                    <tr key={line.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium">
                                            {line.employee?.first_name} {line.employee?.last_name}
                                        </td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.health_employer)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.pension_employer)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.arl)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.sena)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.icbf)}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(line.caja_compensacion)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-orange-700 bg-orange-50">
                                            {formatCurrency(line.total_employer_costs)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-semibold">
                                <tr>
                                    <td className="px-3 py-2">TOTALES</td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.health_employer || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.pension_employer || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.arl || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.sena || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.icbf || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(lines.reduce((sum: number, l: any) => sum + (l.caja_compensacion || 0), 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right text-orange-700 bg-orange-50">
                                        {formatCurrency(payroll.total_employer_costs)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                
                <div className="p-4 bg-orange-50 border-t border-orange-200">
                    <p className="text-sm text-orange-800">
                        <strong>Costo total empleador:</strong> {formatCurrency(payroll.total_employer_costs)} 
                        <span className="text-orange-600 ml-2">
                            (Neto + Aportes = {formatCurrency(payroll.net_pay + payroll.total_employer_costs + payroll.total_deductions)})
                        </span>
                    </p>
                </div>
            </div>

            {/* Payment Dialog */}
            <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Pago de Nómina</DialogTitle>
                        <DialogDescription>
                            Ingrese la fecha en que se realizó el pago
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha de Pago
                        </label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    
                    <DialogFooter>
                        <button
                            onClick={() => setShowPayDialog(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleMarkPaid}
                            disabled={loading}
                            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Procesando...' : 'Confirmar Pago'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
