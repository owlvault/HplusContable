import { Suspense } from 'react';
import { InvoiceForm } from '@/components/facturas/invoice-form';

export default function NuevaFacturaPage() {
    return (
        <div data-testid="nueva-factura-page">
            <Suspense fallback={<div className="animate-pulse bg-gray-100 h-96 rounded-lg" />}>
                <InvoiceForm />
            </Suspense>
        </div>
    );
}
