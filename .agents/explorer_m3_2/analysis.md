# Technical Analysis: Programmatic Trial Balance Comparison Engine Design

**Author**: `explorer_m3_2`  
**Milestone**: Milestone 3 — Task M3.2  
**Target Module**: `src/lib/verification/trial-balance-comparator.ts`  
**Date**: 2026-08-03  

---

## 1. Executive Summary

This document presents the detailed architectural design and implementation plan for the **Trial Balance Comparator Engine** (`src/lib/verification/trial-balance-comparator.ts`). The goal of this comparator is to programmatically verify generated trial balances (`TrialBalanceReport` produced by `calculateTrialBalance` in `src/lib/utils/trial-balance-calc.ts`) against historical benchmark data extracted from read-only Excel reports (`Balance de prueba por tercero-*.xlsx` in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`).

The comparison algorithm operates with **strict row matching by composite key** (account code + third-party document number), enforces a **floating-point numerical tolerance of $\le 0.01$ COP** across all 4 balance columns (`saldo_inicial`, `debito`, `credito`, `saldo_final`), categorizes discrepancies into explicit failure types, and provides complete execution statistics (`MatchStats`).

---

## 2. Analysis of Current Trial Balance Calculation Engine

### 2.1 Server Action & Calculation Engine Interface
- **`src/actions/reportes.ts` (`getTrialBalance`)**:
  - Acts as the primary entry point for fetching journal entries and PUC metadata from Supabase.
  - Passes structured `RawJournalLineData[]` and `TrialBalanceOptions` into `calculateTrialBalance()`.
- **`src/lib/utils/trial-balance-calc.ts` (`calculateTrialBalance`)**:
  - Implements real double-entry accounting math, carry-forward logic, PUC hierarchy rollup (levels 1-5), and third-party breakdown.
  - Return type: `TrialBalanceReport & TrialBalanceItem[]`.

### 2.2 Output Data Structure (`TrialBalanceItem`)
```typescript
export interface TrialBalanceItem {
  code: string;               // e.g. "110505" or "130505"
  name: string;               // Account name
  level: number;              // 1 (Clase), 2 (Grupo), 3 (Cuenta), 4 (Subcuenta), 5 (Auxiliar)
  nature: 'DEBITO' | 'CREDITO';
  type: AccountType;
  parent_code: string | null;

  // Optional third-party fields (present when includeThirdParty is true)
  third_party_id?: string | null;
  document_number?: string | null;
  third_party_name?: string | null;

  // Primary numerical balances (COP)
  saldo_inicial: number;
  debito: number;
  credito: number;
  saldo_final: number;

  // Aliases
  debit: number;
  credit: number;
  balance: number;

  is_synthesized?: boolean;
}
```

### 2.3 Benchmark Data Structure (`BenchmarkTrialBalanceRow`)
Extracted from historical Excel reports by the M3.1 benchmark extractor:
```typescript
export interface BenchmarkTrialBalanceRow {
  account_code: string;           // e.g. "130505"
  account_name: string;           // e.g. "CLIENTES NACIONALES"
  document_number?: string | null; // Third party document / NIT
  third_party_name?: string | null;// Third party full name
  saldo_inicial: number;          // Benchmark initial balance
  debito: number;                 // Benchmark debit movement
  credito: number;                // Benchmark credit movement
  saldo_final: number;            // Benchmark final balance
  level?: number;                 // PUC level (1-5)
  is_third_party_detail?: boolean;// True if detail row under an account
}
```

---

## 3. Comparison Algorithm Design

### 3.1 Composite Key Matching Strategy
To guarantee precise row matching between generated items and historical benchmark rows without ambiguity, rows must be identified using a **Composite Key System**.

1. **Account Summary Rows** (Rows representing PUC accounts without third-party detail):
   $$\text{Key}_{\text{Summary}} = \text{"ACC::"} + \text{normalizeAccountCode}(\text{account\_code})$$
   *Example*: `"ACC::110505"` or `"ACC::130505"`.

2. **Third-Party Detail Rows** (Rows representing individual third parties under an account):
   $$\text{Key}_{\text{Detail}} = \text{"TP::"} + \text{normalizeAccountCode}(\text{account\_code}) + \text{"::"} + \text{normalizeDocumentNumber}(\text{document\_number})$$
   *Example*: `"TP::130505::900123456"`.

### 3.2 Key & Document Normalization Rules
- **`normalizeAccountCode(code: string)`**:
  - `code.trim().replace(/\s+/g, '')`
  - Ensures clean matching regardless of trailing spaces or extra padding.
- **`normalizeDocumentNumber(doc?: string | null)`**:
  - If `!doc` or `doc.trim() === ''` or `doc === '0'`, return `"GENERAL"`.
  - Strip non-alphanumeric characters except letters/digits: `doc.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')`.
  - Removes formatting variations like `"900.123.456-1"` $\rightarrow$ `"9001234561"` or `"900123456-1"` $\rightarrow$ `"9001234561"`.

### 3.3 Four-Point Numerical Balance Comparison
For every matched key present in both Generated and Benchmark datasets, the comparator evaluates all four primary accounting fields:

1. $\text{saldo\_inicial}$ (Initial Balance)
2. $\text{debito}$ (Debit Movements)
3. $\text{credito}$ (Credit Movements)
4. $\text{saldo\_final}$ (Final Balance)

### 3.4 Floating-Point Numerical Tolerance Handling ($\le 0.01$ COP)
Floating-point calculations in Node.js/TypeScript can introduce infinitesimal rounding artifacts (e.g. `0.0000000000000002`). To prevent false positives while strictly maintaining COP precision:

$$\text{isWithinTolerance}(a, b, \text{tolerance} = 0.01) \iff |a - b| \le \text{tolerance} + 1\times 10^{-9}$$

Where:
- $\text{tolerance} = 0.01$ COP (1 centavo).
- $1\times 10^{-9}$ is a safety $\epsilon$ to absorb IEEE 754 floating-point inaccuracies.

### 3.5 Discrepancy Categorization & Taxonomy
When a mismatch is detected, the comparator creates a structured `Discrepancy` record categorized into one of six explicit types:

| Discrepancy Type | Condition | Severity |
|------------------|-----------|----------|
| `MISSING_IN_GENERATED` | Key exists in Benchmark Excel, but missing in Generated Trial Balance | HIGH (Missing Data) |
| `UNEXPECTED_IN_GENERATED` | Key exists in Generated Trial Balance, but absent in Benchmark Excel | HIGH / WARN (Extra Data) |
| `SALDO_INICIAL_MISMATCH` | $|gen.\text{saldo\_inicial} - bench.\text{saldo\_inicial}| > 0.01$ | HIGH (Carryover Error) |
| `DEBITO_MISMATCH` | $|gen.\text{debito} - bench.\text{debito}| > 0.01$ | HIGH (Movement Error) |
| `CREDITO_MISMATCH` | $|gen.\text{credito} - bench.\text{credito}| > 0.01$ | HIGH (Movement Error) |
| `SALDO_FINAL_MISMATCH` | $|gen.\text{saldo\_final} - bench.\text{saldo\_final}| > 0.01$ | HIGH (Ending Balance Error) |

### 3.6 Global Totals Verification
In addition to row-by-row comparisons, the comparator validates high-level global totals:
- Total Debits ($\sum \text{debito}$)
- Total Credits ($\sum \text{credito}$)
- Initial Debit Balance Total ($\sum \text{saldo\_inicial\_debito}$)
- Initial Credit Balance Total ($\sum \text{saldo\_inicial\_credito}$)
- Final Debit Balance Total ($\sum \text{saldo\_final\_debito}$)
- Final Credit Balance Total ($\sum \text{saldo\_final\_credito}$)

If global totals diverge by $> 0.01$ COP, a global discrepancy is flagged.

---

## 4. Data Structures & TypeScript Interface Contracts

```typescript
/**
 * Options for configuring the trial balance comparison execution.
 */
export interface ComparisonOptions {
  /** Numerical float tolerance threshold in COP (default: 0.01) */
  tolerance?: number;
  /** Whether to compare third-party detail rows (default: true) */
  compareThirdPartyDetails?: boolean;
  /** Whether to compare account summary rows (default: true) */
  compareAccountSummaries?: boolean;
  /** Ignore unexpected 0-balance rows in generated data (default: true) */
  ignoreZeroBalanceUnmatched?: boolean;
  /** Specific account levels to inspect, e.g. [1, 2, 3, 4, 5] (default: all) */
  accountLevels?: number[];
}

/**
 * Discrepancy failure types.
 */
export type DiscrepancyType =
  | 'MISSING_IN_GENERATED'
  | 'UNEXPECTED_IN_GENERATED'
  | 'SALDO_INICIAL_MISMATCH'
  | 'DEBITO_MISMATCH'
  | 'CREDITO_MISMATCH'
  | 'SALDO_FINAL_MISMATCH'
  | 'TOTALS_MISMATCH';

/**
 * Variance details for a specific numerical field.
 */
export interface FieldDiff {
  expected: number; // Value from Benchmark Excel
  actual: number;   // Value from Generated Trial Balance
  diff: number;     // actual - expected
}

/**
 * Detailed discrepancy report item.
 */
export interface Discrepancy {
  key: string;
  account_code: string;
  account_name?: string;
  document_number?: string | null;
  third_party_name?: string | null;
  type: DiscrepancyType;
  details: {
    saldo_inicial?: FieldDiff;
    debito?: FieldDiff;
    credito?: FieldDiff;
    saldo_final?: FieldDiff;
  };
}

/**
 * Comprehensive match statistics.
 */
export interface MatchStats {
  total_benchmark_rows: number;
  total_generated_rows: number;
  matched_keys: number;
  exact_matches: number;         // 0.00 COP diff across all fields
  tolerance_matches: number;     // <= 0.01 COP diff across all fields
  mismatched_rows: number;       // > 0.01 COP diff on at least one field
  missing_in_generated: number;
  unexpected_in_generated: number;
  total_discrepancies: number;
}

/**
 * Overall Trial Balance Comparison Result.
 */
export interface ComparisonResult {
  passed: boolean;              // true iff total_discrepancies === 0
  tolerance: number;            // Applied tolerance (0.01 COP)
  stats: MatchStats;
  discrepancies: Discrepancy[];
  totals_comparison?: {
    expected: TrialBalanceReport['totals'];
    actual: TrialBalanceReport['totals'];
    passed: boolean;
  };
}
```

---

## 5. Proposed Implementation Strategy for `src/lib/verification/trial-balance-comparator.ts`

The module `src/lib/verification/trial-balance-comparator.ts` will provide the core export function:

```typescript
export function compareTrialBalances(
  generatedReport: TrialBalanceReport | TrialBalanceItem[],
  benchmarkRows: BenchmarkTrialBalanceRow[],
  options?: ComparisonOptions
): ComparisonResult
```

### 5.1 Algorithmic Execution Steps

```
[Input: Generated Report & Benchmark Rows]
               │
               ▼
[Step 1: Parse & Index Benchmark Rows into BenchmarkMap (by Composite Key)]
               │
               ▼
[Step 2: Parse & Index Generated Rows into GeneratedMap (by Composite Key)]
               │
               ▼
[Step 3: Collect All Unique Composite Keys (Set Union)]
               │
               ▼
[Step 4: Iterate over Unique Keys]
 ├── Case A: Key in both Benchmark & Generated
 │    └── Perform 4-Point Field Comparison (|gen - bench| <= 0.01)
 │         ├── All within tolerance -> Increment exact_matches / tolerance_matches
 │         └── Any diff > 0.01 -> Push Mismatch Discrepancy & increment mismatched_rows
 │
 ├── Case B: Key in Benchmark only
 │    └── Push MISSING_IN_GENERATED Discrepancy & increment missing_in_generated
 │
 └── Case C: Key in Generated only
      └── Check if zero-balance & ignore option
           ├── Ignore -> Skip
           └── Push UNEXPECTED_IN_GENERATED Discrepancy & increment unexpected_in_generated
               │
               ▼
[Step 5: Compute Global Totals & Set passed = (total_discrepancies === 0)]
               │
               ▼
[Step 6: Return ComparisonResult]
```

---

## 6. Verification & Automated Test Strategy

To ensure high confidence and regression safety for `trial-balance-comparator.ts`:

1. **Unit Test Suite**: `tests/verification/trial-balance-comparator.test.ts` (or `src/lib/verification/trial-balance-comparator.test.ts`) using Vitest.
2. **Test Scenarios**:
   - **Perfect Match Test**: Generated data exactly matches benchmark rows $\rightarrow$ `passed: true`, `total_discrepancies: 0`.
   - **Float Tolerance Test**: Differences of $0.005$ COP or $0.010$ COP pass without triggering discrepancies.
   - **Float Threshold Violation Test**: Difference of $0.015$ COP triggers `SALDO_INICIAL_MISMATCH` / `DEBITO_MISMATCH` / `CREDITO_MISMATCH` / `SALDO_FINAL_MISMATCH`.
   - **Missing Row Test**: Generated data omits a benchmark row $\rightarrow$ `MISSING_IN_GENERATED`.
   - **Unexpected Row Test**: Generated data includes extra non-zero row $\rightarrow$ `UNEXPECTED_IN_GENERATED`.
   - **Document Normalization Test**: Document numbers with hyphens (`900.123.456-1` vs `9001234561`) match properly.

---

## 7. Conclusion

The comparison algorithm design fully addresses the requirements of Milestone 3:
- Account-by-account and third-party-by-third-party composite matching.
- Precise float numerical tolerance handling ($\le 0.01$ COP).
- Robust, strongly-typed TypeScript interfaces (`ComparisonResult`, `Discrepancy`, `MatchStats`).
- Clear implementation strategy ready for execution by worker agents in `src/lib/verification/trial-balance-comparator.ts`.
