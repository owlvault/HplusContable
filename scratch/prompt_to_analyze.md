# Teamwork Project Prompt — Launched

> Status: Launched — Teamwork subagent is active
> Requested team: Full team of senior UX and software architects

Act as a team of senior UX and software architects to comprehensively evaluate and refine the existing implementation plan (`implementation_plan.md`). The goal is to ensure the plan successfully converts the ERP into an intuitive, secure platform that simplifies user workflows (Sales -> Billing -> Payments) and strictly eliminates accounting errors.

Working directory: c:\Users\ccarvajalino\OneDrive\Proyectos\Contable
Integrity mode: development

## Requirements

### R1. Comprehensive Architectural & UX Review
Evaluate the current `implementation_plan.md` across four dimensions: User Experience (UX), Backend Architecture, Data Integrity, and Security. Identify edge cases, transaction failure scenarios, and areas where the UX could be further simplified or made more robust.

### R2. Direct Document Refinement
Apply the findings directly to `implementation_plan.md`. Enhance the document to include robust solutions for identified edge cases (e.g., handling DIAN API timeouts, concurrent ledger updates) while maintaining the core philosophy of "Zero-Accounting Jargon" for the end-user.

## Acceptance Criteria

### Architectural Robustness
- [ ] The plan explicitly defines the transaction boundaries and rollback mechanisms for multi-step operations (e.g., Sale -> Invoice generation -> DIAN transmission).
- [ ] The plan includes a section addressing security constraints and data isolation or validation to prevent unauthorized operations.

### UX Fidelity
- [ ] The refined UX flows continue to abstract all debit/credit terminology and PUC account mappings from the user.
- [ ] Error handling strategies (In-Context Action Cards) are expanded to cover network or third-party (DIAN) integration failures.

---
*Status: Teamwork is currently executing this prompt.*
