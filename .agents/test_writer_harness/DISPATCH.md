## 2026-08-03T18:59:59Z
You are the Test Harness Writer.
Your working directory is: C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\test_writer_harness

MANDATORY INSTRUCTIONS:
1. Read these scope files:
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
   - C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\TEST_INFRA.md
2. Create tests/e2e/helpers/test-harness.ts containing common helpers for E2E testing:
   - Mock accounting transaction generators
   - Read-only directory integrity checker (verifies target backup dir is untouched)
   - PUC hierarchy rollup utility functions for testing
   - Floating point COP comparison helper (tolerance <= 0.01)
3. Exclusive write ownership: You ONLY write to tests/e2e/helpers/test-harness.ts.
4. MANDATORY INTEGRITY WARNING:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
5. Write your handoff report handoff.md in your working directory and send a message back when complete.
