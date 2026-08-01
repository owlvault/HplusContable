-- =====================================================================
-- FASE 3 — Nómina de ley: prestaciones sociales, liquidaciones y PILA
-- =====================================================================

-- Vincular la nómina con su asiento de causación
alter table payrolls
  add column if not exists journal_entry_id uuid references journal_entries(id);

-- ---------------------------------------------------------------------
-- 3.1 Provisiones de prestaciones sociales por nómina/empleado
-- ---------------------------------------------------------------------
create table if not exists payroll_provisions (
  id uuid primary key default uuid_generate_v4(),
  payroll_id uuid references payrolls(id) on delete cascade,
  employee_id uuid references employees(id),
  cesantias numeric(20, 2) default 0,
  intereses_cesantias numeric(20, 2) default 0,
  prima numeric(20, 2) default 0,
  vacaciones numeric(20, 2) default 0,
  total numeric(20, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------
-- 3.2 Liquidaciones (definitivas y parciales)
-- ---------------------------------------------------------------------
create table if not exists severance_settlements (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references employees(id) not null,
  type text not null default 'DEFINITIVA',    -- DEFINITIVA | PARCIAL
  settlement_date date not null,
  days_worked_year int not null,
  monthly_salary numeric(20, 2) not null,
  transport_allowance numeric(20, 2) default 0,
  cesantias numeric(20, 2) default 0,
  intereses_cesantias numeric(20, 2) default 0,
  prima numeric(20, 2) default 0,
  vacaciones numeric(20, 2) default 0,
  other_payments numeric(20, 2) default 0,
  deductions numeric(20, 2) default 0,
  total numeric(20, 2) default 0,
  status text not null default 'DRAFT',        -- DRAFT | APPROVED | PAID
  journal_entry_id uuid references journal_entries(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------
-- 3.3 PILA — planilla integrada de liquidación de aportes
-- ---------------------------------------------------------------------
create table if not exists pila_submissions (
  id uuid primary key default uuid_generate_v4(),
  payroll_id uuid references payrolls(id) on delete cascade,
  period_year int not null,
  period_month int not null,
  planilla_type text default 'E',              -- E=Empleados
  total_ibc numeric(20, 2) default 0,
  total_health numeric(20, 2) default 0,
  total_pension numeric(20, 2) default 0,
  total_arl numeric(20, 2) default 0,
  total_parafiscales numeric(20, 2) default 0,
  total_contributions numeric(20, 2) default 0,
  employee_count int default 0,
  file_content text,                           -- contenido del archivo plano
  status text default 'GENERATED',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------
-- 3.4 Cuentas contables por defecto de nómina (parametrizadas)
--     Se guardan también en company_settings.default_accounts; esta tabla
--     permite un mapeo detallado por rubro de nómina.
-- ---------------------------------------------------------------------
create table if not exists payroll_account_map (
  concept text primary key,                    -- 'salario','cesantias','salud_emp',...
  account_code text references puc_accounts(code),
  is_debit boolean default true
);

insert into payroll_account_map (concept, account_code, is_debit) values
  ('gasto_salario',        '510506', true),
  ('gasto_aux_transporte', '510527', true),
  ('gasto_cesantias',      '510530', true),
  ('gasto_intereses',      '510533', true),
  ('gasto_prima',          '510536', true),
  ('gasto_vacaciones',     '510539', true),
  ('gasto_salud_pat',      '510569', true),
  ('gasto_pension_pat',    '510570', true),
  ('gasto_arl',            '510568', true),
  ('gasto_parafiscales',   '510572', true),
  ('pasivo_salarios',      '250505', false),
  ('pasivo_cesantias',     '261005', false),
  ('pasivo_intereses',     '261010', false),
  ('pasivo_prima',         '261015', false),
  ('pasivo_vacaciones',    '261020', false),
  ('pasivo_salud',         '237005', false),
  ('pasivo_pension',       '238030', false),
  ('pasivo_arl',           '237010', false),
  ('pasivo_parafiscales',  '237025', false),
  ('retencion_salud_emp',  '237005', false),
  ('retencion_pension_emp','238030', false)
on conflict (concept) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table payroll_provisions enable row level security;
alter table severance_settlements enable row level security;
alter table pila_submissions enable row level security;
alter table payroll_account_map enable row level security;

drop policy if exists "payroll_provisions all" on payroll_provisions;
create policy "payroll_provisions all" on payroll_provisions for all using (auth.role() = 'authenticated');
drop policy if exists "severance_settlements all" on severance_settlements;
create policy "severance_settlements all" on severance_settlements for all using (auth.role() = 'authenticated');
drop policy if exists "pila_submissions all" on pila_submissions;
create policy "pila_submissions all" on pila_submissions for all using (auth.role() = 'authenticated');
drop policy if exists "payroll_account_map all" on payroll_account_map;
create policy "payroll_account_map all" on payroll_account_map for all using (auth.role() = 'authenticated');
