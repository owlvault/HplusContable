-- =====================================================================
-- FASE 0 — Datos maestros y configuración de empresa
-- Extiende PUC y Terceros, agrega configuración central de la empresa
-- y endurece/normaliza RLS sobre las tablas nuevas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0.2 Terceros: régimen tributario y responsabilidades DIAN
-- ---------------------------------------------------------------------
alter table third_parties
  add column if not exists is_active boolean default true,
  add column if not exists tax_regime text default 'NO_RESPONSABLE_IVA',
    -- RESPONSABLE_IVA | NO_RESPONSABLE_IVA | GRAN_CONTRIBUYENTE | REGIMEN_SIMPLE
  add column if not exists is_self_withholding boolean default false,   -- autorretenedor
  add column if not exists is_vat_withholding_agent boolean default false, -- agente de reteIVA
  add column if not exists is_ica_withholding_agent boolean default false, -- agente de reteICA
  add column if not exists ciiu_code text,                              -- actividad económica
  add column if not exists tax_responsibilities text[] default '{}',    -- códigos O-13, O-15, etc.
  add column if not exists ica_rate_x_mil numeric(6, 3);                -- tarifa ICA por mil (municipio)

comment on column third_parties.tax_regime is 'Régimen: RESPONSABLE_IVA, NO_RESPONSABLE_IVA, GRAN_CONTRIBUYENTE, REGIMEN_SIMPLE';
comment on column third_parties.tax_responsibilities is 'Responsabilidades DIAN (RUT): O-13, O-15, O-23, O-47, etc.';

-- ---------------------------------------------------------------------
-- 0.3 Configuración de la empresa (single-company)
-- ---------------------------------------------------------------------
create table if not exists company_settings (
  id uuid primary key default uuid_generate_v4(),
  singleton boolean not null default true unique,   -- garantiza una sola fila
  legal_name text not null,
  trade_name text,
  nit text not null,
  dv int,
  tax_regime text default 'RESPONSABLE_IVA',
  is_self_withholding boolean default false,
  is_vat_withholding_agent boolean default false,
  is_ica_withholding_agent boolean default false,
  ciiu_code text,
  address text,
  city text,
  department text,
  phone text,
  email text,
  fiscal_year_start_month int default 1,            -- normalmente enero
  -- Cuentas contables por defecto (parametrización, no hardcode)
  default_accounts jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table company_settings is 'Configuración fiscal y contable de la empresa. Fila única (singleton).';
comment on column company_settings.default_accounts is 'Mapa cuenta-por-defecto: {"caja":"110505","iva_generado":"240805",...}';

-- Semilla vacía si no existe
insert into company_settings (singleton, legal_name, nit)
select true, 'Mi Empresa S.A.S.', '000000000'
where not exists (select 1 from company_settings);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table company_settings enable row level security;

drop policy if exists "company_settings authenticated all" on company_settings;
create policy "company_settings authenticated all" on company_settings
  for all using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Índices útiles para datos maestros
-- ---------------------------------------------------------------------
create index if not exists idx_third_parties_active on third_parties(is_active);
create index if not exists idx_third_parties_regime on third_parties(tax_regime);
create index if not exists idx_puc_parent on puc_accounts(parent_code);
create index if not exists idx_puc_active on puc_accounts(is_active);

-- updated_at trigger para company_settings
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_company_settings_updated on company_settings;
create trigger trg_company_settings_updated
  before update on company_settings
  for each row execute function set_updated_at();
