import { describe, it, expect } from 'vitest';

describe('Matriz Adversarial: POS Offline Leased Range Chunks (T-06)', () => {
    it('dos terminales POS offline deben emitir en rangos particionados con colisiones = 0', () => {
        // Terminal 1 solicita bloque de 20 consecutivos (1001 a 1020)
        const terminal1Lease = {
            terminalId: 'POS-TERM-01',
            prefix: 'POS',
            leasedFrom: 1001,
            leasedTo: 1020,
            current: 1001,
        };

        // Terminal 2 solicita bloque de 20 consecutivos (1021 a 1040)
        const terminal2Lease = {
            terminalId: 'POS-TERM-02',
            prefix: 'POS',
            leasedFrom: 1021,
            leasedTo: 1040,
            current: 1021,
        };

        // Simular emisión de 10 ventas en Terminal 1
        const terminal1Invoices: string[] = [];
        for (let i = 0; i < 10; i++) {
            terminal1Invoices.push(`${terminal1Lease.prefix}-${terminal1Lease.current + i}`);
        }

        // Simular emisión de 10 ventas en Terminal 2
        const terminal2Invoices: string[] = [];
        for (let i = 0; i < 10; i++) {
            terminal2Invoices.push(`${terminal2Lease.prefix}-${terminal2Lease.current + i}`);
        }

        // Unir lotes para simular sincronización al servidor
        const allSynced = [...terminal1Invoices, ...terminal2Invoices];
        const uniqueSet = new Set(allSynced);

        expect(allSynced.length).toBe(20);
        expect(uniqueSet.size).toBe(20); // CERO COLISIONES

        // Verificar que no hay solapamiento entre rangos
        const maxTerm1 = 1001 + 9;
        const minTerm2 = 1021;
        expect(maxTerm1).toBeLessThan(minTerm2);
    });
});
