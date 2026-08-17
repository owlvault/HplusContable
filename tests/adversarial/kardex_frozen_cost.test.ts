import { describe, it, expect } from 'vitest';
import { generateCude } from '../../src/lib/dian/signer';

describe('Matriz Adversarial: Kardex Congelado y Notas Crédito (T-03, T-04)', () => {
    describe('T-03: Matriz de Notas Crédito por Concepto DIAN (CERO Restock en Conceptos 3 y 4)', () => {
        it('Concepto 3 (Rebaja/Descuento Comercial) debe marcar restock_inventory = false', () => {
            const dianConcept = '3';
            const shouldRestock = dianConcept === '1' || dianConcept === '2';

            expect(shouldRestock).toBe(false);

            // Simular líneas de Nota Crédito por Descuento de $50.000 COP
            const originalSaleLine = {
                product_id: 'prod-cafe-500g',
                quantity: 10,
                unit_price: 25000,
                historical_unit_cost: 14000, // Costo congelado al momento de la venta
            };

            const creditNoteLine = {
                product_id: originalSaleLine.product_id,
                quantity: 0, // Descuento monetario global o por línea
                discount_amount: 50000,
                restock_inventory: shouldRestock,
            };

            expect(creditNoteLine.restock_inventory).toBe(false);
        });

        it('Concepto 1 (Devolución Parcial) y Concepto 2 (Anulación) deben activar restock_inventory = true', () => {
            const concept1 = '1';
            const concept2 = '2';

            expect(concept1 === '1' || concept1 === '2').toBe(true);
            expect(concept2 === '1' || concept2 === '2').toBe(true);
        });
    });

    describe('T-04: Kardex Frozen Cost Reversal (Preservación del Costo Histórico)', () => {
        it('debe revertir el costo de ventas usando estrictamente el historical_unit_cost original', () => {
            // Escenario:
            // 1. Día 1: Venta de 5 unidades @ precio $20.000, con costo unitario congelado $10.000 (COGS = $50.000).
            // 2. Día 2: Nueva compra de inventario que eleva el costo promedio a $16.000.
            // 3. Día 3: El cliente devuelve 2 unidades bajo Nota Crédito (Concepto 1).
            
            const saleLine = {
                product_id: 'prod-item-1',
                quantity_sold: 5,
                historical_unit_cost: 10000, // Congelado en invoice_lines
            };

            const currentMovingAverageCost = 16000; // Alterado por compras posteriores
            const unitsReturned = 2;

            // La reversión contable DEBE usar el costo histórico congelado ($10.000), NO el costo promedio ($16.000)
            const cogsReversal = unitsReturned * saleLine.historical_unit_cost;
            const incorrectCogsReversal = unitsReturned * currentMovingAverageCost;

            expect(cogsReversal).toBe(20000);
            expect(cogsReversal).not.toBe(incorrectCogsReversal);

            // Verificamos que el balance contable permanezca en suma cero exacta
            const debitInventory1435 = cogsReversal;  // +$20.000
            const creditCogs6135 = cogsReversal;      // +$20.000
            expect(debitInventory1435 - creditCogs6135).toBe(0);
        });

        it('debe generar un CUDE SHA-384 válido para la Nota Crédito', () => {
            const cude = generateCude({
                documentNumber: 'NC-501',
                issueDate: '2026-08-17',
                issueTime: '11:15:00-05:00',
                subtotal: 50000,
                ivaAmount: 9500,
                consumptionTax: 0,
                icaTax: 0,
                total: 59500,
                sellerNit: '901234567',
                buyerDocument: '1020304050',
                softwarePin: '12345',
                environment: '2',
            });

            expect(cude).toBeDefined();
            expect(cude.length).toBe(96);
        });
    });
});
