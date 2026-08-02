-- =====================================================================
-- FASE 4 — Cierre anual, declaraciones tributarias e información exógena
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 Cierre del ejercicio (asiento de cancelación de resultados)
-- ---------------------------------------------------------------------
create table if not exists year_end_closings (
  id uuid primary key default uuid_generate_v4(),
  year int not null unique,
  total_income numeric(20, 2) default 0,
  total_expense numeric(20, 2) default 0,
  net_result numeric(20, 2) default 0,        -- + utilidad / - pérdida
  journal_entry_id uuid references journal_entries(id),
  status text default 'CLOSED',
  closed_by uuid references auth.users(id),
  closed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------
-- 4.2 Declaraciones tributarias (IVA 300, Retención 350)
-- ---------------------------------------------------------------------
create table if not exists tax_returns (
  id uuid primary key default uuid_generate_v4(),
  type text not null,                          -- IVA | RETENCION
  period_year int not null,
  period_number int not null,                  -- bimestre (IVA) o mes (retención)
  data jsonb not null default '{}'::jsonb,     -- renglones del formulario
  total_to_pay numeric(20, 2) default 0,
  status text default 'DRAFT',                 -- DRAFT | PRESENTED
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (type, period_year, period_number)
);

-- ---------------------------------------------------------------------
-- 4.3 Información exógena (medios magnéticos)
-- ---------------------------------------------------------------------
create table if not exists exogena_reports (
  id uuid primary key default uuid_generate_v4(),
  format_code text not null,                   -- 1001, 1003, 1005, 1007, 1008, 1009
  year int not null,
  row_count int default 0,
  total_amount numeric(20, 2) default 0,
  content jsonb default '[]'::jsonb,           -- filas del formato
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (format_code, year)
);

-- ---------------------------------------------------------------------
-- 4.4 Certificados de retención emitidos
-- ---------------------------------------------------------------------
create table if not exists withholding_certificates (
  id uuid primary key default uuid_generate_v4(),
  third_party_id uuid references third_parties(id) not null,
  year int not null,
  type text not null default 'RETEFUENTE',     -- RETEFUENTE | RETEIVA | RETEICA | INGRESOS_RETENCIONES
  total_base numeric(20, 2) default 0,
  total_withheld numeric(20, 2) default 0,
  data jsonb default '{}'::jsonb,
  issued_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (third_party_id, year, type)
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table year_end_closings enable row level security;
alter table tax_returns enable row level security;
alter table exogena_reports enable row level security;
alter table withholding_certificates enable row level security;

drop policy if exists "year_end_closings all" on year_end_closings;
create policy "year_end_closings all" on year_end_closings for all using (auth.role() = 'authenticated');
drop policy if exists "tax_returns all" on tax_returns;
create policy "tax_returns all" on tax_returns for all using (auth.role() = 'authenticated');
drop policy if exists "exogena_reports all" on exogena_reports;
create policy "exogena_reports all" on exogena_reports for all using (auth.role() = 'authenticated');
drop policy if exists "withholding_certificates all" on withholding_certificates;
create policy "withholding_certificates all" on withholding_certificates for all using (auth.role() = 'authenticated');
