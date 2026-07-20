import { notFound } from 'next/navigation';
import { getInvoice } from '@/actions/invoices';
import { InvoiceDetail } from '@/components/facturas/invoice-detail';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
    const { id } = await params;
    
    try {
        const invoice = await getInvoice(id);
        
        if (!invoice) {
            notFound();
        }

        return (
            <div data-testid="invoice-detail-page">
                <InvoiceDetail invoice={invoice} />
            </div>
        );
    } catch (error) {
        notFound();
    }
}
