import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ParsedJournalEntry, IngestionOptions, IngestionResult } from './types';

function inferPucAccountDetails(code: string, name?: string) {
  const level = code.length <= 1 ? 1 : code.length <= 2 ? 2 : code.length <= 4 ? 3 : code.length <= 6 ? 4 : 5;
  const firstChar = code.charAt(0);

  let type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO_VENTAS' | 'COSTO_PRODUCCION' | 'CUENTAS_ORDEN' = 'ACTIVO';
  let nature: 'DEBITO' | 'CREDITO' = 'DEBITO';

  switch (firstChar) {
    case '1':
      type = 'ACTIVO';
      nature = 'DEBITO';
      break;
    case '2':
      type = 'PASIVO';
      nature = 'CREDITO';
      break;
    case '3':
      type = 'PATRIMONIO';
      nature = 'CREDITO';
      break;
    case '4':
      type = 'INGRESO';
      nature = 'CREDITO';
      break;
    case '5':
      type = 'GASTO';
      nature = 'DEBITO';
      break;
    case '6':
      type = 'COSTO_VENTAS';
      nature = 'DEBITO';
      break;
    case '7':
      type = 'COSTO_PRODUCCION';
      nature = 'DEBITO';
      break;
    case '8':
    case '9':
      type = 'CUENTAS_ORDEN';
      nature = 'DEBITO';
      break;
  }

  let parent_code: string | null = null;
  if (code.length > 1) {
    if (code.length > 6) parent_code = code.substring(0, 6);
    else if (code.length > 4) parent_code = code.substring(0, 4);
    else if (code.length > 2) parent_code = code.substring(0, 2);
    else parent_code = code.substring(0, 1);
  }

  return {
    code,
    name: name || `Cuenta Auxiliar ${code}`,
    type,
    nature,
    level,
    parent_code,
    is_active: true,
  };
}

function inferThirdPartyDocType(docNumber: string): 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI' {
  if (docNumber === '0') return 'NIT';
  if (docNumber.length >= 9 || docNumber.includes('-')) return 'NIT';
  return 'CC';
}

/**
 * Loads parsed journal entries into Supabase database.
 * Auto-upserts third parties, verifies/upserts PUC accounts, and batch inserts header and detail rows.
 */
