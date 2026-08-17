# Handoff Report — challenger_m2_2_2

## 1. Observation

- **Target File**: `src/lib/utils/trial-balance-calc.ts`
- **Line 562 Inspection**:
  ```typescript
  556:   filteredItems.sort((a, b) => {
  557:     if (a.code !== b.code) {
  558:       return a.code.localeCompare(b.code);
  559:     }
  560:     // Summary row (third_party_id is null/undefined) comes first
  561:     if (!a.third_party_id && b.third_party_id) return -1;
  562:     if (a.third_party_id && !b.third_party_id) return 1;
  563:     return (a.document_number || '').localeCompare(b.document_number || '');
  564:   });
  ```
- **Context & Fix History**: In Iteration 1, `challenger_m2_2` flagged a bug where line 562 contained `if (a.third_party_id && !a.third_party_id) return 1;`. That condition was a logical impossibility (`a.third_party_id && !a.third_party_id` is always false), causing detail rows to fall through to `localeCompare(document_number)` rather than being placed after summary rows. The condition is now updated to `if (a.third_party_id && !b.third_party_id) return 1;`.

- **Multi-Period & Fiscal Closure Implementation (`calculateTrialBalance`)**:
  - **Real Accounts (Classes 1, 2, 3)**: Lines 304-324 accumulate all prior transactions (`dateStr < startDateStr`) across past years into `priorDebit` / `priorCredit`.
  - **Nominal Accounts (Classes 4, 5, 6, 7)**:
    - Intra-year YTD (`dateStr >= startOfYearStr`): Lines 326-346 accumulate prior transactions within the same fiscal year into `priorDebit` / `priorCredit`.
    - Prior fiscal years (`dateStr < startOfYearStr`): Lines 347-353 reset nominal account initial balances to $0.00$ on Jan 1 and accumulate net profit/loss into `priorFiscalYearsNetResult`.
  - **Equity Net Profit/Loss Transfer**: Lines 402-429 transfer `priorFiscalYearsNetResult` to Equity account `360505` (`Utilidad del ejercicio`, if profit > 0) or `361005` (`Pérdida del ejercicio`, if loss < 0).
  - **Closing Entries Filter**: Lines 280-282 (`excludeClosingEntries: true` by default) ignore `entry_type === 'CIERRE'` lines to avoid double-counting manual closing vouchers against automatic multi-year carryover calculations.

- **Test Suite Files**:
  - `src/lib/utils/trial-balance-calc.test.ts` (283 lines, 9 test cases covering nature signed math, multi-year real carryover, nominal Jan 1 reset, equity profit carryover, 5-level PUC hierarchy rollup, third-party toggle, and double-entry equality).
  - `src/lib/utils/closing-calc.ts` & `closing-calc.test.ts` (51 lines, tests closing voucher generation).
  - `src/actions/reportes.test.ts` (141 lines, tests server action wrapper `getTrialBalance`).
  - `scratch/verify_all.ts` (Empirical verification script covering edge cases).

---

## 2. Logic Chain

1. **Verification of Line 562 Sort Comparator**:
   - Goal: Ensure that for any account code `C`, the account summary row (`third_party_id === null`) appears BEFORE all third-party detail rows (`third_party_id !== null`).
   - Case analysis for `a` vs `b` when `a.code === b.code`:
     - If `a` has no `third_party_id` and `b` has `third_party_id`: Line 561 matches `!a.third_party_id && b.third_party_id` -> returns `-1` (`a` before `b`).
     - If `a` has `third_party_id` and `b` has no `third_party_id`: Line 562 matches `a.third_party_id && !b.third_party_id` -> returns `1` (`a` after `b`).
     - If both or neither have `third_party_id`: lines 561 & 562 return false, falling through to line 563 to sort by `document_number`.
   - Conclusion: The fix at line 562 correctly satisfies the sort order contract.

2. **Verification of Multi-Period Carryover & Fiscal Year-End Closure Mechanics**:
   - **Real Accounts**: A transaction in 2024 for Class 1 (Activo) remains in `priorDebit` when querying 2026. `saldo_inicial = priorDebit - priorCredit`. This correctly maintains multi-year cumulative balances.
   - **Nominal Accounts (Classes 4-7) Jan 1 Reset**: Any nominal transaction prior to `startOfYearStr` (e.g. 2025 transactions when querying 2026) is excluded from `leafMap` for nominal accounts. Thus, `saldo_inicial` for 41350501, 51050601, 61350501 on Jan 1 is $0.00$.
   - **Equity Carryover**: Net income minus expenses/costs across prior years is summed into `priorFiscalYearsNetResult`.
     - Positive net result -> credited to `360505` (`Utilidad del ejercicio`).
     - Negative net result -> debited to `361005` (`Pérdida del ejercicio`).
     - `saldo_inicial` calculation for `360505` / `361005` correctly reflects the accumulated equity position, and global report totals `totals.saldo_inicial_debito` and `totals.saldo_inicial_credito` remain equal (`totals.is_balanced === true`).
   - **Intra-year YTD Carryover**: When querying March 2026, transactions in Jan and Feb 2026 fall into `dateStr >= startOfYearStr` and `dateStr < startDateStr`, populating `saldo_inicial` for March 2026 nominal accounts correctly.

---

## 3. Caveats

- **Default Closing Filter**: `excludeClosingEntries` defaults to `true`. If manual closing journal entries (`entry_type: 'CIERRE'`) exist in the database and `excludeClosingEntries` is set to `false`, nominal accounts will show 0 initial balances because the `CIERRE` entries zeroed them out, and profit will sit in `360505` via the explicit entry. Both modes produce correct trial balance totals.
- **No code changes were made**: The agent operated under review-only mode and validated existing implementation files.

---

## 4. Conclusion

- **Verdict**: **`APPROVE`**
- **Summary**:
  1. Line 562 in `src/lib/utils/trial-balance-calc.ts` (`if (a.third_party_id && !b.third_party_id) return 1;`) is verified correct.
  2. Multi-period initial balance carryover and fiscal year-end annual closure mechanics (Classes 4-7 reset to 0 on Jan 1, net profit/loss carried to `360505` / `361005`) are fully stress-tested, mathematically sound, and compliant with `SCOPE.md`.

---

## 5. Verification Method

To independently verify:

1. **Inspect Code**:
   - `src/lib/utils/trial-balance-calc.ts` (lines 280-430 for carryover/closure, lines 556-564 for third-party detail sorting).
2. **Run Unit Test Suites**:
   - `npx vitest run src/lib/utils/trial-balance-calc.test.ts`
   - `npx vitest run src/lib/utils/closing-calc.test.ts`
   - `npx vitest run src/actions/reportes.test.ts`
3. **Run Standalone Verification Script**:
   - `node scratch/verify_all.ts`
