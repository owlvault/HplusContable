## 2026-08-03T19:00:07Z
You are the Tier 4 Test Writer.
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\test_writer_tier4

MANDATORY INSTRUCTIONS:
1. Read these scope files:
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\TEST_INFRA.md
2. Create tests/e2e/tier4-real-world-comparison.test.ts containing at least 5 Vitest test cases covering Tier 4 Real-World Backup Comparison:
   - Ingestion of 2024 historical Excel backup files from C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup (or mock fallback if directory unavailable)
   - Programmatic generation of 2024 trial balance
   - Comparison against historical backup Balance de prueba por tercero report
   - Verifying balance identity (debts = credits, difference <= 0.01 COP)
3. Exclusive write ownership: You ONLY write to tests/e2e/tier4-real-world-comparison.test.ts.
4. MANDATORY INTEGRITY WARNING:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
5. Write your handoff report handoff.md in your working directory and send a message back when complete.
