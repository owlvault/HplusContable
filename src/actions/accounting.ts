'use server';

import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type JournalLineInput = {
    account_code: string;
    third_party_id: string | null;
    debit: number;
    credit: number;
    description?: string;
};

export async function createJournalEntry(
    date: Date,
    description: string,
    lines: JournalLineInput[],
    isApproved: boolean = false
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // 1. Double Entry Validation
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (isApproved && Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Partida Doble invalida: Debito ${totalDebit} vs Credito ${totalCredit}`);
    }

    // 2. Call RPC
    const { data, error } = await supabase.rpc('create_journal_entry', {
        p_date: date.toISOString(),
        p_description: description,
        p_created_by: user.id,
        p_lines: lines as unknown as any // Supabase casting issue with complex JSONB
    });

    if (error) {
        console.error('Error creating entry:', error);
        throw new Error('Failed to create journal entry');
    }

    // 3. Update status if approved
    if (isApproved && data) {
        await supabase.from('journal_entries').update({ state: 'APROBADO' }).eq('id', data);
    }

    return { success: true, entryId: data };
}
