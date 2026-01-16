-- Add voucher types table
create type voucher_type as enum ('INGRESO', 'EGRESO', 'COMPRA', 'VENTA', 'NOTA_CONTABLE');

create table vouchers (
  id uuid primary key default uuid_generate_v4(),
  type voucher_type not null,
  number serial,
  date timestamp with time zone not null,
  third_party_id uuid references third_parties(id),
  description text not null,
  subtotal numeric(20, 2) default 0,
  iva numeric(20, 2) default 0,
  retention numeric(20, 2) default 0,
  total numeric(20, 2) default 0,
  journal_entry_id uuid references journal_entries(id),
  state entry_state default 'BORRADOR',
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Voucher detail lines
create table voucher_lines (
  id uuid primary key default uuid_generate_v4(),
  voucher_id uuid references vouchers(id) on delete cascade not null,
  description text not null,
  quantity numeric(10, 2) default 1,
  unit_price numeric(20, 2) default 0,
  iva_rate numeric(5, 2) default 0, -- 0, 5, 19
  retention_rate numeric(5, 2) default 0, -- Rete fuente
  subtotal numeric(20, 2) default 0,
  account_code text references puc_accounts(code)
);

-- Tax rates configuration
create table tax_rates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null, -- IVA, RETEFUENTE, RETEIVA, RETEICA
  rate numeric(5, 2) not null,
  account_code text references puc_accounts(code),
  min_base numeric(20, 2) default 0, -- UVT threshold
  is_active boolean default true
);

-- Audit log
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id text not null,
  action text not null, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User roles
create type user_role as enum ('ADMIN', 'CONTADOR', 'AUXILIAR', 'GERENTE', 'VIEWER');

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role default 'VIEWER',
  full_name text,
  company_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table vouchers enable row level security;
alter table voucher_lines enable row level security;
alter table tax_rates enable row level security;
alter table audit_log enable row level security;
alter table user_profiles enable row level security;

create policy "Enable all access for authenticated users" on vouchers
  for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on voucher_lines
  for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on tax_rates
  for all using (auth.role() = 'authenticated');

create policy "Enable read for authenticated users" on audit_log
  for select using (auth.role() = 'authenticated');

create policy "Enable all access for own profile" on user_profiles
  for all using (auth.uid() = id);

-- Insert default tax rates for Colombia
INSERT INTO tax_rates (name, type, rate, min_base) VALUES
('IVA General', 'IVA', 19, 0),
('IVA Reducido', 'IVA', 5, 0),
('IVA Exento', 'IVA', 0, 0),
('Rete Fuente - Compras', 'RETEFUENTE', 2.5, 1073000),
('Rete Fuente - Servicios', 'RETEFUENTE', 4, 156000),
('Rete Fuente - Honorarios', 'RETEFUENTE', 10, 0),
('Rete IVA', 'RETEIVA', 15, 0);
