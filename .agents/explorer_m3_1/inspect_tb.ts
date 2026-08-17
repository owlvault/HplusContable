import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = 'C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Contabilidad\\Backup';

async function inspectFile(fileName: string) {
  const filePath = path.join(BACKUP_DIR, fileName);
  console.log(`\n==================================================`);
  console.log(`FILE: ${fileName}`);
  console.log(`==================================================`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  // Read using stream / buffer for safety
  const buffer = fs.readFileSync(filePath);
  await workbook.xlsx.load(buffer);

  console.log(`Worksheets count: ${workbook.worksheets.length}`);
  workbook.worksheets.forEach((ws, idx) => {
    console.log(` Sheet [${idx}]: "${ws.name}" (rowCount: ${ws.rowCount}, columnCount: ${ws.columnCount})`);
  });

  const ws = workbook.worksheets[0];
  if (!ws) return;

  console.log(`\n--- First 15 rows raw text ---`);
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const rowVals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const valStr = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
      rowVals.push(`C${colNumber}: ${JSON.stringify(valStr).slice(0, 40)}`);
    });
    if (rowVals.length > 0) {
      console.log(`Row ${r.toString().padStart(2)}: ${rowVals.join(' | ')}`);
    } else {
      console.log(`Row ${r.toString().padStart(2)}: <EMPTY>`);
    }
  }

  // Find potential header row
  let headerRow = -1;
  for (let r = 1; r <= Math.min(25, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const rowText = row.values ? JSON.stringify(row.values).toLowerCase() : '';
    if (rowText.includes('cuenta') || rowText.includes('codigo') || rowText.includes('saldo') || rowText.includes('debito')) {
      console.log(`Potential Header at Row ${r}:`);
      row.eachCell({ includeEmpty: false }, (cell, colIdx) => {
        console.log(`  Col ${colIdx}: ${JSON.stringify(cell.value)}`);
      });
      if (headerRow === -1) headerRow = r;
    }
  }

  // Analyze row types after header
  if (headerRow !== -1) {
    console.log(`\n--- Sample 20 Data Rows starting at Row ${headerRow + 1} ---`);
    let summaryCount = 0;
    let detailCount = 0;
    let totalCount = 0;
    let otherCount = 0;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: any[] = [];
      for (let c = 1; c <= Math.max(10, ws.columnCount); c++) {
        const val = row.getCell(c).value;
        const text = val !== null && val !== undefined ? (typeof val === 'object' ? (val as any).text || (val as any).result || JSON.stringify(val) : String(val)) : '';
        cells.push(text.trim());
      }
      
      const allText = cells.join(' ').toLowerCase();
      if (!allText.trim()) continue;

      if (r <= headerRow + 20) {
        console.log(`Row ${r.toString().padStart(4)}: ${cells.map((c, i) => `[C${i+1}] ${JSON.stringify(c).slice(0, 30)}`).join(' | ')}`);
      }

      const col1 = cells[0] || '';
      const col2 = cells[1] || '';
      const col3 = cells[2] || '';

      if (allText.includes('total') || allText.includes('gran total')) {
        totalCount++;
      } else if (/^\d+$/.test(col1)) {
        // Numeric code
        if (col1.length < 8) {
          summaryCount++;
        } else {
          detailCount++;
        }
      } else {
        otherCount++;
      }
    }
    console.log(`\nRow Classification Summary: Summary (code < 8 digits): ${summaryCount}, Detail (code >= 8 digits / third party): ${detailCount}, Totals: ${totalCount}, Other: ${otherCount}`);
  }
}

async function main() {
  const files = [
    '2020 Balance de prueba por tercero-20260217212416.xlsx',
    '2021 Balance de prueba por tercero-20260217212336.xlsx',
    '2022 Balance de prueba por tercero-20260217212246.xlsx',
    '2023 Balance de prueba por tercero-20260217212105.xlsx',
    '2024 Balance de prueba por tercero-20260217212105.xlsx',
    '2025 Balance de prueba por tercero-20260217212028.xlsx',
    '2026 Balance de prueba por tercero-20260217212007.xlsx',
  ];

  for (const f of files) {
    await inspectFile(f);
  }
}

main().catch(console.error);
