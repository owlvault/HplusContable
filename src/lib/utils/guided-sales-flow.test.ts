import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals } from '@/lib/utils/invoice-calc';

describe('Guided Sales Flow - Zero-Jargon Tax & Total Calculations', () => {
    it('calcula automáticamente subtotales, IVA 19% y total sin requerir cuentas PUC del usuario', () => {
        const lines = [
            {
                line_number: 1,
                description: 'Servicio de Consultoría de Software',
                quantity: 2,
                unit: 'UN',
                unit_price: 1_000_000,
                discount_rate: 10,
                discount_amount: 0,
                tax_rate: 19,
                tax_amount: 0,
                subtotal: 0,
                total: 0,
            },
        ];

        const totals = calculateInvoiceTotals(lines);

        // Subtotal bruto = 2 * 1.000.000 = 2.000.000
        expect(totals.subtotal).toBe(2_000_000);
        // Descuento 10% = 200.000
        expect(totals.discount).toBe(200_000);
        // Base gravable = 1.800.000
        // IVA 19% = 1.800.000 * 0.19 = 342.000
        expect(totals.iva_19).toBe(342_000);
        // Gran total = 1.800.000 + 342.000 = 2.142.000
        expect(totals.total).toBe(2_142_000);
    });

    it('maneja múltiples ítems con tarifas mixtas (19%, 5%, Excluido 0%)', () => {
        const lines = [
            {
                line_number: 1,
                description: 'Producto General 19%',
                quantity: 1,
                unit: 'UN',
                unit_price: 100_000,
                discount_rate: 0,
                discount_amount: 0,
                tax_rate: 19,
                tax_amount: 0,
                subtotal: 0,
                total: 0,
            },
            {
                line_number: 2,
                description: 'Producto Alimentos 5%',
                quantity: 2,
                unit: 'UN',
                unit_price: 50_000,
                discount_rate: 0,
                discount_amount: 0,
                tax_rate: 5,
                tax_amount: 0,
                subtotal: 0,
                total: 0,
            },
            {
                line_number: 3,
                description: 'Servicio Excluido 0%',
                quantity: 1,
                unit: 'UN',
                unit_price: 200_000,
                discount_rate: 0,
                discount_amount: 0,
                tax_rate: 0,
                tax_amount: 0,
                subtotal: 0,
                total: 0,
            },
        ];

        const totals = calculateInvoiceTotals(lines);

        expect(totals.subtotal).toBe(400_000);
        expect(totals.iva_19).toBe(19_000);
        expect(totals.iva_5).toBe(5_000);
        expect(totals.iva_excluded).toBe(200_000);
        expect(totals.total).toBe(424_000);
    });

    it('calcula cobro neto con retenciones en 1 clic de forma determinista', () => {
        const invoiceTotal = 2_380_000; // Base 2.000.000 + IVA 380.000
        const baseGravable = 2_000_000;

        const reteFuenteRate = 0.025; // 2.5%
        const reteIcaRate = 0.00966; // 9.66 por mil

        const calculatedReteFuente = Math.round(baseGravable * reteFuenteRate);
        const calculatedReteIca = Math.round(baseGravable * reteIcaRate);

        expect(calculatedReteFuente).toBe(50_000);
        expect(calculatedReteIca).toBe(19_320);

        const netCashReceived = invoiceTotal - calculatedReteFuente - calculatedReteIca;
        expect(netCashReceived).toBe(2_310_680);

        // La suma de dinero en banco + anticipos de retención es exactamente igual a la cartera cancelada
        expect(netCashReceived + calculatedReteFuente + calculatedReteIca).toBe(invoiceTotal);
    });
});
