-- =====================================================================
-- FASE 1 — Motor tributario parametrizable
-- Conceptos de retención (fuente / IVA / ICA), valor de la UVT por año y
-- tarifas con base mínima en UVT. Reemplaza los códigos hardcodeados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.0 Valor de la UVT por año (Unidad de Valor Tributario)
-- ---------------------------------------------------------------------
create table if not exists uvt_values (
  year int primary key,
  value numeric(20, 2) not null
);

insert into uvt_values (year, value) values
  (2022, 38004),
  (2023, 42412),
  (2024, 47065),
  (2025, 49799),
  (2026, 52200)   -- estimado; ajustar con la resolución DIAN oficial
on conflict (year) do nothing;

-- ---------------------------------------------------------------------
-- 1.1 Conceptos de retención parametrizables
--   type: RETEFUENTE | RETEIVA | RETEICA
--   applies_to: COMPRA (proveedor) | VENTA (cliente/autorretención)
--   base_uvt: base mínima sujeta a retención expresada en UVT (0 = sin base)
--   rate: tarifa porcentual aplicada sobre la base gravable
--   account_code: cuenta PUC donde se contabiliza la retención
-- ---------------------------------------------------------------------
create table if not exists tax_concepts (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,               -- p. ej. 'RF_COMPRAS', 'RF_HONOR'
  name text not null,
  type text not null,                      -- RETEFUENTE | RETEIVA | RETEICA
  applies_to text not null default 'COMPRA', -- COMPRA | VENTA
  rate numeric(6, 3) not null,             -- %
  base_uvt numeric(10, 2) not null default 0,
  account_code text references puc_accounts(code),
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table tax_concepts is 'Conceptos de retención con tarifa, base mínima en UVT y cuenta PUC.';

-- Semilla de conceptos frecuentes (tarifas 2024/2025; ajustables desde UI)
insert into tax_concepts (code, name, type, applies_to, rate, base_uvt, account_code) values
  ('RF_COMPRAS',   'Retefuente Compras generales',     'RETEFUENTE', 'COMPRA', 2.500, 27, '236540'),
  ('RF_SERVICIOS', 'Retefuente Servicios generales',   'RETEFUENTE', 'COMPRA', 4.000,  4, '236525'),
  ('RF_SERV_NODEC','Retefuente Servicios no declarante','RETEFUENTE','COMPRA', 6.000,  4, '236525'),
  ('RF_HONOR',     'Retefuente Honorarios',            'RETEFUENTE', 'COMPRA', 11.000, 0, '236515'),
  ('RF_ARREND',    'Retefuente Arrendamientos',        'RETEFUENTE', 'COMPRA', 3.500, 27, '236530'),
  ('RF_TRANSP',    'Retefuente Transporte de carga',   'RETEFUENTE', 'COMPRA', 1.000,  4, '236570'),
  ('RIVA_GEN',     'ReteIVA (15% del IVA)',            'RETEIVA',    'COMPRA', 15.000, 0, '236700'),
  ('RICA_GEN',     'ReteICA (por mil municipal)',      'RETEICA',    'COMPRA', 0.966,  0, '236805')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table uvt_values enable row level security;
alter table tax_concepts enable row level security;

drop policy if exists "uvt_values read" on uvt_values;
create policy "uvt_values read" on uvt_values
  for select using (auth.role() = 'authenticated');

drop policy if exists "tax_concepts all" on tax_concepts;
create policy "tax_concepts all" on tax_concepts
  for all using (auth.role() = 'authenticated');

create index if not exists idx_tax_concepts_type on tax_concepts(type, applies_to, is_active);
