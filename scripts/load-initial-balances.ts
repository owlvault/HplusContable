import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parseLibroDiario } from '../src/lib/ingestion/excel-parser';
import { loadJournalEntries } from '../src/lib/ingestion/db-loader';
import { DEFAULT_BACKUP_DIR } from '../src/lib/ingestion/readonly-guard';

async function main() {
  console.log('=== CFO-AI Initial Balances Loader ===');

  const backupDir = process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
  console.log(`Target Backup Directory: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    console.error(`Error: Backup directory does not exist: ${backupDir}`);
    process.exit(1);
  }

  // Find 2025 and 2026 Libro diario files
  const files = fs.readdirSync(backupDir).filter((f) => 
    f.includes('Libro diario') && 
    f.endsWith('.xlsx') && 
    (f.startsWith('2025') || f.startsWith('2026'))
  ).sort(); // Sort to ensure chronological order

  if (files.length === 0) {
    console.error(`Error: No 2025/2026 "Libro diario" Excel files found in ${backupDir}.`);
    process.exit(1);
  }

  console.log(`Found ${files.length} Excel file(s) to load:`, files);

  let totalEntriesCount = 0;

  for (const file of files) {
    const fullPath = path.join(backupDir, file);
    console.log(`\nParsing: ${file}...`);

    try {
      const startTime = Date.now();
      const entries = await parseLibroDiario(fullPath);
      const elapsed = Date.now() - startTime;

      console.log(`  Parsed ${entries.length} journal entry(ies) in ${elapsed} ms.`);

      console.log(`  Loading into Supabase...`);
      const loadResult = await loadJournalEntries(entries, {
        batchSize: 500,
        autoCreateThirdParties: true,
        autoCreatePucAccounts: true,
        defaultState: 'APROBADO'
      });

      if (loadResult.warnings && loadResult.warnings.length > 0) {
        console.warn(`  [WARNINGS]:`);
        loadResult.warnings.forEach(w => console.warn(`    - ${w}`));
      }

      if (!loadResult.success) {
        console.error(`  [ERROR] Database loading failed:`);
        loadResult.errors.forEach(e => console.error(`    - ${e.message}`));
        process.exit(1);
      } else {
         console.log(`  [PASS] Successfully loaded into DB in ${loadResult.executionTimeMs} ms.`);
         console.log(`         Inserted: ${loadResult.entriesInserted} entries, ${loadResult.linesInserted} lines.`);
         if (loadResult.thirdPartiesCreated > 0) console.log(`         Created ${loadResult.thirdPartiesCreated} missing third parties.`);
         if (loadResult.accountsCreated > 0) console.log(`         Created ${loadResult.accountsCreated} missing PUC accounts.`);
      }

      totalEntriesCount += loadResult.entriesInserted;
    } catch (err: any) {
      console.error(`  [ERROR] Failed processing file ${file}: ${err?.message || err}`);
      process.exit(1);
    }
  }

  console.log('\n================ LOAD SUMMARY ================');
  console.log(`Total Entries Loaded: ${totalEntriesCount}`);
  console.log('==============================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
