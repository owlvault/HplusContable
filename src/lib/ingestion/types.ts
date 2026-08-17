export interface ParsedJournalLine {
  account_code: string;
  account_name?: string;
  third_party_doc?: string | null;
  third_party_name?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface ParsedJournalEntry {
  date: string; // ISO 8601 string (YYYY-MM-DD or full timestamp)
  voucher_type?: string;
  voucher_number?: string | number;
  description: string;
  lines: ParsedJournalLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface IngestionOptions {
  batchSize?: number;
  autoCreateThirdParties?: boolean;
  autoCreatePucAccounts?: boolean;
  toleranceCOP?: number;
  defaultState?: 'BORRADOR' | 'APROBADO' | 'ANULADO';
  client?: any;
}

export interface IngestionResult {
  success: boolean;
  totalEntriesProcessed: number;
  totalLinesProcessed: number;
  entriesInserted: number;
  linesInserted: number;
  thirdPartiesCreated: number;
  accountsCreated: number;
  errors: Array<{ entryIndex?: number; voucherRef?: string; message: string }>;
  warnings: string[];
  executionTimeMs: number;
}
