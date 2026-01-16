-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PUC ACCOUNTS (Plan Único de Cuentas)
create type account_nature as enum ('DEBITO', 'CREDITO');
create type account_type as enum ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO_VENTAS', 'COSTO_PRODUCCION', 'CUENTAS_ORDEN');

create table puc_accounts (
  code text primary key,
  name text not null,
  type account_type not null,
  nature account_nature not null,
  level int not null,
  parent_code text references puc_accounts(code),
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. THIRD PARTIES (Terceros)
create type document_type as enum ('CC', 'NIT', 'CE', 'PASAPORTE', 'TI');

create table third_parties (
  id uuid primary key default uuid_generate_v4(),
  document_type document_type not null,
  document_number text not null,
  dv int, -- Digito de verificacion (only for NIT)
  full_name text not null,
  email text,
  phone text,
  address text,
  city text,
  is_client boolean default false,
  is_provider boolean default false,
  is_employee boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(document_type, document_number)
);

-- 3. JOURNAL ENTRIES (Asientos Header)
create type entry_state as enum ('BORRADOR', 'APROBADO', 'ANULADO');

create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  date timestamp with time zone not null,
  description text not null,
  sequence_number serial, -- Simple auto-increment for reference
  state entry_state default 'BORRADOR',
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. JOURNAL LINES (Asientos Detail)
create table journal_lines (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid references journal_entries(id) on delete cascade not null,
  account_code text references puc_accounts(code) not null,
  third_party_id uuid references third_parties(id),
  debit numeric(20, 2) default 0,
  credit numeric(20, 2) default 0,
  description text, -- Line specific description if needed
  
  check (debit >= 0),
  check (credit >= 0)
);

-- RLS POLICIES (Simple start: Authenticated users can do everything)
alter table puc_accounts enable row level security;
alter table third_parties enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;

create policy "Enable all access for authenticated users" on puc_accounts
  for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on third_parties
  for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on journal_entries
  for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on journal_lines
  for all using (auth.role() = 'authenticated');
