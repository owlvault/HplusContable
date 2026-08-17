# Adversarial Stress Testing Analysis — Milestone 3 Trial Balance Comparator

**Target Module**: `src/lib/verification/trial-balance-comparator.ts` & `src/lib/ingestion/readonly-guard.ts`  
**Challenger Agent**: `challenger_m3_2`  
**Date**: 2026-08-03  
**Final Verdict**: **REQUEST_CHANGES**

---

## Executive Summary

An adversarial stress test was conducted on `src/lib/verification/trial-balance-comparator.ts` and associated read-only infrastructure routines. While `worker_m3_1` established solid initial architecture and test coverage, empirical code tracing and edge-case probing identified **5 significant defects and vulnerabilities** — including 1 CRITICAL data loss bug, 2 HIGH severity logic mismatches, and 2 MEDIUM severity taxonomy/error-handling flaws.

Due to these findings, the verification suite in its current state will produce false positives, misclassify discrepancy types, and silently drop accounting items during comparison.

---

## Detailed Findings

### Finding 1 [CRITICAL]: Composite Key Collision & Data Loss for Multiple Third Parties with Missing/Generic Document Numbers

- **Location**: `src/lib/verification/trial-balance-comparator.ts`, lines 188–213 & lines 467–476.
- **Vulnerability Mechanism**:
  `normalizeDocumentNumber` maps `null`, `undefined`, `""`, `"0"`, `"GENERAL"`, and `"CUANTIAS MENORES"` to `"0"`.
  When `isDetail` is `true`, `buildCompositeKey` constructs key `TP::<account_code>::0`.
  In `compareTrialBalances` (lines 467–476):
  ```typescript
  const generatedMap = new Map<string, TrialBalanceItem>();
  for (const gItem of generatedItems) {
    ...
    const key = buildCompositeKey(gItem.code, gItem.document_number, isDetail);
    generatedMap.set(key, gItem); // OVERWRITES PREVIOUS ENTRY WITH SAME KEY
  }
  ```
- **Empirical Trace Proof**:
  - Suppose account `13050501` has two third-party items:
    - Item 1: `{ code: '13050501', third_party_id: 'tp-1', document_number: null, debito: 500000 }` -> Key: `TP::13050501::0`
    - Item 2: `{ code: '13050501', third_party_id: 'tp-2', document_number: 'CUANTIAS MENORES', debito: 300000 }` -> Key: `TP::13050501::0`
  - Loop iteration 1 sets `generatedMap.set('TP::13050501::0', Item 1)`.
  - Loop iteration 2 sets `generatedMap.set('TP::13050501::0', Item 2)` — **Item 1 is silently overwritten and lost**.
  - Result: Item 1's 500,000 COP balance disappears from comparison. `generatedMap.size` reports 1 row instead of 2.
- **Blast Radius**: HIGH/CRITICAL. Any accounting period with multiple sub-entities or transactions lacking NIT numbers (e.g. cash sales, minor transactions) experiences silent data deletion during verification.
- **Suggested Defense**:
  Differentiate third parties missing NITs by incorporating `third_party_id` or `third_party_name` (or a fallback index/uuid) into composite keys when `normDoc === '0'`, or maintain a list/multi-map for un-indexed third parties rather than a single-key map overwrite.

---

### Finding 2 [HIGH]: Asymmetrical Account Code Normalization (Dots/Dashes Punctuation Mismatch)

- **Location**: `src/lib/verification/trial-balance-comparator.ts`, line 180 vs line 354.
- **Vulnerability Mechanism**:
  In `parseBenchmarkTrialBalanceBuffer` (line 354), Excel cell raw codes are sanitized using `.replace(/[^\w]/g, '')`, stripping dots, hyphens, and slashes (`"1105.05"` $\rightarrow$ `"110505"`).
  However, `normalizeAccountCode` (lines 180–183) only executes `.trim().replace(/\s+/g, '')`, retaining dots and hyphens (`"1105.05"` $\rightarrow$ `"1105.05"`).
- **Empirical Trace Proof**:
  - Benchmark Excel contains account code `"1105.05"`. Parser normalizes it to `"110505"`. Benchmark key: `'ACC::110505'`.
  - Generated input contains `TrialBalanceItem` with `code = "1105.05"`. `buildCompositeKey` calls `normalizeAccountCode("1105.05")`, returning `"1105.05"`. Generated key: `'ACC::1105.05'`.
  - `compareTrialBalances` compares `'ACC::110505'` vs `'ACC::1105.05'`.
  - Result: Comparison fails with 2 false positive discrepancies (`UNEXPECTED_IN_GENERATED` for `'1105.05'` and `MISSING_IN_GENERATED` for `'110505'`).
- **Blast Radius**: HIGH. Formatted account codes (common in ERP exports with subcuenta dots) fail automated comparison despite matching numbers.
- **Suggested Defense**:
  Standardize `normalizeAccountCode` to strip non-alphanumeric punctuation uniformly across both parser and comparator:
  `return code.trim().replace(/[^a-zA-Z0-9]/g, '');`

---

### Finding 3 [HIGH]: Asymmetric Inactive Zero-Balance Account Filtering

