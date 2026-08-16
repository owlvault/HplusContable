'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, CheckCircle, DollarSign, FileText } from 'lucide-react';
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

interface PayrollListProps {
    payrolls: any[];
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
    'PRIMERA_QUINCENA': 'Primera Quincena',
    'SEGUNDA_QUINCENA': 'Segunda Quincena',
    'MENSUAL': 'Mensual',
};

const STATUS_COLORS: Record<string, string> = {
    'DRAFT': 'bg-yellow-100 text-yellow-700',
    'APPROVED': 'bg-blue-100 text-blue-700',
    'PAID': 'bg-green-100 text-green-700',
    'CANCELLED': 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
    'DRAFT': 'Borrador',
    'APPROVED': 'Aprobada',
    'PAID': 'Pagada',
    'CANCELLED': 'Anulada',
};

export function PayrollList({ payrolls }: PayrollListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [showPayDialog, setShowPayDialog] = useState<string | null>(null);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
    };

    const handleApprove = async (id: string) => {
        setLoading(id);
        try {
            await approvePayroll(id);
            toast({ title: 'Aprobada', description: 'Nómina aprobada correctamente', variant: 'success' });
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: getSpanishErrorMessage(error), variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    };

    const handleMarkPaid = async () => {
        if (!showPayDialog) return;
        
        setLoading(showPayDialog);
        try {
            await markPayrollAsPaid(showPayDialog, paymentDate);
            toast({ title: 'Pagada', description: 'Nómina marcada como pagada', variant: 'success' });
            setShowPayDialog(null);
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: getSpanishErrorMessage(error), variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    };

    if (payrolls.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No hay nóminas registradas</p>
                <p className="text-sm">Crea una nueva nómina para comenzar</p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full" data-testid="payroll-table">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Devengado</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deducciones</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Neto a Pagar</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {payrolls.map((payroll) => (
                            <tr key={payroll.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                                    {getMonthName(payroll.period_month)} {payroll.period_year}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {PERIOD_TYPE_LABELS[payroll.period_type] || payroll.period_type}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-900">
                                    {formatCurrency(payroll.total_earnings)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-red-600">
                                    -{formatCurrency(payroll.total_deductions)}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                    {formatCurrency(payroll.net_pay)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[payroll.status]}`}>
                                        {STATUS_LABELS[payroll.status]}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => router.push(`/nomina/${payroll.id}`)}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="Ver detalle"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        
                                        {payroll.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handleApprove(payroll.id)}
                                                disabled={loading === payroll.id}
                                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                                title="Aprobar"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        )}
                                        
                                        {payroll.status === 'APPROVED' && (
                                            <button
                                                onClick={() => setShowPayDialog(payroll.id)}
                                                disabled={loading === payroll.id}
                                                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"
                                                title="Marcar como pagada"
                                            >
                                                <DollarSign size={18} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Payment Dialog */}
            <Dialog open={!!showPayDialog} onOpenChange={() => setShowPayDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Pago de Nómina</DialogTitle>
                        <DialogDescription>
                            Ingrese la fecha en que se realizó el pago de la nómina
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
                            onClick={() => setShowPayDialog(null)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleMarkPaid}
                            disabled={loading !== null}
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
