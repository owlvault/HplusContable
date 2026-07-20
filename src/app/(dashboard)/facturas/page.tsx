import { Suspense } from 'react';
import { getInvoices, getInvoiceStats } from '@/actions/invoices';
import { InvoicesTable } from '@/components/facturas/invoices-table';
import { InvoiceStats } from '@/components/facturas/invoice-stats';

export default async function FacturasPage() {
    const [ventasInvoices, comprasInvoices, stats] = await Promise.all([
        getInvoices('VENTA').catch(() => []),
        getInvoices('COMPRA').catch(() => []),
        getInvoiceStats().catch(() => null),
    ]);

    return (
        <div data-testid="facturas-page">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
                <p className="text-gray-500 mt-1">
                    Gestiona tus facturas de venta y compra
                </p>
            </div>

            <InvoiceStats stats={stats} />

            <div className="space-y-6">
                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <InvoicesTable invoices={ventasInvoices} type="VENTA" />
                </Suspense>

                <Suspense fallback={<div className="animate-pulse bg-gray-100 h-64 rounded-lg" />}>
                    <InvoicesTable invoices={comprasInvoices} type="COMPRA" />
                </Suspense>
            </div>
        </div>
    );
}