- **Location**: `src/lib/verification/trial-balance-comparator.ts`, lines 584–591 & lines 568–584.
- **Vulnerability Mechanism**:
  `ignoreZeroBalanceUnmatched` (line 588) only suppresses unmatched accounts in the `!bench && gen` branch (unexpected generated items with 0 balance).
  It does **not** inspect `bench && !gen` (benchmark items present in historical Excel report with 0.00 balances, but omitted from generated trial balance engine output).
  Additionally, `isZeroBalance` uses strict equality `=== 0` on floating point numbers instead of `Math.abs(val) <= tolerance`.
- **Empirical Trace Proof**:
  - Historical Excel report prints inactive chart accounts with `saldo_inicial: 0, debito: 0, credito: 0, saldo_final: 0`.
  - Engine omits inactive zero-balance accounts.
  - `compareTrialBalances` executes `else if (bench && !gen)`.
  - Result: Generates `MISSING_IN_GENERATED` discrepancy and fails verification even when `ignoreZeroBalanceUnmatched: true`.
- **Blast Radius**: MEDIUM-HIGH. Prevents verification against standard ERP exports that list inactive master chart accounts with zero balances.
- **Suggested Defense**:
  Check if `bench` has zero balances (`saldo_inicial`, `debito`, `credito`, `saldo_final` all within tolerance of 0) when `bench && !gen`, and ignore it if `ignoreZeroBalanceUnmatched` is `true`.

---

### Finding 4 [MEDIUM]: Scalar Discrepancy Taxonomy Overwriting for Multi-Column Mismatches

- **Location**: `src/lib/verification/trial-balance-comparator.ts`, lines 523–556.
- **Vulnerability Mechanism**:
  When an account row has balance mismatches in multiple columns (e.g. both `debito` and `credito`), sequential `if` statements overwrite the scalar `type` field (`type = 'DEBITO_MISMATCH'`, then `type = 'CREDITO_MISMATCH'`).
- **Empirical Trace Proof**:
  - Account `110505` has expected debit 100, actual debit 200 AND expected credit 50, actual credit 80.
  - Line 527 sets `type = 'DEBITO_MISMATCH'`.
  - Line 534 sets `type = 'CREDITO_MISMATCH'` (overwriting `DEBITO_MISMATCH`).
  - Result: Discrepancy object reports `type: 'CREDITO_MISMATCH'`, concealing the debit mismatch.
- **Blast Radius**: MEDIUM. Reduces diagnostic fidelity of reports.
- **Suggested Defense**:
  Use a compound discrepancy type or priority ranking (or array of mismatch types) when multiple columns fail.

---

### Finding 5 [MEDIUM]: Misleading Error Classification in Read-Only Guard

- **Location**: `src/lib/ingestion/readonly-guard.ts`, lines 96–97.
- **Vulnerability Mechanism**:
  In `readBackupFileBuffer`, any OS file read error (`ENOENT`, `EACCES`, `EPERM`, `EBUSY`) caught during `fs.openSync` or `fs.readSync` is rethrown as `ReadOnlyViolationError`.
- **Empirical Trace Proof**:
  - File access denied by OS permission error (`EACCES`).
  - Caught and thrown as `ReadOnlyViolationError("Failed to read backup file safely...")`.
  - Test runner interprets this as an infrastructure mutation violation rather than a permission/IO failure.
- **Blast Radius**: LOW-MEDIUM. Error diagnosis confusion.
- **Suggested Defense**:
  Differentiate IO/permission errors (`FileSystemError` / `BackupFileReadError`) from file mutation violations (`ReadOnlyViolationError`).

---

## Stress Test Matrix

| Scenario | Tested Input | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Duplicate Missing Doc Third Parties | 2 items with `doc=null` on account `130505` | Both items retained & checked | Item 1 overwritten in `Map.set`, lost from stats | **FAIL** (Finding 1) |
| Formatted Account Code (`1105.05`) | Code `"1105.05"` in gen vs benchmark | Clean match on `"110505"` | False `MISSING` + `UNEXPECTED` discrepancies | **FAIL** (Finding 2) |
| Inactive Zero-Balance Benchmark Account | Benchmark has 0.00 row, gen omits it | Ignored when `ignoreZeroBalanceUnmatched=true` | Flagged as `MISSING_IN_GENERATED` | **FAIL** (Finding 3) |
| Float Noise in Zero-Balance Check | `gen.saldo_inicial = 1e-15` | Recognized as zero balance | `=== 0` check fails, flagged as unexpected | **FAIL** (Finding 3) |
| Multi-Field Balance Mismatch | Both debit & credit mismatched | Clear compound error report | `type` overwritten to last evaluated field | **FAIL** (Finding 4) |
| File Read Access Error | `EACCES` permission error on file read | File I/O exception | Mischaracterized as `ReadOnlyViolationError` | **FAIL** (Finding 5) |

---

## Verdict & Recommendation

**Verdict**: **REQUEST_CHANGES**

`src/lib/verification/trial-balance-comparator.ts` requires structural fixes for key collision prevention, code normalization consistency, and symmetric zero-balance handling before it can be safely relied upon for production verification.
