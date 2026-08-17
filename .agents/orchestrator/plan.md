# Master Plan — CFO-AI Production Data Ingestion & Verification

## Objective
Enable CFO-AI to ingest historical transaction data from Excel backup files, process accounting movements/closures to generate trial balances, and verify accuracy against historical trial balance reports in `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` (Read-Only).

## Milestones & Strategy

### Phase 0: Survey & Architecture Discovery
- **Action**: Spawn 3 parallel Explorers to survey existing codebase (`C:\Users\ccarvajalino\OneDrive\Proyectos\Contable`) and structure/contents of backup Excel files (`C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup`).
- **Deliverable**: `PROJECT.md` with Feature Inventory, Architecture, Code Layout, and Milestone Decomposition.

### Phase 1: Implementation & Verification Tracks
- **Track 1: Implementation Track**
  - Milestone 1: Data Ingestion Engine (Excel parser for historical transaction backup files).
  - Milestone 2: Movement Processing & Closure Engine (Transaction processing, ledger aggregation, trial balance generation).
  - Milestone 3: Automated Verification Suite (Programmatic comparison script comparing generated trial balance against historical backup report).
- **Track 2: Dual-Track E2E Testing**
  - E2E Test Suite Creation: Tiers 1-4 opaque-box verification test runner and test cases.

### Phase 2: Acceptance & Quality Hardening
- Iteration loops with Workers, Reviewers, Challengers, and Forensic Auditor (`teamwork_preview_auditor`).
- Pass all acceptance criteria with 0 integrity violations.

## Key Constraints
- Source folder `C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup` is strictly Read-Only.
- All code implementation, execution, builds, and test calls delegated to subagents.
- Forensic Auditor veto is absolute.
