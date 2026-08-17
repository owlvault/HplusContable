# Handoff Report — explorer_m3_2 (Trial Balance Comparison Algorithm Design)

## 1. Observation
- **Inspected Files**:
  - `src/actions/reportes.ts` (lines 158–251: `getTrialBalance` server action wrapper).
  - `src/lib/utils/trial-balance-calc.ts` (lines 42–83: `TrialBalanceItem` and `TrialBalanceReport` data structures; lines 244–633: `calculateTrialBalance` engine logic).
  - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md` (Acceptance criteria lines 31–34).
  - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md` (Feature 6 & Milestone 3 lines 10–27).
  - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m3\SCOPE.md` (Task M3.2 specifications & interface contracts lines 26–40).
  - `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m2\handoff.md` (M2 trial balance engine verification).
- **Core Findings**:
  - `calculateTrialBalance()` outputs `TrialBalanceReport & TrialBalanceItem[]` containing 4 primary COP balance fields (`saldo_inicial`, `debito`, `credito`, `saldo_final`) along with account codes, PUC levels, and third-party details (`third_party_id`, `document_number`, `third_party_name`).
  - Historical benchmark rows (`BenchmarkTrialBalanceRow[]`) contain equivalent balance fields extracted from `Balance de prueba por tercero-*.xlsx`.

## 2. Logic Chain
1. **Matching Requirements**:
   - Generated reports contain both Account Summary rows (levels 1–5) and Third-Party Detail rows.
   - Therefore, matching rows requires a **Composite Key**:
     - Summary Rows: `ACC::<account_code>`
     - Third-Party Detail Rows: `TP::<account_code>::<normalized_document_number>`
   - Document numbers are normalized by converting to uppercase and stripping formatting characters (`.`, `-`, spaces).
2. **Tolerance Logic**:
   - Acceptance criteria require floating-point tolerance $\le 0.01$ COP.
   - For all 4 numerical fields (`saldo_inicial`, `debito`, `credito`, `saldo_final`), equality is evaluated as $|gen - bench| \le 0.01 + 1\times 10^{-9}$.
3. **Discrepancy Taxonomy & Statistics**:
   - Discrepancies are categorized into 6 distinct failure types (`MISSING_IN_GENERATED`, `UNEXPECTED_IN_GENERATED`, `SALDO_INICIAL_MISMATCH`, `DEBITO_MISMATCH`, `CREDITO_MISMATCH`, `SALDO_FINAL_MISMATCH`).
   - Summary results are aggregated into a strongly-typed `ComparisonResult` containing detailed `MatchStats` and `passed` flag (`total_discrepancies === 0`).

## 3. Caveats
- Benchmark Excel parsing is handled upstream by M3.1 (`BenchmarkTrialBalanceRow[]`). The comparator relies on `BenchmarkTrialBalanceRow` input format.
- Unmatched zero-balance rows in generated data can be ignored via `ignoreZeroBalanceUnmatched: true` option to avoid false positives when historical Excel omits inactive accounts.

## 4. Conclusion
- The comparison algorithm, float tolerance logic ($\le 0.01$ COP), data structures (`ComparisonResult`, `Discrepancy`, `MatchStats`, `FieldDiff`), and module strategy for `src/lib/verification/trial-balance-comparator.ts` are fully designed and documented in `analysis.md`.

## 5. Verification Method
- **File Inspection**:
  - Analysis Report: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\analysis.md`
  - Handoff Report: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\handoff.md`
  - Briefing: `C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_m3_2\BRIEFING.md`
- **Future Test Execution**: Once implemented by M3.2 worker, verify with `npx vitest run tests/verification/trial-balance-comparator.test.ts`.
