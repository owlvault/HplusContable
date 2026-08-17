import { describe, it, expect, vi } from 'vitest';
import { loadJournalEntries } from './db-loader';
import { ParsedJournalEntry } from './types';

describe('DB Loader Unit Tests (loadJournalEntries)', () => {
  it('processes parsed journal entries and loads into database mock client', async () => {
    const mockEntries: ParsedJournalEntry[] = [
      {
        date: '2024-02-01',
        voucher_type: 'CI',
        voucher_number: '201',
        description: 'Venta contado',
        lines: [
          {
            account_code: '11050501',
            account_name: 'Caja General',
            third_party_doc: '123456789',
            third_party_name: 'CLIENTE TEST',
            debit: 200000,
            credit: 0,
          },
          {
            account_code: '41350501',
            account_name: 'Comercio',
            third_party_doc: '123456789',
            third_party_name: 'CLIENTE TEST',
            debit: 0,
            credit: 200000,
          },
        ],
        total_debit: 200000,
        total_credit: 200000,
        is_balanced: true,
      },
    ];

    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];
    const upsertedThirdParties: any[] = [];
    const upsertedPucAccounts: any[] = [];

    let tpUpsertOptions: any = null;

    // Mock Supabase Client
    const mockClient: any = {
      from: (table: string) => {
        if (table === 'third_parties') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: vi.fn().mockImplementation((data: any, options: any) => {
              tpUpsertOptions = options;
              upsertedThirdParties.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === 'puc_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: vi.fn().mockImplementation((data: any) => {
              upsertedPucAccounts.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === 'journal_entries') {
          return {
            insert: vi.fn().mockImplementation((data: any) => {
              insertedHeaders.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        if (table === 'journal_lines') {
          return {
            insert: vi.fn().mockImplementation((data: any) => {
              insertedLines.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }
        return {};
      },
    };

    const result = await loadJournalEntries(mockEntries, {
      client: mockClient,
      autoCreateThirdParties: true,
      autoCreatePucAccounts: true,
    });

    expect(result.success).toBe(true);
    expect(result.totalEntriesProcessed).toBe(1);
    expect(result.totalLinesProcessed).toBe(2);
    expect(result.entriesInserted).toBe(1);
    expect(result.linesInserted).toBe(2);
    expect(result.thirdPartiesCreated).toBe(1);
    expect(result.accountsCreated).toBe(10);

    expect(insertedHeaders).toHaveLength(1);
    expect(insertedHeaders[0].date).toBe('2024-02-01');
    expect(insertedHeaders[0].state).toBe('APROBADO');

    expect(insertedLines).toHaveLength(2);
    expect(insertedLines[0].entry_id).toBe(insertedHeaders[0].id);
    expect(insertedLines[0].account_code).toBe('11050501');
    expect(insertedLines[0].debit).toBe(200000);

    expect(tpUpsertOptions).not.toBeNull();
    expect(tpUpsertOptions.onConflict).toBe('document_type,document_number');
  });
});
