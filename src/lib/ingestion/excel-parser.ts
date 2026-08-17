import * as XLSX from 'xlsx';
import { withReadOnlyGuard } from './readonly-guard';
import { ParsedJournalEntry, ParsedJournalLine, IngestionOptions } from './types';

function getCellValueString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue instanceof Date) return cellValue.toISOString();
    if (cellValue.result !== undefined && cellValue.result !== null) return getCellValueString(cellValue.result);
    if (cellValue.text !== undefined) return cellValue.text.toString();
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((rt: any) => rt.text || '').join('');
    }
  }
  return String(cellValue).trim();
}

function parseExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const yyyy = val.getUTCFullYear();
    const mm = String(val.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(val.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof val === 'number') {
    // Excel epoch conversion (serial number)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return str;
}

function parseNumericCell(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  let str = getCellValueString(val);
  if (!str) return 0;

  // Clean currency symbols, non-breaking spaces (\u00A0), and surrounding spaces
  str = str.replace(/[$]/g, '').replace(/\u00A0/g, ' ').trim();
  if (!str) return 0;

  // Detect negative format in parentheses e.g. "(1,500.00)" or "($ 1.500.000)"
  let isNegative = false;
  if (str.includes('(') && str.includes(')')) {
    isNegative = true;
    str = str.replace(/[()]/g, '').trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1).trim();
  }

  // Remove internal spaces
  str = str.replace(/\s+/g, '');
  if (!str) return 0;

  // Count dots and commas
  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  if (dotCount > 1) {
    // e.g. "1.500.000" or "1.500.000,50"
    str = str.replace(/\./g, '');
    if (commaCount > 0) {
      str = str.replace(',', '.');
    }
  } else if (commaCount > 1) {
    // e.g. "1,500,000" or "1,500,000.50"
    str = str.replace(/,/g, '');
  } else if (dotCount === 1 && commaCount === 1) {
    // Determine decimal character based on last separator
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.500,50 format (dot is thousand, comma is decimal)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,500.50 format (comma is thousand, dot is decimal)
      str = str.replace(/,/g, '');
    }
  } else if (dotCount === 1 && commaCount === 0) {
    // Single dot, no comma: e.g. "1.500" or "25.000"
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  } else if (commaCount === 1 && dotCount === 0) {
    // Single comma, no dot: e.g. "1500,50" -> "1500.50" or "1,500" if 3 digits after comma
    if (/^\d{1,3}(,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (isNegative) num = -num;

  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function normalizeHeaderString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

interface ColumnMapping {
  fecha: number;
  comprobante: number;
  numero: number;
  codigoCuenta: number;
  nombreCuenta: number;
  identificacion: number;
  tercero: number;
  concepto: number;
  debito: number;
  credito: number;
}

function detectHeaderRow(rows: any[][]): { headerRowNumber: number; mapping: ColumnMapping } | null {
  const maxRowsToScan = Math.min(30, rows.length);

  for (let r = 0; r < maxRowsToScan; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let fechaIdx = -1;
    let comprobanteIdx = -1;
    let numeroIdx = -1;
    let codigoCuentaIdx = -1;
    let nombreCuentaIdx = -1;
    let identificacionIdx = -1;
    let terceroIdx = -1;
    let conceptoIdx = -1;
    let debitoIdx = -1;
    let creditoIdx = -1;

    for (let colNumber = 0; colNumber < row.length; colNumber++) {
      const val = normalizeHeaderString(getCellValueString(row[colNumber]));
      if (!val) continue;

      if (val === 'fecha' || val.includes('fecha')) {
        if (fechaIdx === -1) fechaIdx = colNumber;
      } else if (val.includes('comprobante') || val.includes('cbte') || val === 'tipo' || val.includes('tipo doc')) {
        if (comprobanteIdx === -1) comprobanteIdx = colNumber;
      } else if (
        val.includes('identificacion') ||
        val.includes('nit') ||
        val.includes('documento') ||
        val.includes('cedula') ||
        val.includes('nro identificacion')
      ) {
        if (identificacionIdx === -1) identificacionIdx = colNumber;
      } else if (val.includes('numero') || val.includes('num') || val.includes('consecutivo')) {
        if (numeroIdx === -1) numeroIdx = colNumber;
      } else if (val.includes('codigo') || val.includes('cod. cuenta') || (val.includes('cuenta') && !val.includes('nombre'))) {
        if (codigoCuentaIdx === -1) codigoCuentaIdx = colNumber;
      } else if (val.includes('nombre cuenta') || val.includes('descripcion cuenta') || val.includes('nom cuenta')) {
        if (nombreCuentaIdx === -1) nombreCuentaIdx = colNumber;
      } else if (val.includes('tercero') || val.includes('razon social') || val.includes('nombre tercero')) {
        if (terceroIdx === -1) terceroIdx = colNumber;
      } else if (val.includes('concepto') || val.includes('detalle') || val.includes('descripcion') || val.includes('observacion')) {
        if (conceptoIdx === -1) conceptoIdx = colNumber;
      } else if (val.includes('debito') || val.includes('debitos') || val === 'debit') {
        if (debitoIdx === -1) debitoIdx = colNumber;
      } else if (val.includes('credito') || val.includes('creditos') || val === 'credit') {
        if (creditoIdx === -1) creditoIdx = colNumber;
      }
    }

    // Check if row satisfies minimum criteria for a header row
    const hasDebitOrCredit = debitoIdx !== -1 || creditoIdx !== -1;
    const hasAccountOrDate = codigoCuentaIdx !== -1 || fechaIdx !== -1;

    if (hasDebitOrCredit && hasAccountOrDate) {
      return {
        headerRowNumber: r,
        mapping: {
          fecha: fechaIdx,
          comprobante: comprobanteIdx,
          numero: numeroIdx,
          codigoCuenta: codigoCuentaIdx,
          nombreCuenta: nombreCuentaIdx,
          identificacion: identificacionIdx,
          tercero: terceroIdx,
          concepto: conceptoIdx,
          debito: debitoIdx,
          credito: creditoIdx,
        },
      };
    }
  }

  return null;
}

/**
 * Parses a historical Libro Diario Excel file (.xlsx) and extracts double-entry journal entries.
 * Strictly uses read-only buffer operations and enforces double-entry validation.
 */
export async function parseLibroDiario(
  filePath: string,
  _options?: Partial<IngestionOptions>
): Promise<ParsedJournalEntry[]> {
  return withReadOnlyGuard(filePath, async (buffer: Buffer) => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return [];
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const headerInfo = detectHeaderRow(rows);
    if (!headerInfo) {
      throw new Error(`Could not auto-detect column header row in Excel file: ${filePath}`);
    }

    const { headerRowNumber, mapping } = headerInfo;
    const entries: ParsedJournalEntry[] = [];

    let currentEntry: ParsedJournalEntry | null = null;
    let lastSeenDate = '';
    let lastSeenVoucherType = '';
    let lastSeenVoucherNum = '';
    let lastSeenConcept = '';

    for (let r = headerRowNumber + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const getCellVal = (colIdx: number) => (colIdx !== -1 && colIdx < row.length ? row[colIdx] : null);

      const rawFecha = getCellVal(mapping.fecha);
      const rawComprobante = getCellVal(mapping.comprobante);
      const rawNumero = getCellVal(mapping.numero);
      const rawCodigo = getCellVal(mapping.codigoCuenta);
      const rawNombreCuenta = getCellVal(mapping.nombreCuenta);
      const rawDoc = getCellVal(mapping.identificacion);
      const rawTercero = getCellVal(mapping.tercero);
      const rawConcepto = getCellVal(mapping.concepto);
      const rawDebito = getCellVal(mapping.debito);
      const rawCredito = getCellVal(mapping.credito);

      const strCodigo = getCellValueString(rawCodigo).replace(/[^\w]/g, '').trim();
      const debito = parseNumericCell(rawDebito);
      const credito = parseNumericCell(rawCredito);

      const rawComprobanteStr = getCellValueString(rawComprobante).trim();
      
      // If row has a voucher header like "Comprobante: CC-1-931"
      if (rawComprobanteStr.toLowerCase().startsWith('comprobante:')) {
        const parts = rawComprobanteStr.replace(/comprobante:/i, '').trim().split('-');
        if (parts.length >= 2) {
          lastSeenVoucherType = parts[0].trim();
          lastSeenVoucherNum = parts.slice(1).join('-').trim();
        } else {
          lastSeenVoucherType = parts[0].trim();
          lastSeenVoucherNum = '1';
        }
        
        // Also parse date if it happens to be on this row
        const parsedDateStr = parseExcelDate(rawFecha);
        if (parsedDateStr) {
          lastSeenDate = parsedDateStr;
        }
        
        // Skip adding this as a data line (it's just a header/summary)
        continue;
      }

      // Check if row is empty or summary/subtotal row (EXCLUDING rawConcepto to prevent false-positive line drops)
      const accountSummaryText = normalizeHeaderString(
        `${getCellValueString(rawCodigo)} ${getCellValueString(rawNombreCuenta)}`
      );
      const nonConceptText = normalizeHeaderString(
        `${getCellValueString(rawFecha)} ${rawComprobanteStr} ${getCellValueString(rawNumero)} ${getCellValueString(rawCodigo)} ${getCellValueString(rawNombreCuenta)}`
      );

      const isSummaryRow =
        accountSummaryText.includes('total') ||
        accountSummaryText.includes('subtotal') ||
        accountSummaryText.includes('van') ||
        accountSummaryText.includes('vienen') ||
        (!strCodigo && nonConceptText.includes('total'));

      if (!nonConceptText.trim() && !getCellValueString(rawConcepto).trim()) {
        continue;
      }

      if (isSummaryRow) {
        continue;
      }

      // Ignore row if both debito and credito are 0 AND account code is missing
      if (!strCodigo && debito === 0 && credito === 0) {
        continue;
      }

      // Date parsing
      const parsedDateStr = parseExcelDate(rawFecha);
      if (parsedDateStr) {
        lastSeenDate = parsedDateStr;
      }
      const entryDate = parsedDateStr || lastSeenDate || new Date().toISOString().substring(0, 10);

      // We no longer update lastSeenVoucherType/Num from rawComprobante 
      // because in these files rawComprobante on data lines is just a line index ("1", "2")
      const concept = getCellValueString(rawConcepto) || lastSeenConcept || `Asiento ${lastSeenVoucherType}-${lastSeenVoucherNum}`;
      if (getCellValueString(rawConcepto)) lastSeenConcept = getCellValueString(rawConcepto);

      let doc = getCellValueString(rawDoc).trim();
      let terceroName = getCellValueString(rawTercero).trim();

      if (!doc || doc === '0') {
        doc = '0';
        terceroName = terceroName || 'CUANTIAS MENORES / GENERAL';
      }

      const accountName = getCellValueString(rawNombreCuenta) || `Cuenta Auxiliar ${strCodigo}`;

      const line: ParsedJournalLine = {
        account_code: strCodigo,
        account_name: accountName,
        third_party_doc: doc,
        third_party_name: terceroName,
        debit: debito,
        credit: credito,
        description: concept,
      };

      // Key for grouping entries
      const entryKey = `${entryDate}_${lastSeenVoucherType}_${lastSeenVoucherNum}`;
      const currentKey = currentEntry ? `${currentEntry.date}_${currentEntry.voucher_type}_${currentEntry.voucher_number}` : '';

      const isNewEntry = !currentEntry || entryKey !== currentKey;

      if (isNewEntry) {
        if (currentEntry) {
          finalizeEntry(currentEntry);
          entries.push(currentEntry);
        }

        currentEntry = {
          date: entryDate,
          voucher_type: lastSeenVoucherType || 'DIARIO',
          voucher_number: lastSeenVoucherNum || '1',
          description: concept,
          lines: [line],
          total_debit: debito,
          total_credit: credito,
          is_balanced: false,
        };
      } else {
        currentEntry!.lines.push(line);
      }
    }

    if (currentEntry) {
      finalizeEntry(currentEntry);
      entries.push(currentEntry);
    }

    return entries;
  });
}

function finalizeEntry(entry: ParsedJournalEntry) {
  const sumDebitsCents = entry.lines.reduce((sum, l) => sum + Math.round(l.debit * 100), 0);
  const sumCreditsCents = entry.lines.reduce((sum, l) => sum + Math.round(l.credit * 100), 0);

  entry.total_debit = Math.round(sumDebitsCents) / 100;
  entry.total_credit = Math.round(sumCreditsCents) / 100;

  // Double-entry tolerance check: <= 0.01 COP (1 cent)
  const diffCents = Math.abs(sumDebitsCents - sumCreditsCents);
  entry.is_balanced = diffCents <= 1;
}
