export type InvoiceType = 'VENTA' | 'COMPRA';
export type InvoiceState = 'DRAFT' | 'APPROVED' | 'SENT' | 'PAID' | 'CANCELLED';

export interface InvoiceLine {
    id?: string;
    invoice_id?: string;
    line_number: number;
    product_code?: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount_rate: number;
    discount_amount: number;
    tax_rate: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    account_code?: string;
}

export interface Invoice {
    id: string;
    prefix: string;
    number: number;
    type: InvoiceType;
    date: string;
    due_date?: string;
    third_party_id: string;
    subtotal: number;
    discount: number;
    iva_5: number;
    iva_19: number;
    iva_excluded: number;
    consumption_tax: number;
    retention_source: number;
    retention_iva: number;
    retention_ica: number;
    total: number;
    cufe?: string;
    qr_code?: string;
    dian_status: string;
    journal_entry_id?: string;
    state: InvoiceState;
    notes?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface InvoiceWithDetails extends Invoice {
    lines: InvoiceLine[];
    third_party?: {
        id: string;
        full_name: string;
        document_type: string;
        document_number: string;
        dv?: number;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
    };
}

export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
    DRAFT: 'Borrador',
    APPROVED: 'Aprobada',
    SENT: 'Enviada',
    PAID: 'Pagada',
    CANCELLED: 'Anulada',
};

export const INVOICE_STATE_COLORS: Record<InvoiceState, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    SENT: 'bg-purple-100 text-purple-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

export const TAX_RATES = [
    { value: 0, label: 'Excluido (0%)' },
    { value: 5, label: 'IVA 5%' },
    { value: 19, label: 'IVA 19%' },
];
