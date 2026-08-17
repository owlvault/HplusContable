# Survey Analysis — DigiKawsay / HplusContable Codebase Structure

## 1. Executive Summary & Project Purpose

**DigiKawsay (HplusContable)** is a Colombian accounting SaaS system (Software Contable) implemented as a **single-company, modular monolith**. The system enforces Colombian double-entry accounting rules (*partida doble*), Plan Único de Cuentas (PUC), tax withholding calculation (Retefuente, ReteIVA, ReteICA) based on UVT thresholds, payroll laws, document sequence immutability, and monthly/annual accounting closures.

The goal of the current initiative is to make **CFO-AI functional for production** by ingesting real historical accounting data from Excel files located in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` (read-only) and enabling automatic verification of trial balances (*balance de comprobación*) against historical period reports.

---

## 2. Technology Stack & Key Dependencies

### 2.1 Node.js / Next.js Application Stack
- **Framework**: Next.js 15.1.0 (App Router, Server Actions, `--turbopack` in dev)
- **Language**: TypeScript 5.0+ (Strict mode)
- **UI & Styling**: React 19.0.0, Tailwind CSS 3.4.0, Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-toast`), Lucide React, Recharts
- **Database & SSR Auth**: Supabase PostgreSQL (`@supabase/ssr` 0.8.0, `@supabase/supabase-js` 2.90.1, `pg` 8.22.0)
- **PDF Generation**: `@react-pdf/renderer` 4.5.1
- **Test Runner**: Vitest 4.0.17 (`npm run test`)

### 2.2 Python AI Chatbot Stack (`backend/`)
- **Framework**: FastAPI (>=0.100.0), Uvicorn (>=0.22.0), Pydantic (>=2.0.0)
- **LLM Integration**: `emergentintegrations` (connecting to Anthropic Claude Sonnet)
- **Database Client**: `supabase-py`
- **Entry Point**: `backend/server.py` (runs FastAPI server on port 8001 providing `get_financial_context` and `/api/chat`)

---

## 3. Directory Layout & Architecture

```
C:\Users\ccarvajalino\OneDrive\Proyectos\Contable
├── .agents/                    # Agent metadata, briefings, and handoff reports
├── backend/                    # Python FastAPI service for AI Chatbot (DigiCFO)
│   ├── requirements.txt
│   └── server.py
├── memory/                     # PRD and test credentials
├── public/                     # Static web assets
├── scripts/                    # Database helper scripts (apply-migrations.mjs)
├── sql/                        # SQL schemas (nomina_dian_tables*.sql)
├── src/
│   ├── actions/                # Server Actions ('use server') - Data access & mutation layer
│   ├── app/                    # Next.js App Router (pages and API route handlers)
│   │   ├── (auth)/             # Login and register pages
│   │   ├── (dashboard)/        # 14 UI modules (asientos, cartera, cierre, facturas, reportes, etc.)
│   │   └── api/chat/           # Proxy to backend FastAPI service
│   ├── components/             # React components (UI primitives, report templates)
│   ├── lib/
│   │   ├── rbac.ts             # Permission enforcement helper (`enforcePermission`)
│   │   ├── modules.ts          # Module registry for RBAC
│   │   ├── supabase/           # Server, client, and middleware Supabase initializers
│   │   └── utils/              # Dian logic, tax engine, payroll, closing, excel export
│   └── types/                  # Database TypeScript schema definitions (`database.ts`)
├── supabase/
│   ├── migrations/             # Numbered SQL schema migrations (0000_ to 0007_)
│   ├── rpc/                    # SQL RPC definitions for sequences, reconciliation, RBAC
│   └── seeds/                  # Seed SQL files (puc.sql)
├── test_reports/               # Iteration test report history
├── CLAUDE.md                   # Repository guidance and developer rules
├── PLAN_PRODUCCION.md          # Production roadmap and phase completion tracking
├── package.json / tsconfig.json
```

---

## 4. Business Modules & Data Processing Utilities

### 4.1 Server Actions (`src/actions/*.ts`)
The system follows a strict architecture where Server Actions handle data mutations and business rules:
1. `reportes.ts`: Includes `getTrialBalance(year, month)` which aggregates `journal_lines` by `account_code`, computes debits/credits, calculates balances based on account nature (DEBITO vs CREDITO), and formats `BalanceSheetItem[]`. Also contains `getBalanceSheet`, `getGeneralLedger`, `getIncomeStatement`, and `getReceivablesReportByClient`.
2. `accounting.ts`: Handles journal entry creation, checking double-entry equality (`|debit - credit| <= 0.01`).
3. `cierre.ts` & `cierre-anual.ts`: Manages monthly period locking and year-end account closing (canceling income/expense accounts into equity account `360505` or loss account `361005`).
4. `backup.ts`: Exports all database tables (`puc_accounts`, `third_parties`, `invoices`, `journal_entries`, `journal_lines`, `receivables`, `payables`, `bank_movements`, `accounting_periods`) to JSON format.
5. `terceros.ts`, `puc.ts`, `invoices.ts`, `cartera.ts`, `tesoreria.ts`, `conciliacion.ts`, `nomina.ts`, `taxes.ts`: Module-specific server actions protected by `enforcePermission`.

### 4.2 Calculation Helpers (`src/lib/utils/*.ts`)
- `closing-calc.ts`: Pure functions calculating profit/loss from account balances and generating balanced closing journal lines.
- `dian.ts`: DIAN NIT Verification Digit algorithm (`calculateDV`) and COP currency formatting.
- `tax-engine.ts`: Calculates Retefuente, ReteIVA, and ReteICA based on UVT minimum bases and parametric tax concept rates.
- `payroll-calc.ts`: Computes Colombian payroll deductions (health 4%, pension 4%), employer contributions (health, pension, ARL risk levels 1-5, SENA, ICBF, Caja), transport allowance, and provisions (cesantías 8.33%, prima 8.33%, vacaciones 4.17%, intereses).
- `excel-export.ts`: Helper functions exporting financial report data to UTF-8 BOM CSV format compatible with Microsoft Excel.

---

## 5. Test Suite & Verification Configuration

- **Test Framework**: Vitest 4.0.17 configured via `package.json` (`npm run test`).
- **Co-located Test Files**:
  - `src/lib/utils/closing-calc.test.ts`: Tests profit vs loss entry creation, balancing debits/credits, and filtering of non-result accounts.
  - `src/lib/utils/dian.test.ts`: Tests DIAN verification digit algorithm against known NIT numbers.
  - `src/lib/utils/tax-engine.test.ts`: Tests UVT conversion, Retefuente threshold rules (27 UVT for purchases), ReteIVA 15% calculation, and multi-withholding calculations.
  - `src/lib/utils/payroll-calc.test.ts`: Tests payroll provisions, settlements, employee/employer contributions, and ARL risk levels.

---

## 6. Real Data Ingestion & Trial Balance Verification Gap Analysis

1. **Excel Data Reading Capability**:
   - `package.json` currently lacks a dedicated `.xlsx` binary spreadsheet parser library (e.g., `xlsx` / `exceljs` in Node or `openpyxl` / `pandas` in Python).
   - Ingestion of real backup files from `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` will require adding an Excel parsing utility or python script.
2. **Trial Balance Verification Workflow**:
   - The backup directory must remain 100% read-only (R3).
   - A data loader and verification test script needs to read Excel transaction files, insert or map entries into `journal_entries` and `journal_lines`, invoke `getTrialBalance(year, month)`, and programmatically verify generated balances against actual historical trial balance reports in the backup directory (R1 & R2).
