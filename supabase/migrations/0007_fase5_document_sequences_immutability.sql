-- =====================================================================
-- FASE 5 — Numeración documental consecutiva e inmutabilidad de asientos
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.2 Consecutivos de documentos (atómicos vía RPC)
-- ---------------------------------------------------------------------
create table if not exists document_sequences (
  doc_type text primary key,       -- 'CE','RC','CI','NC','NOMINA','LIQ', ...
  prefix text default '',
  current_number bigint not null default 0
);

insert into document_sequences (doc_type, prefix, current_number) values
  ('CI', 'CI-', 0),   -- Comprobante de ingreso
  ('CE', 'CE-', 0),   -- Comprobante de egreso
  ('NC', 'NC-', 0),   -- Nota contable
  ('RC', 'RC-', 0),   -- Recibo de caja
  ('NOMINA', 'NOM-', 0),
  ('LIQ', 'LIQ-', 0)
on conflict (doc_type) do nothing;

-- Devuelve el siguiente número consecutivo de forma atómica.
create or replace function next_document_number(p_doc_type text)
returns text as $$
declare
  v_number bigint;
  v_prefix text;
begin
  update document_sequences
    set current_number = current_number + 1
    where doc_type = p_doc_type
    returning current_number, prefix into v_number, v_prefix;

  if v_number is null then
    -- Crea la secuencia si no existía
    insert into document_sequences (doc_type, prefix, current_number)
      values (p_doc_type, '', 1)
      returning current_number, prefix into v_number, v_prefix;
  end if;

  return coalesce(v_prefix, '') || lpad(v_number::text, 6, '0');
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 5.3 Inmutabilidad: impedir modificar o borrar asientos APROBADOS
--     Los ajustes deben hacerse por reverso (nota contable), no editando.
-- ---------------------------------------------------------------------
create or replace function prevent_approved_entry_changes()
returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    if old.state = 'APROBADO' then
      raise exception 'No se puede eliminar un asiento APROBADO (id %). Use un reverso.', old.id;
    end if;
    return old;
  end if;

  -- UPDATE: se permite pasar a ANULADO, pero no editar un asiento ya aprobado.
  if (old.state = 'APROBADO' and new.state = 'APROBADO') then
    if (new.description is distinct from old.description
        or new.date is distinct from old.date) then
      raise exception 'No se puede modificar un asiento APROBADO (id %). Use un reverso.', old.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_approved_entry_changes on journal_entries;
create trigger trg_prevent_approved_entry_changes
  before update or delete on journal_entries
  for each row execute function prevent_approved_entry_changes();

-- Bloquear cambios en las líneas de un asiento aprobado
create or replace function prevent_approved_line_changes()
returns trigger as $$
declare
  v_state text;
  v_entry uuid;
begin
  v_entry := coalesce(new.entry_id, old.entry_id);
  select state into v_state from journal_entries where id = v_entry;
  if v_state = 'APROBADO' then
    raise exception 'No se pueden modificar las líneas de un asiento APROBADO. Use un reverso.';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_approved_line_changes on journal_lines;
create trigger trg_prevent_approved_line_changes
  before update or delete on journal_lines
  for each row execute function prevent_approved_line_changes();

alter table document_sequences enable row level security;
drop policy if exists "document_sequences all" on document_sequences;
create policy "document_sequences all" on document_sequences for all using (auth.role() = 'authenticated');
