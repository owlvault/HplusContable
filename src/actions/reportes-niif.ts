'use server';

import { createClient } from '@/lib/supabase/server';
import { enforcePermission } from '@/lib/rbac';

type EntryWithLines = {
    id: string;
    lines: { account_code: string; debit: number; credit: number }[];
};

async function getApprovedEntriesWithLines(from: Date, to: Date): Promise<EntryWithLines[]> {
    const supabase = await createClient();
    const { data: entries } = await supabase
        .from('journal_entries')
        .select('id, journal_lines(account_code, debit, credit)')
        .eq('state', 'APROBADO')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());
    return (entries || []).map((e: any) => ({
        id: e.id,
        lines: (e.journal_lines || []).map((l: any) => ({
            account_code: l.account_code,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
        })),
    }));
}

export interface CashFlowStatement {
    year: number;
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
    detail: { category: string; amount: number }[];
}

/**
 * Estado de flujo de efectivo — método directo.
 * Clasifica la variación de las cuentas de efectivo (clase 11) según la
 * naturaleza de la contrapartida de cada asiento:
 *   - Operación: ingresos/gastos/costos, cartera y proveedores (4,5,6,7,13,22).
 *   - Inversión: propiedad planta y equipo e inversiones (12,15,16,18,19).
 *   - Financiación: obligaciones financieras y patrimonio (21,3).
 */
export async function getCashFlowStatement(year: number): Promise<CashFlowStatement> {
    await enforcePermission('reportes', 'read');
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);
    const entries = await getApprovedEntriesWithLines(from, to);

    let operating = 0, investing = 0, financing = 0;

    for (const entry of entries) {
        const cashDelta = entry.lines
            .filter((l) => l.account_code.startsWith('11'))
            .reduce((s, l) => s + l.debit - l.credit, 0);
        if (Math.abs(cashDelta) < 0.01) continue;

        // Clasificar por la contrapartida no-efectivo dominante
        const counter = entry.lines.filter((l) => !l.account_code.startsWith('11'));
        const categoryFor = (code: string): 'op' | 'inv' | 'fin' => {
            const c2 = code.slice(0, 2);
            if (['15', '12', '16', '18', '19'].includes(c2)) return 'inv';
            if (['21'].includes(c2) || code.startsWith('3')) return 'fin';
            return 'op';
        };
        // Peso por monto absoluto de cada contrapartida
        const weights: Record<'op' | 'inv' | 'fin', number> = { op: 0, inv: 0, fin: 0 };
        for (const l of counter) {
            weights[categoryFor(l.account_code)] += Math.abs(l.debit - l.credit);
        }
        const dominant = (Object.keys(weights) as Array<'op' | 'inv' | 'fin'>)
            .sort((a, b) => weights[b] - weights[a])[0] || 'op';

        if (dominant === 'op') operating += cashDelta;
        else if (dominant === 'inv') investing += cashDelta;
        else financing += cashDelta;
    }

    const netChange = Math.round(operating + investing + financing);
    return {
        year,
        operating: Math.round(operating),
        investing: Math.round(investing),
        financing: Math.round(financing),
        netChange,
        detail: [
            { category: 'Actividades de operación', amount: Math.round(operating) },
            { category: 'Actividades de inversión', amount: Math.round(investing) },
            { category: 'Actividades de financiación', amount: Math.round(financing) },
        ],
    };
}

export interface EquityChange {
    account_code: string;
    movement: number; // variación del período (crédito - débito, patrimonio es crédito)
}

export interface StatementOfChangesInEquity {
    year: number;
    items: EquityChange[];
    totalMovement: number;
}

/**
 * Estado de cambios en el patrimonio — variación de las cuentas clase 3
 * durante el período (aportes, resultados, reservas, etc.).
 */
export async function getStatementOfChangesInEquity(year: number): Promise<StatementOfChangesInEquity> {
    await enforcePermission('reportes', 'read');
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31, 23, 59, 59);
    const entries = await getApprovedEntriesWithLines(from, to);

    const byAccount = new Map<string, number>();
    for (const entry of entries) {
        for (const l of entry.lines) {
            if (!l.account_code.startsWith('3')) continue;
            const prev = byAccount.get(l.account_code) || 0;
            byAccount.set(l.account_code, prev + (l.credit - l.debit)); // patrimonio: crédito aumenta
        }
    }

    const items: EquityChange[] = [...byAccount.entries()]
        .map(([account_code, movement]) => ({ account_code, movement: Math.round(movement) }))
        .filter((i) => Math.abs(i.movement) > 0.01)
        .sort((a, b) => a.account_code.localeCompare(b.account_code));

    return {
        year,
        items,
        totalMovement: items.reduce((s, i) => s + i.movement, 0),
    };
}
