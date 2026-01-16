-- RPC for creating journal entry transactionally
create or replace function create_journal_entry(
  p_date timestamp with time zone,
  p_description text,
  p_created_by uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_entry_id uuid;
  v_line jsonb;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
begin
  -- 1. Create Header
  insert into journal_entries (date, description, created_by, state)
  values (p_date, p_description, p_created_by, 'BORRADOR')
  returning id into v_entry_id;

  -- 2. Process Lines
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_total_debit := v_total_debit + (v_line->>'debit')::numeric;
    v_total_credit := v_total_credit + (v_line->>'credit')::numeric;
    
    insert into journal_lines (entry_id, account_code, third_party_id, debit, credit, description)
    values (
      v_entry_id,
      v_line->>'account_code',
      (v_line->>'third_party_id')::uuid,
      (v_line->>'debit')::numeric,
      (v_line->>'credit')::numeric,
      v_line->>'description'
    );
  end loop;

  -- 3. Validation (Optional enforcement at DB level, can be soft)
  -- For now we created it as BORRADOR, so we allow imbalance.
  -- But if we wanted to enforce equality check if we passed approved:
  -- if v_total_debit <> v_total_credit then
  --   raise exception 'Partida doble no se cumple: Debito % <> Credito %', v_total_debit, v_total_credit;
  -- end if;

  return v_entry_id;
end;
$$ language plpgsql security definer;
