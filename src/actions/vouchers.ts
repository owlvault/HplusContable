'use server';

import { createClient } from '@/lib/supabase/server';

export type VoucherType = 'INGRESO' | 'EGRESO' | 'COMPRA' | 'VENTA' | 'NOTA_CONTABLE';

export async function getVouchers(type?: VoucherType) {
    const supabase = await createClient();
    let query = supabase
        .from('vouchers')
        .select(`
            *,
            third_parties (full_name, document_number)
        `)
        .order('created_at', { ascending: false });

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

export async function createVoucher(
    type: VoucherType,
    date: Date,
    thirdPartyId: string | null,
    description: string,
    lines: {
        description: string;
        quantity: number;
        unit_price: number;
        iva_rate: number;
        retention_rate: number;
        account_code?: string;
    }[]
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    // Calculate totals
    let subtotal = 0;
    let iva = 0;
    let retention = 0;

    const processedLines = lines.map(line => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineIva = lineSubtotal * (line.iva_rate / 100);
        const lineRetention = lineSubtotal * (line.retention_rate / 100);

        subtotal += lineSubtotal;
        iva += lineIva;
        retention += lineRetention;

        return {
            ...line,
            subtotal: lineSubtotal
        };
    });

    const total = subtotal + iva - retention;

    // Create voucher
    const { data: voucher, error: voucherError } = await supabase
        .from('vouchers')
        .insert({
            type,
            date: date.toISOString(),
            third_party_id: thirdPartyId,
            description,
            subtotal,
            iva,
            retention,
            total,
            created_by: user.id
        })
        .select()
        .single();

    if (voucherError) throw new Error(voucherError.message);

    // Create voucher lines
    const { error: linesError } = await supabase
        .from('voucher_lines')
        .insert(processedLines.map(line => ({
            voucher_id: voucher.id,
            ...line
        })));

    if (linesError) throw new Error(linesError.message);

    return voucher;
}

export async function getTaxRates() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('is_active', true)
        .order('type', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}
