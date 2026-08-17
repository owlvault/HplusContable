# Original User Request

## 2026-08-03T18:52:05Z

<USER_REQUEST>
Make CFO-AI functional for production by reading and loading real Excel data from a specific directory, and enabling real accounting movement tests for new periods.

Working directory: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable
Integrity mode: development

## Verification Resources
The directory `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` contains real data files including historical balances, daily books (libros diarios), and other accounting reports. This data must be used as the source of truth for programmatic verification.

## Requirements

### R1. Data Ingestion
Read and load the real accounting data (transactions) from older periods in the Excel files located in the backup folder.

### R2. Accounting Movements & Closures
Process the loaded transactions to generate accounting closures and reports (e.g., trial balance) programmatically.

### R3. Infrastructure Constraint (Read-Only Data)
The source folder `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` MUST be treated as completely Read-Only. You must not modify, overwrite, or delete any files in this directory.

## Acceptance Criteria

### Data Loading & Processing
- [ ] A test script can successfully read the historical transaction files from the backup directory without read/parse errors.
- [ ] The system can process the loaded transactions and generate a trial balance (balance de prueba) for a given older period.

### Verification against Source of Truth
- [ ] A programmatic verification script must generate a trial balance for a specific period and automatically compare it against the actual trial balance report saved in the backup folder for that same period.
- [ ] The comparison test must pass (the generated balances must match the historical balances without errors).
</USER_REQUEST>