export async function loadJournalEntries(
  entries: ParsedJournalEntry[],
  options?: IngestionOptions
): Promise<IngestionResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize || 500;
  const autoCreateThirdParties = options?.autoCreateThirdParties ?? true;
  const autoCreatePucAccounts = options?.autoCreatePucAccounts ?? true;
  const defaultState = options?.defaultState || 'APROBADO';

  const result: IngestionResult = {
    success: true,
    totalEntriesProcessed: entries.length,
    totalLinesProcessed: 0,
    entriesInserted: 0,
    linesInserted: 0,
    thirdPartiesCreated: 0,
    accountsCreated: 0,
    errors: [],
    warnings: [],
    executionTimeMs: 0,
  };

  let client = options?.client;
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      client = createSupabaseClient(supabaseUrl, supabaseKey);
    }
  }

  if (!client) {
    // If no client provided and no env variables, simulate validation check or throw
    result.success = false;
    result.errors.push({ message: 'Supabase client instance or environment variables not available.' });
    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  try {
    // 1. Extract unique third parties
    const thirdPartyMap = new Map<string, { docType: 'CC' | 'NIT' | 'CE' | 'PASAPORTE' | 'TI'; name: string }>();
    const pucAccountMap = new Map<string, string>(); // code -> name

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      result.totalLinesProcessed += entry.lines.length;

      // Validate double entry balance
      if (!entry.is_balanced) {
        result.warnings.push(
          `Entry ${i} (${entry.voucher_type}-${entry.voucher_number}) is unbalanced: Debits=${entry.total_debit}, Credits=${entry.total_credit}`
        );
      }

      for (const line of entry.lines) {
        const doc = line.third_party_doc || '0';
        const name = line.third_party_name || 'CUANTIAS MENORES / GENERAL';
        if (!thirdPartyMap.has(doc)) {
          thirdPartyMap.set(doc, {
            docType: inferThirdPartyDocType(doc),
            name,
          });
        }

        if (line.account_code && !pucAccountMap.has(line.account_code)) {
          pucAccountMap.set(line.account_code, line.account_name || `Cuenta Auxiliar ${line.account_code}`);
        }
      }
    }

    // 2. Resolve Third Party UUIDs
    const thirdPartyDocToIdMap = new Map<string, string>();
    const docNumbers = Array.from(thirdPartyMap.keys());

    if (docNumbers.length > 0) {
      const { data: existingThirdParties, error: tpError } = await client
        .from('third_parties')
        .select('id, document_number')
        .in('document_number', docNumbers);

      if (!tpError && existingThirdParties) {
        for (const tp of existingThirdParties) {
          thirdPartyDocToIdMap.set(tp.document_number, tp.id);
        }
      }

      const missingThirdPartyDocs = docNumbers.filter((doc) => !thirdPartyDocToIdMap.has(doc));

      if (missingThirdPartyDocs.length > 0 && autoCreateThirdParties) {
        const thirdPartiesToInsert = missingThirdPartyDocs.map((doc) => {
          const info = thirdPartyMap.get(doc)!;
          const id = crypto.randomUUID();
          thirdPartyDocToIdMap.set(doc, id);
          return {
            id,
            document_type: info.docType,
            document_number: doc,
            full_name: info.name
            // Omitted tax_regime and is_active to avoid PostgREST schema cache issues 
            // since they are added in a later migration with defaults.
          };
        });

        const { error: insertTpErr } = await client
          .from('third_parties')
          .upsert(thirdPartiesToInsert, { onConflict: 'document_type,document_number' });

        if (insertTpErr) {
          result.warnings.push(`Warning auto-creating third parties: ${insertTpErr.message}`);
        } else {
          result.thirdPartiesCreated = thirdPartiesToInsert.length;
        }
      }
    }

    // 3. Resolve PUC Accounts
    let accountCodes = Array.from(pucAccountMap.keys());
    
    // Auto-discover parent codes recursively to ensure no foreign-key errors on self-referencing puc_accounts table
    const allAccountCodes = new Set(accountCodes);
    for (const code of accountCodes) {
      let currentCode = code;
      while (currentCode.length > 1) {
        let parentCode = '';
        if (currentCode.length > 6) parentCode = currentCode.substring(0, 6);
        else if (currentCode.length > 4) parentCode = currentCode.substring(0, 4);
        else if (currentCode.length > 2) parentCode = currentCode.substring(0, 2);
        else parentCode = currentCode.substring(0, 1);
        
        if (parentCode) {
          allAccountCodes.add(parentCode);
          currentCode = parentCode;
        } else {
          break;
        }
      }
    }
    accountCodes = Array.from(allAccountCodes);

    if (accountCodes.length > 0) {
      const { data: existingAccounts, error: accError } = await client
        .from('puc_accounts')
        .select('code')
        .in('code', accountCodes);

      const existingCodeSet = new Set<string>();
      if (!accError && existingAccounts) {
        for (const acc of existingAccounts) {
          existingCodeSet.add(acc.code);
        }
      }

      // Sort by length so parents (shorter codes) are inserted first
      const missingAccountCodes = accountCodes
        .filter((code) => !existingCodeSet.has(code))
        .sort((a, b) => a.length - b.length);

      if (missingAccountCodes.length > 0 && autoCreatePucAccounts) {
        const accountsToInsert = missingAccountCodes.map((code) => {
          const name = pucAccountMap.get(code) || `Clase/Grupo/Cuenta ${code}`;
          return inferPucAccountDetails(code, name);
        });

        const { error: insertAccErr } = await client
          .from('puc_accounts')
          .upsert(accountsToInsert, { onConflict: 'code' });

        if (insertAccErr) {
          result.warnings.push(`Warning auto-creating PUC accounts: ${insertAccErr.message}`);
        } else {
          result.accountsCreated = accountsToInsert.length;
        }
      }
    }

    // 4. Batch Insert Headers and Lines
    for (let i = 0; i < entries.length; i += batchSize) {
      const chunk = entries.slice(i, i + batchSize);
      const headersToInsert: any[] = [];
      const linesToInsert: any[] = [];

      for (const entry of chunk) {
        const entryId = crypto.randomUUID();

        headersToInsert.push({
          id: entryId,
          date: entry.date,
          description: entry.description,
          state: defaultState,
        });

        for (const line of entry.lines) {
          const thirdPartyId = thirdPartyDocToIdMap.get(line.third_party_doc || '0') || null;

          linesToInsert.push({
            id: crypto.randomUUID(),
            entry_id: entryId,
            account_code: line.account_code,
            third_party_id: thirdPartyId,
            debit: line.debit,
            credit: line.credit,
            description: line.description || entry.description,
          });
        }
      }

      // Insert headers
      const { error: headerErr } = await client.from('journal_entries').insert(headersToInsert);
      if (headerErr) {
        result.success = false;
        result.errors.push({ message: `Batch insert journal_entries error: ${headerErr.message}` });
        break;
      }
      result.entriesInserted += headersToInsert.length;

      // Insert lines
      const { error: lineErr } = await client.from('journal_lines').insert(linesToInsert);
      if (lineErr) {
        result.success = false;
        result.errors.push({ message: `Batch insert journal_lines error: ${lineErr.message}` });
        break;
      }
      result.linesInserted += linesToInsert.length;
    }
  } catch (err: any) {
    result.success = false;
    result.errors.push({ message: `Unexpected error during db load: ${err?.message || err}` });
  }

  result.executionTimeMs = Date.now() - startTime;
  return result;
}
