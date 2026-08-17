# Handoff Report — Adversarial Stress Testing of Milestone 3 Trial Balance Comparator

**Agent ID**: challenger_m3_2  
**Working Directory**: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\challenger_m3_2`  
**Milestone**: Milestone 3 (Automated Verification & Comparison Suite)  
**Date**: 2026-08-03  
**Final Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

Adversarial stress testing was conducted on `src/lib/verification/trial-balance-comparator.ts` and `src/lib/ingestion/readonly-guard.ts`. Code inspection and empirical step-by-step traces revealed 5 concrete defects:

1. **Composite Key Collision & Silent Data Loss (CRITICAL)**:
   - File: `src/lib/verification/trial-balance-comparator.ts`, lines 188–213 & 467–476.
   - `normalizeDocumentNumber` maps `null`, `undefined`, `""`, `"0"`, `"GENERAL"`, and `"CUANTIAS MENORES"` to `"0"`.
   - `buildCompositeKey` constructs key `TP::<code me>::0`.
   - `compareTrialBalances` executes `generatedMap.set(key, gItem)`, which **overwrites** prior items sharing key `TP::<code me>::0`.
   - Result: Earlier third-party records lacking NIT numbers are silently erased from comparison memory.

2. **Asymmetric Account Code Normalization (HIGH)**:
   - File: `src/lib/verification/trial-balance-comparator.ts`, line 180 vs line 354.
   - Benchmark parser strips all non-alphanumeric punctuation with `.replace(/[^\w]/g, '')` (`"1105.05"` $\rightarrow$ `"110505"`).
   - `normalizeAccountCode` leaves dots and hyphens intact (`"1105.05"` $\rightarrow$ `"1105.05"`).
   - Result: Formatted account codes produce mismatch keys (`ACC::110505` vs `ACC::1105.05`), generating false positive error discrepancies.

3. **Asymmetric Inactive Zero-Balance Account Filtering (HIGH)**:
   - File: `src/lib/verification/trial-balance-comparator.ts`, lines 584–591 & 568–584.
   - `ignoreZeroBalanceUnmatched` only suppresses unexpected items when `!bench && gen`.
   - Inactive benchmark accounts present in historical Excel reports (with 0.00 balances across all columns) but omitted from generated items (`bench && !gen`) trigger false `MISSING_IN_GENERATED` discrepancies.
   - Zero-balance check uses strict equality `=== 0` on unrounded floats rather than `Math.abs(val) <= tolerance`.

4. **Scalar Discrepancy Taxonomy Overwriting (MEDIUM)**:
   - File: `src/lib/verification/trial-balance-comparator.ts`, lines 523–556.
   - Sequential `if` checks overwrite `type` (`DEBITO_MISMATCH` overwritten by `CREDITO_MISMATCH`), concealing multi-column mismatches.

5. **Misleading Read-Only Guard Exception Masking (MEDIUM)**:
   - File: `src/lib/ingestion/readonly-guard.ts`, lines 96–97.
   - OS file permission and I/O errors (`EACCES`, `ENOENT`) in `readBackupFileBuffer` are wrapped and rethrown as `ReadOnlyViolationError`.

---

## 2. Logic Chain

1. **Key Collision Logic**:
   - `generatedMap` is a single `Map<string, TrialBalanceItem>`.
   - When multiple third-party items share the same account code and have null or generic document numbers (`'GENERAL'`, `'CUANTIAS MENORES'`), `normalizeDocumentNumber` returns `'0'`.
   - `buildCompositeKey` outputs `TP::<account_code>::0` for all of them.
   - `Map.set` overwrites previous entries sharing the key.
   - Therefore, $N-1$ items are deleted from comparison, falsifying match statistics and missing real balance errors.

2. **Punctuation Normalization Logic**:
   - `parseBenchmarkTrialBalanceBuffer` uses `.replace(/[^\w]/g, '')` on cell string values.
   - `normalizeAccountCode` uses `.trim().replace(/\s+/g, '')`.
   - Input `"1105.05"` is parsed as `"110505"` by benchmark parser, but stays `"1105.05"` when passed in `TrialBalanceItem.code`.
   - Keys do not match $\rightarrow$ False positive discrepancy.

3. **Zero-Balance Asymmetry Logic**:
   - ERP systems like Siigo print full account charts including inactive accounts with 0.00 balances.
   - Query engines omit inactive accounts.
   - `compareTrialBalances` only checks `ignoreZeroBalanceUnmatched` for `!bench && gen`.
   - For `bench && !gen`, zero-balance benchmark accounts are unconditionally flagged as `MISSING_IN_GENERATED`.

---

## 3. Caveats

- **No Code Modifications**: As a Challenger agent (review-only role), no changes were made to `src/lib/verification/trial-balance-comparator.ts`.
- **Existing Test Pass**: The basic Vitest suite written by `worker_m3_1` passes because its test fixtures use unique document numbers and pre-cleaned account codes without dots/punctuation.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

`src/lib/verification/trial-balance-comparator.ts` contains critical key collision flaws, asymmetric normalization rules, and incomplete zero-balance filtering. Worker `worker_m3_1` or an implementer must remediate these findings before Milestone 3 can be approved.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Composite Key Collision (Finding 1)**:
   Trace `buildCompositeKey('13050501', null, true)` and `buildCompositeKey('13050501', 'CUANTIAS MENORES', true)`. Both evaluate to `'TP::13050501::0'`. Passing both in `generatedItems` will result in `generatedMap.size === 1`.

2. **Verify Account Normalization Mismatch (Finding 2)**:
   Compare `normalizeAccountCode('1105.05')` (returns `'1105.05'`) against `strCodigo` in `parseBenchmarkTrialBalanceBuffer` line 354 for `'1105.05'` (returns `'110505'`).

3. **Verify Zero-Balance Asymmetry (Finding 3)**:
   Pass `benchmarkInput = [{ account_code: '999999', saldo_inicial: 0, debito: 0, credito: 0, saldo_final: 0 }]` and `generatedInput = []` with `ignoreZeroBalanceUnmatched: true`. `compareTrialBalances` will return `passed: false` with a `MISSING_IN_GENERATED` discrepancy.
