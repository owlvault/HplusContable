'use server';

import { createClient } from '@/lib/supabase/server';

type Anomaly = {
    type: 'warning' | 'error' | 'info';
    title: string;
    description: string;
    suggestion?: string;
};

export async function detectAnomalies(): Promise<Anomaly[]> {
    const supabase = await createClient();
    const anomalies: Anomaly[] = [];

    // 1. Check for unbalanced entries (draft)
    const { data: draftEntries } = await supabase
        .from('journal_entries')
        .select('id, description, state')
        .eq('state', 'BORRADOR');

    if (draftEntries && draftEntries.length > 0) {
        for (const entry of draftEntries) {
            const { data: lines } = await supabase
                .from('journal_lines')
                .select('debit, credit')
                .eq('entry_id', entry.id);

            if (lines) {
                const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
                const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

                if (Math.abs(totalDebit - totalCredit) > 0.01) {
                    anomalies.push({
                        type: 'error',
                        title: 'Asiento Descuadrado',
                        description: `El asiento "${entry.description}" tiene una diferencia de $${Math.abs(totalDebit - totalCredit).toFixed(2)}`,
                        suggestion: 'Revisa las partidas y corrige antes de aprobar'
                    });
                }
            }
        }

        if (draftEntries.length > 5) {
            anomalies.push({
                type: 'warning',
                title: 'Muchos Borradores Pendientes',
                description: `Tienes ${draftEntries.length} asientos en borrador sin aprobar`,
                suggestion: 'Revisa y aprueba los asientos pendientes para mantener la contabilidad al día'
            });
        }
    }

    // 2. Check for accounts with unusual activity
    const { data: lines } = await supabase
        .from('journal_lines')
        .select(`
            debit, credit, account_code,
            puc_accounts (name, nature),
            journal_entries!inner (date)
        `)
        .gte('journal_entries.date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (lines) {
        // Group by account
        const accountTotals: Record<string, { debit: number; credit: number; name: string; nature: string }> = {};
        
        lines.forEach((line: any) => {
            const code = line.account_code;
            if (!accountTotals[code]) {
                accountTotals[code] = {
                    debit: 0,
                    credit: 0,
                    name: line.puc_accounts?.name || '',
                    nature: line.puc_accounts?.nature || ''
                };
            }
            accountTotals[code].debit += Number(line.debit);
            accountTotals[code].credit += Number(line.credit);
        });

        // Check for accounts with movements against their nature
        Object.entries(accountTotals).forEach(([code, acc]) => {
            if (acc.nature === 'DEBITO' && acc.credit > acc.debit * 2) {
                anomalies.push({
                    type: 'warning',
                    title: 'Movimiento Inusual',
                    description: `La cuenta ${code} - ${acc.name} (naturaleza Débito) tiene más créditos que débitos`,
                    suggestion: 'Verifica que los movimientos sean correctos'
                });
            }
            if (acc.nature === 'CREDITO' && acc.debit > acc.credit * 2) {
                anomalies.push({
                    type: 'warning',
                    title: 'Movimiento Inusual',
                    description: `La cuenta ${code} - ${acc.name} (naturaleza Crédito) tiene más débitos que créditos`,
                    suggestion: 'Verifica que los movimientos sean correctos'
                });
            }
        });
    }

    // 3. Check for third parties without activity
    const { data: parties } = await supabase
        .from('third_parties')
        .select('id, full_name')
        .is('updated_at', null);

    // 4. Positive feedback if everything is good
    if (anomalies.length === 0) {
        anomalies.push({
            type: 'info',
            title: '¡Todo en Orden!',
            description: 'No se detectaron anomalías en tu contabilidad',
            suggestion: 'Continúa con el buen trabajo'
        });
    }

    return anomalies;
}
