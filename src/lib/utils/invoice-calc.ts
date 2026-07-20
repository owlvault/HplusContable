// Invoice calculation utilities

export interface InvoiceLineInput {
    quantity: number;
    unit_price: number;
    discount_rate: number;
    tax_rate: number;
}

export interface InvoiceTotals {
    subtotal: number;
    discount: number;
    iva_5: number;
    iva_19: number;
    iva_excluded: number;
    total: number;
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
    let subtotal = 0;
    let discount = 0;
    let iva_5 = 0;
    let iva_19 = 0;
    let iva_excluded = 0;

    for (const line of lines) {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * (line.discount_rate / 100);
        const taxableAmount = lineSubtotal - lineDiscount;
        
        subtotal += lineSubtotal;
        discount += lineDiscount;

        if (line.tax_rate === 5) {
            iva_5 += taxableAmount * 0.05;
        } else if (line.tax_rate === 19) {
            iva_19 += taxableAmount * 0.19;
        } else {
            iva_excluded += taxableAmount;
        }
    }

    const total = subtotal - discount + iva_5 + iva_19;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        iva_5: Math.round(iva_5 * 100) / 100,
        iva_19: Math.round(iva_19 * 100) / 100,
        iva_excluded: Math.round(iva_excluded * 100) / 100,
        total: Math.round(total * 100) / 100,
    };
}
