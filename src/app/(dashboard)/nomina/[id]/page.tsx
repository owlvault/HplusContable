import { getPayroll } from '@/actions/nomina';
import { PayrollDetail } from '@/components/nomina/payroll-detail';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PayrollDetailPage({ params }: Props) {
    const { id } = await params;
    
    let payroll;
    try {
        payroll = await getPayroll(id);
    } catch {
        notFound();
    }

    if (!payroll) {
        notFound();
    }

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
    };

    const periodLabel = `${getMonthName(payroll.period_month)} ${payroll.period_year}`;
    const periodTypeLabel = payroll.period_type === 'MENSUAL' ? 'Mensual' : 
        payroll.period_type === 'PRIMERA_QUINCENA' ? 'Primera Quincena' : 'Segunda Quincena';

    return (
        <div className="space-y-6" data-testid="payroll-detail-page">
            <div className="flex items-center gap-4">
                <Link
                    href="/nomina"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 capitalize">
                        Nómina {periodLabel}
                    </h1>
                    <p className="text-gray-600">{periodTypeLabel}</p>
                </div>
            </div>

            <PayrollDetail payroll={payroll} />
        </div>
    );
}
