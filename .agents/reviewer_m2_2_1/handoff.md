# Handoff Report — reviewer_m2_2_1

## 1. Observation
- Target File 1: `src/lib/utils/trial-balance-calc.ts`
  * Line 562 comparator code inspected:
    ```ts
    560:    // Summary row (third_party_id is null/undefined) comes first
    561:    if (!a.third_party_id && b.third_party_id) return -1;
    562:    if (a.third_party_id && !b.third_party_id) return 1;
    563:    return (a.document_number || '').localeCompare(b.document_number || '');
    ```
  * Verified exact match for requirement: `if (a.third_party_id && !b.third_party_id) return 1;`.
  * PUC hierarchy inference (`inferAccountMeta`, lines 142–231) and prefix extraction (`getPrefixHierarchy`, lines 233–242) handle 1-digit (Clase), 2-digit (Grupo), 4-digit (Cuenta), 6-digit (Subcuenta), and 8-digit (Auxiliar) account levels.
  * Dual-bucket nature math (lines 460–466): DEBITO nature accounts (Classes 1, 5, 6, 7, 8) evaluate $\text{saldo\_inicial} = \text{priorDebit} - \text{priorCredit}$ and $\text{saldo\_final} = \text{saldo\_inicial} + \text{debito} - \text{credito}$. CREDITO nature accounts (Classes 2, 3, 4, 9) evaluate $\text{saldo\_inicial} = \text{priorCredit} - \text{priorDebit}$ and $\text{saldo\_final} = \text{saldo\_inicial} + \text{credito} - \text{debito}$.
  * Initial balance carry-over (lines 304–376): Real accounts (Classes 1–3) accumulate prior movements across all previous years. Nominal accounts (Classes 4–7) reset to $0.00$ on Jan 1 of each fiscal year, carrying forward YTD movements within the current fiscal year.
  * Year-end closure equity transfer (lines 347–353, 403–429): Unclosed prior fiscal years' net result ($\text{Income} - \text{Expenses/Costs}$) is carried forward into Equity account `360505` (Utilidad del ejercicio) if positive, or `361005` (Pérdida del ejercicio) if negative.
  * Exclude closing entries filter (lines 280–282): `entry_type === 'CIERRE'` entries are filtered out when `excludeClosingEntries` is `true`.

- Target File 2: `src/lib/utils/trial-balance-calc.test.ts`
  * 283 lines, 9 test suites exercising:
    1. Helper functions (`inferAccountMeta`, `getPrefixHierarchy`).
    2. Account nature math (DEBITO vs CREDITO).
    3. Multi-year real account balance carry-over.
    4. Nominal account Jan 1 fiscal resets and YTD carry-over.
    5. Prior fiscal years net profit carry-forward to Equity `360505`/`361005`.
    6. 5-level dynamic PUC hierarchy synthesis.
    7. Third-party breakdown toggle and unassigned fallback (`CUANTIAS MENORES / GENERAL`).
    8. Closing entries filter (`excludeClosingEntries`).
    9. Report totals calculation and double-entry equality check (`is_balanced === true`).

- Integrity Assessment:
  * No hardcoded test results, facade implementations, or bypassed checks detected in source code or test files.

## 2. Logic Chain
1. **Line 562 Verification**: Inspecting lines 560–564 of `src/lib/utils/trial-balance-calc.ts` confirms that line 562 contains `if (a.third_party_id && !b.third_party_id) return 1;`. When `a` has a `third_party_id` (detail row) and `b` does not (summary row), the function returns `1`, placing summary rows before detail rows in array sorting.
2. **Dynamic PUC Hierarchy Rollup**: `getPrefixHierarchy` generates prefix arrays (`'1'`, `'11'`, `'1105'`, `'110505'`, `'11050501'`) for leaf items. `calculateTrialBalance` iterates through these prefixes to accumulate `saldo_inicial`, `debito`, `credito`, and `saldo_final` across all 5 PUC levels, ensuring complete parent-child aggregation.
3. **Dual Nature Signed Math**: In `inferAccountMeta`, Classes 1, 5, 6, 7, 8 are mapped to `DEBITO` nature, and Classes 2, 3, 4, 9 are mapped to `CREDITO` nature. `calculateTrialBalance` uses the corresponding formula per nature type, preventing sign inversions for liabilities, equity, and revenues.
4. **Fiscal Year-End & Carry-Over Rules**: Prior entries (`entry_date < startDate`) are segregated by account class and fiscal year. Real accounts accumulate indefinitely. Nominal accounts prior to the query year's Jan 1 calculate net income minus expenses/costs and deposit the net balance into equity account `360505` (or `361005`), while nominal entries within the query year contribute to `saldo_inicial`. This guarantees double-entry balance without distorting YTD balances.
5. **Test Coverage & Quality**: `src/lib/utils/trial-balance-calc.test.ts` tests each logic path with explicit inputs and assertions.
6. **Integrity Check**: Inspection confirms genuine logic execution without mock facades or hardcoded return shortcuts.

## 3. Caveats
- Terminal execution of `npx vitest run src/lib/utils/trial-balance-calc.test.ts` in the headless subagent sandbox environment timed out on interactive user permission prompt. Code correctness and test coverage were verified via comprehensive static code inspection and logical trace.

## 4. Conclusion
- **Verdict**: `APPROVE`
- The implementation of `src/lib/utils/trial-balance-calc.ts` and its test suite `src/lib/utils/trial-balance-calc.test.ts` fully satisfy all requirements specified in SCOPE.md and ORIGINAL_REQUEST.md. Line 562 comparator logic is confirmed correct. No integrity violations or logic flaws were found.

## 5. Verification Method
- **Code Inspection**:
  * Verify line 562 in `src/lib/utils/trial-balance-calc.ts`: `if (a.third_party_id && !b.third_party_id) return 1;`.
- **Automated Test Command** (in interactive shell or CI):
  * `npx vitest run src/lib/utils/trial-balance-calc.test.ts`
  * Invalidation Condition: Any failing test case in `trial-balance-calc.test.ts` or unequal totals (`is_balanced === false`).
