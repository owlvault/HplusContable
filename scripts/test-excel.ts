import * as XLSX from 'xlsx';
import fs from 'fs';

async function test() {
  const file = "C:\\Users\\ccarvajalino\\OneDrive\\H Plus\\Contabilidad\\Backup\\2025 Libro diario-20260217211458.xlsx";
  
  console.log("Testing with xlsx (SheetJS)...");
  try {
    const buffer = fs.readFileSync(file);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log("Read successfully! Sheets:", workbook.SheetNames);
    
    if (workbook.SheetNames.length > 0) {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log("First 3 rows of data:", json.slice(0, 3));
    }
  } catch (err: any) {
    console.error("Error reading with xlsx:", err.message);
  }
}

test();
