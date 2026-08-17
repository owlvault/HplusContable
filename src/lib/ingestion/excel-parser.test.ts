import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseLibroDiario } from './excel-parser';

describe('Excel Parser Unit Tests (parseLibroDiario)', () => {
  let mockBackupDir: string;
  let excelFilePath: string;

  beforeAll(async () => {
    mockBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-parser-test-'));
    excelFilePath = path.join(mockBackupDir, '2024 Libro diario-TEST.xlsx');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Libro Diario');

    // Title metadata block
    worksheet.addRow(['EMPRESA DE PRUEBA S.A.S.']);
    worksheet.addRow(['NIT: 900.123.456-7']);
    worksheet.addRow(['LIBRO DIARIO GENERAL']);
    worksheet.addRow([]);

    // Header row (Row 5)
    worksheet.addRow([
      'Fecha',
      'Comprobante',
      'Número',
      'Código Cuenta',
      'Nombre Cuenta',
      'Identificación',
      'Tercero',
      'Concepto',
      'Débito',
      'Crédito',
    ]);

    // Entry 1 (Balanced)
    worksheet.addRow([
      '2024-01-15',
      'CI',
      '101',
      '11050501',
      'Caja General',
      '900111222',
      'CLIENTE PRUEBA 1',
      'Ingreso por caja',
      100000.5,
      0,
    ]);
    worksheet.addRow([
      '2024-01-15',
      'CI',
      '101',
      '41350501',
      'Comercio al por mayor',
      '900111222',
      'CLIENTE PRUEBA 1',
      'Ingreso por caja',
      0,
      100000.5,
    ]);

    // Entry 2 (Missing Third Party - Fallback test)
    worksheet.addRow([
      '2024-01-16',
      'CE',
      '102',
      '51350501',
      'Gastos de Servicios',
      '', // Missing doc
      '', // Missing name
      'Pago menor papeleria',
      50000,
      0,
    ]);
    worksheet.addRow([
      '2024-01-16',
      'CE',
      '102',
      '11100501',
      'Bancos Nacionales',
      '0',
      'CUANTIAS MENORES / GENERAL',
      'Pago menor papeleria',
      0,
      50000,
    ]);

    // Save initial workbook to mock file
    await workbook.xlsx.writeFile(excelFilePath);
  });

  afterAll(() => {
    if (fs.existsSync(mockBackupDir)) {
      fs.rmSync(mockBackupDir, { recursive: true, force: true });
    }
  });

  it('parses valid Libro Diario Excel file cleanly with auto-detected headers', async () => {
    process.env.BACKUP_DIR = mockBackupDir;
    const entries = await parseLibroDiario(excelFilePath, { batchSize: 100 });

    expect(entries).toHaveLength(2);

    // Entry 1 Verification
    const e1 = entries[0];
    expect(e1.date).toBe('2024-01-15');
    expect(e1.voucher_type).toBe('CI');
    expect(e1.voucher_number).toBe('101');
    expect(e1.lines).toHaveLength(2);
    expect(e1.total_debit).toBe(100000.5);
    expect(e1.total_credit).toBe(100000.5);
    expect(e1.is_balanced).toBe(true);
    expect(e1.lines[0].third_party_doc).toBe('900111222');

    // Entry 2 Verification (Third party fallback)
    const e2 = entries[1];
    expect(e2.date).toBe('2024-01-16');
    expect(e2.voucher_type).toBe('CE');
    expect(e2.lines).toHaveLength(2);
    expect(e2.lines[0].third_party_doc).toBe('0');
    expect(e2.lines[0].third_party_name).toBe('CUANTIAS MENORES / GENERAL');
    expect(e2.is_balanced).toBe(true);
  });

  it('parses entries containing the word "total" in concept string ("Pago total factura #102") without dropping lines', async () => {
    process.env.BACKUP_DIR = mockBackupDir;
    const testFile = path.join(mockBackupDir, '2024 Libro diario-TOTAL-CONCEPT.xlsx');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Libro Diario');
    ws.addRow(['Fecha', 'Comprobante', 'Número', 'Código Cuenta', 'Nombre Cuenta', 'Identificación', 'Tercero', 'Concepto', 'Débito', 'Crédito']);
    ws.addRow(['2024-01-20', 'CE', '103', '51350501', 'Servicios', '900555444', 'PROVEEDOR TEST', 'Pago total factura #102', 150000, 0]);
    ws.addRow(['2024-01-20', 'CE', '103', '11100501', 'Bancos', '900555444', 'PROVEEDOR TEST', 'Pago total factura #102', 0, 150000]);
    await workbook.xlsx.writeFile(testFile);

    const entries = await parseLibroDiario(testFile);
    expect(entries).toHaveLength(1);
    expect(entries[0].lines).toHaveLength(2);
    expect(entries[0].lines[0].description).toBe('Pago total factura #102');
    expect(entries[0].is_balanced).toBe(true);
  });

  it('correctly parses complex monetary formats: "1.500.000", "1.500.000,50", "(1,500.00)", "($ 1.500.000)"', async () => {
    process.env.BACKUP_DIR = mockBackupDir;
    const testFile = path.join(mockBackupDir, '2024 Libro diario-MONEY-FORMATS.xlsx');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Libro Diario');
    ws.addRow(['Fecha', 'Comprobante', 'Número', 'Código Cuenta', 'Nombre Cuenta', 'Identificación', 'Tercero', 'Concepto', 'Débito', 'Crédito']);
    // Row 1: 1.500.000
    ws.addRow(['2024-02-01', 'CI', '201', '11050501', 'Caja', '123', 'CLIENTE A', 'Prueba 1', '1.500.000', 0]);
    // Row 2: 1.500.000,50
    ws.addRow(['2024-02-01', 'CI', '201', '41350501', 'Ventas', '123', 'CLIENTE A', 'Prueba 1', 0, '1.500.000,50']);
    // Row 3: (1,500.00)
    ws.addRow(['2024-02-02', 'CE', '202', '51350501', 'Gastos', '123', 'CLIENTE A', 'Prueba 2', '(1,500.00)', 0]);
    // Row 4: ($ 1.500.000)
    ws.addRow(['2024-02-02', 'CE', '202', '11100501', 'Bancos', '123', 'CLIENTE A', 'Prueba 2', 0, '($ 1.500.000)']);

    await workbook.xlsx.writeFile(testFile);

    const entries = await parseLibroDiario(testFile);
    expect(entries).toHaveLength(2);
    expect(entries[0].lines[0].debit).toBe(1500000);
    expect(entries[0].lines[1].credit).toBe(1500000.5);
    expect(entries[1].lines[0].debit).toBe(-1500);
    expect(entries[1].lines[1].credit).toBe(-1500000);
  });

  it('prioritizes "Número de Identificación" for third party doc rather than misclassifying it as voucher number', async () => {
    process.env.BACKUP_DIR = mockBackupDir;
    const testFile = path.join(mockBackupDir, '2024 Libro diario-HEADER-PRIORITY.xlsx');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Libro Diario');
    ws.addRow(['Fecha', 'Comprobante', 'Número', 'Código Cuenta', 'Nombre Cuenta', 'Número de Identificación', 'Nombre Tercero', 'Concepto', 'Débito', 'Crédito']);
    ws.addRow(['2024-03-01', 'CI', '999', '11050501', 'Caja', '800999888', 'TERCERO PRUEBA', 'Venta test', 1000, 0]);
    ws.addRow(['2024-03-01', 'CI', '999', '41350501', 'Ventas', '800999888', 'TERCERO PRUEBA', 'Venta test', 0, 1000]);

    await workbook.xlsx.writeFile(testFile);

    const entries = await parseLibroDiario(testFile);
    expect(entries).toHaveLength(1);
    expect(entries[0].voucher_number).toBe('999');
    expect(entries[0].lines[0].third_party_doc).toBe('800999888');
    expect(entries[0].lines[0].third_party_name).toBe('TERCERO PRUEBA');
  });
});

