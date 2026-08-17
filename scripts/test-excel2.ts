import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

function getCellValueString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if (cellValue instanceof Date) return cellValue.toISOString();
    return String(cellValue).trim();
  }
  return String(cellValue).trim();
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

    let fechaIdx = -1, comprobanteIdx = -1, numeroIdx = -1, codigoCuentaIdx = -1;
    let nombreCuentaIdx = -1, identificacionIdx = -1, terceroIdx = -1;
    let conceptoIdx = -1, debitoIdx = -1, creditoIdx = -1;

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

    const hasDebitOrCredit = debitoIdx !== -1 || creditoIdx !== -1;
    const hasAccountOrDate = codigoCuentaIdx !== -1 || fechaIdx !== -1;

    if (hasDebitOrCredit && hasAccountOrDate) {
      return {
        headerRowNumber: r, // 0-indexed
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

async function test() {
  const file = "C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Contabilidad\\Backup\\2025 Libro diario-20260217211458.xlsx";
  const buffer = fs.readFileSync(file);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  const headerInfo = detectHeaderRow(rows);
  console.log("Header info detected:", headerInfo);
  if (headerInfo) {
      const dataRows = rows.slice(headerInfo.headerRowNumber + 1).slice(0, 5);
      console.log("First 5 data rows:", JSON.stringify(dataRows, null, 2));
  }
}

test();
