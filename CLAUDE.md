# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project Overview

**DigiKawsay** (a.k.a. **HplusContable**) is a Colombian accounting SaaS
(software contable) built as a **single-company, modular monolith**. The domain
is Colombian double-entry accounting, so most domain names, comments, UI copy,
and error messages are in **Spanish** — follow that convention when adding code.

Core domain concepts:
- **PUC** — Plan Único de Cuentas (chart of accounts).
- **Partida doble** — double-entry bookkeeping (debits must equal credits).
- **Terceros** — third parties (clients / providers / employees).
- **DIAN** — the Colombian tax authority; drives NIT verification digits (DV),
  IVA rates (0% / 5% / 19%), and retenciones (fuente, IVA, ICA).
- **UVT** — Unidad de Valor Tributario; tax bases/thresholds are expressed in UVT.

## Tech Stack

- **Next.js 15.1** — App Router, Server Actions, `--turbopack` in dev.
- **React 19** + **TypeScript** (strict mode).
- **Supabase** — Postgres, Auth, and RPC (`@supabase/ssr`, `@supabase/supabase-js`).
- **Tailwind CSS 3.4** — plus CSS custom properties in `src/app/globals.css`.
- **Radix UI** (dialog, toast), **lucide-react** (icons), **recharts** (charts).
- **@react-pdf/renderer** — PDF generation (invoices, reports).
- **vitest** — unit tests.
- **Python FastAPI** side-service (`backend/server.py`) — the DigiCFO chatbot.

## Commands

```bash
npm run dev      # Dev server (Next.js + Turbopack) on :3000
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (next/core-web-vitals + next/typescript)
npm run test     # Run vitest
npm run test -- src/lib/utils/dian.test.ts   # Run a single test file
```

There is no vitest config file; vitest uses its defaults. Test files live next to
the code they cover as `*.test.ts`.

## Environment

Copy `.env.example` and set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. The Python chatbot backend uses `SUPABASE_URL`,
`SUPABASE_KEY`, and `EMERGENT_LLM_KEY`; the chat route proxies to it via
`CHAT_BACKEND_URL` (default `http://localhost:8001`). Env files are git-ignored —
**never commit secrets**.

## Directory Layout

```
src/
  app/
    (auth)/          # Login & register (route group, own layout)
    (dashboard)/     # Authenticated app (sidebar nav layout)
    api/chat/        # Route handler proxying to the Python chatbot
  actions/           # Server Actions ('use server') — the data/mutation layer
  components/         # Feature-grouped React components + components/ui primitives
  lib/
    supabase/        # server.ts, client.ts, middleware.ts (SSR clients)
    utils/           # dian.ts, invoice-calc.ts, tax-engine.ts, payroll-calc.ts …
    rbac.ts          # Permission enforcement for Server Actions
    modules.ts       # Canonical module registry (ids used by RBAC)
  types/             # database.ts, invoices.ts (shared TypeScript types)
  middleware.ts      # Route protection / session refresh

supabase/
  migrations/        # Numbered SQL migrations (0000_, 0001_, …)
  seeds/puc.sql      # Chart-of-accounts seed data
  rpc/               # RPC function definitions & feature schemas
```

Path alias: **`@/*` → `./src/*`** (in `tsconfig.json`).

## Architecture & Conventions

### Server Actions are the data layer
All reads and mutations live in `src/actions/*.ts`, each starting with
`'use server'`. Standard mutation shape:
1. `const supabase = await createClient()` from `@/lib/supabase/server`.
2. Enforce access with `enforcePermission(module, action)` (from `@/lib/rbac`).
3. Domain validation (e.g. **partida doble**: `|debit − credit| ≤ 0.01`).
4. Mutate via Supabase, or an RPC for atomic multi-row / sequence work.
5. Audit where applicable, then `revalidatePath(...)`.

Keep these steps intact; don't bypass RBAC or the double-entry check.

### Supabase clients
- `@/lib/supabase/server` — Server Components & Server Actions.
- `@/lib/supabase/client` — Client Components.
- `@/lib/supabase/middleware` — `updateSession` used by `src/middleware.ts`.

### Database changes
Add a new **numbered migration** under `supabase/migrations/` (don't rewrite
existing ones). New RPCs go in `supabase/rpc/`. Keep `src/types/database.ts` in
sync with schema changes.

### Accounting invariants
- Approved journal entries **must** balance (debits = credits).
- Entry states: `BORRADOR` → `APROBADO` → `ANULADO`.
- Approving invoices auto-generates journal entries and consumes consecutive
  numbers via RPC (atomic) — don't reimplement sequences in application code.
- Tax rates, retention concepts and posting accounts are **parametric** (config
  tables), never hardcoded in application logic.

### Money & tax math (shared helpers — don't inline)
- `src/lib/utils/dian.ts` — `calculateDV`, COP formatting.
- `src/lib/utils/invoice-calc.ts` — `calculateInvoiceTotals`.
- `src/lib/utils/tax-engine.ts` — retention computation from UVT-based rules.
- `src/lib/utils/payroll-calc.ts` — payroll, social security, prestaciones.

## Styling
Tailwind utilities + HSL design tokens in `src/app/globals.css`. Use `cn()` from
`src/lib/utils.ts` to compose classes. Some components use inline `style` objects
— match the surrounding file.

## Working Agreements
- Follow existing patterns in neighboring files; keep domain terms in Spanish.
- Run `npm run lint` and `npm run test` before finishing.
- Never bypass `enforcePermission` or the double-entry check.
- Keep secrets out of commits.
- See `PLAN_PRODUCCION.md` for the roadmap to real-company readiness.
