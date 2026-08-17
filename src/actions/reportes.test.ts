import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTrialBalance } from './reportes';

// Mock Supabase Server Client module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('Server Action getTrialBalance (reportes.ts)', () => {
  const mockJournalLines = [
    {
      account_code: '11050501',
      debit: 1_500_000,
      credit: 0,
      third_party_id: 'tp-1',
      third_parties: { id: 'tp-1', document_number: '900111222', full_name: 'CLIENTE MOSTRADOR' },
      journal_entry: { id: 'je-1', date: '2026-03-10T10:00:00Z', state: 'APROBADO', entry_type: null },
    },
    {
      account_code: '41350501',
      debit: 0,
      credit: 1_500_000,
      third_party_id: 'tp-1',
      third_parties: { id: 'tp-1', document_number: '900111222', full_name: 'CLIENTE MOSTRADOR' },
      journal_entry: { id: 'je-1', date: '2026-03-10T10:00:00Z', state: 'APROBADO', entry_type: null },
    },
    {
      account_code: '11050501',
      debit: 500_000,
      credit: 0,
      third_party_id: null,
      third_parties: null,
      journal_entry: { id: 'je-2', date: '2026-02-15T10:00:00Z', state: 'APROBADO', entry_type: null },
    },
    {
      account_code: '41350501',
      debit: 0,
      credit: 500_000,
      third_party_id: null,
      third_parties: null,
      journal_entry: { id: 'je-2', date: '2026-02-15T10:00:00Z', state: 'APROBADO', entry_type: null },
    },
  ];

  const mockPucAccounts = [
    { code: '1', name: 'ACTIVO', nature: 'DEBITO', type: 'ACTIVO', level: 1, parent_code: null },
    { code: '11', name: 'EFECTIVO Y EQUIVALENTES DE EFECTIVO', nature: 'DEBITO', type: 'ACTIVO', level: 2, parent_code: '1' },
    { code: '1105', name: 'CAJA', nature: 'DEBITO', type: 'ACTIVO', level: 3, parent_code: '11' },
    { code: '110505', name: 'Caja General', nature: 'DEBITO', type: 'ACTIVO', level: 4, parent_code: '1105' },
    { code: '4', name: 'INGRESOS', nature: 'CREDITO', type: 'INGRESO', level: 1, parent_code: null },
    { code: '41', name: 'OPERACIONALES', nature: 'CREDITO', type: 'INGRESO', level: 2, parent_code: '4' },
    { code: '4135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', nature: 'CREDITO', type: 'INGRESO', level: 3, parent_code: '41' },
    { code: '413505', name: 'Comercio al por mayor y al por menor', nature: 'CREDITO', type: 'INGRESO', level: 4, parent_code: '4135' },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'journal_lines') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: mockJournalLines, error: null }),
              }),
            }),
          };
        }
        if (table === 'puc_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPucAccounts, error: null }),
            }),
          };
        }
        return {};
      }),
    };

    (createClient as any).mockResolvedValue(mockSupabase);
  });

  it('1. getTrialBalance(year, month) returns trial balance array and report totals', async () => {
    const report = await getTrialBalance(2026, 3);

    expect(Array.isArray(report)).toBe(true);
    expect(report.startDate).toBe('2026-03-01');
    expect(report.endDate).toBe('2026-03-31');

    // Caja General (11050501)
    const caja = report.find((item) => item.code === '11050501');
    expect(caja).toBeDefined();
    expect(caja?.saldo_inicial).toBe(500_000); // Feb 15 movement
    expect(caja?.debito).toBe(1_500_000);     // March movement
    expect(caja?.saldo_final).toBe(2_000_000);

    // Ingresos (41350501)
    const ingresos = report.find((item) => item.code === '41350501');
    expect(ingresos).toBeDefined();
    expect(ingresos?.saldo_inicial).toBe(500_000); // Feb 15 YTD movement
    expect(ingresos?.credito).toBe(1_500_000);     // March movement
    expect(ingresos?.saldo_final).toBe(2_000_000);

    // Totals balance double-entry identity
    expect(report.totals.is_balanced).toBe(true);
    expect(report.totals.total_debito).toBe(1_500_000);
    expect(report.totals.total_credito).toBe(1_500_000);
  });

  it('2. getTrialBalance with includeThirdParty = true details leaf rows per third party', async () => {
    const report = await getTrialBalance(2026, 3, { includeThirdParty: true });

    expect(report.includeThirdParty).toBe(true);

    const clientRow = report.find(
      (item) => item.code === '11050501' && item.third_party_id === 'tp-1'
    );
    expect(clientRow).toBeDefined();
    expect(clientRow?.third_party_name).toBe('CLIENTE MOSTRADOR');
    expect(clientRow?.debito).toBe(1_500_000);

    const fallbackRow = report.find(
      (item) => item.code === '11050501' && item.third_party_id === null
    );
    expect(fallbackRow).toBeDefined();
    expect(fallbackRow?.third_party_name).toBe('CUANTIAS MENORES / GENERAL');
    expect(fallbackRow?.saldo_inicial).toBe(500_000);
  });

  it('3. getTrialBalance with ISO date strings (startDate, endDate)', async () => {
    const report = await getTrialBalance('2026-03-01', '2026-03-31', { includeThirdParty: false });

    expect(report.startDate).toBe('2026-03-01');
    expect(report.endDate).toBe('2026-03-31');
    expect(report.totals.is_balanced).toBe(true);
  });
});
