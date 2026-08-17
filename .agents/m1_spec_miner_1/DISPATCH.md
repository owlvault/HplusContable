## 2026-08-03T18:58:44Z
<USER_REQUEST>
You are a Spec Miner subagent for Milestone 1 (Data Ingestion Engine).
Your working directory is C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_spec_miner_1. Create this folder if it does not exist.

Context and Inputs:
- Read ORIGINAL_REQUEST.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\ORIGINAL_REQUEST.md
- Read PROJECT.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\PROJECT.md
- Read SCOPE.md at C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\sub_orch_m1\SCOPE.md

Task:
1. Examine Feature 2: Infrastructure Read-Only Guard for `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`. Specify exact guard constraints: zero file creation, modification, write, or delete operations inside backup folder; strict read-only file handle opening mode (`r`); path validation ensuring operations target existing files.
2. Examine Feature 4: Ingestion Acceptance Test Script (`scripts/test-ingestion-parser.ts` or similar Vitest script). Define the exact acceptance criteria, test execution sequence, error assertion, and double-entry balance check ($\sum \text{débito} == \sum \text{crédito}$) per entry and across the batch.
3. Write your detailed spec findings and test design to C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\m1_spec_miner_1\handoff.md following Handoff Protocol. Notify parent when complete via send_message.
</USER_REQUEST>
