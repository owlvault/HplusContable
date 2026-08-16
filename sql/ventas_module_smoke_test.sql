-- Prueba de humo: columnas generadas, vistas y cascada de margen
\set ON_ERROR_STOP on

insert into third_parties (document_type, document_number, full_name, is_client)
values ('NIT','900123456','Cliente Demo SAS', true);

insert into sales_opportunities (code, name, third_party_id, stage, probability, expected_amount, expected_margin, expected_close_date, first_contact_date)
select 'OPP-001','Plataforma de cobranza IA', id, 'PROPUESTA', 60, 480000000, 200000000, current_date + 30, current_date - 45
from third_parties where document_number='900123456';

insert into sales_proposals (opportunity_id, code, version, title, third_party_id, status, currency, fx_rate, engagement_model, issue_date, payment_terms_days)
select o.id, 'PRO-001', 1, 'Plataforma de cobranza IA - v1', o.third_party_id, 'ENVIADA', 'COP', 1, 'FIXED_PRICE', current_date, 45
from sales_opportunities o where o.code='OPP-001';

-- Línea normal, línea con descuento agresivo, y reembolsable
insert into sales_proposal_lines
  (proposal_id, line_number, description, role_family, seniority, quantity, unit, hours,
   unit_list_price, discount_rate, unit_price, unit_direct_cost, unit_indirect_cost, is_passthrough, tax_rate)
select p.id, v.n, v.descr, v.rf, v.sn, v.qty, 'HORA', case when v.pt then 0 else v.qty end, v.lp, v.dr, v.up, v.dc, v.ic, v.pt, v.tr
from sales_proposals p,
(values
  (1,'Tech Lead','ARQUITECTURA','SENIOR',   320::numeric, 180000::numeric, 0::numeric,    180000::numeric, 62000::numeric, 12000::numeric, false, 19::numeric),
  (2,'Dev Senior','DESARROLLO','SENIOR',   1200::numeric, 140000::numeric, 15::numeric,   119000::numeric, 55000::numeric, 11000::numeric, false, 19::numeric),
  (3,'Dev Junior','DESARROLLO','JUNIOR',    800::numeric,  80000::numeric, 30::numeric,    56000::numeric, 38000::numeric,  7600::numeric, false, 19::numeric),
  (4,'Cloud passthrough',null,null,          12::numeric, 2500000::numeric, 0::numeric,  2500000::numeric,2500000::numeric,    0::numeric, true,  19::numeric)
) as v(n,descr,rf,sn,qty,lp,dr,up,dc,ic,pt,tr)
where p.code='PRO-001';

\echo '--- Margen unitario por linea ---'
select line_number, description, quantity, unit_list_price, unit_price,
       unit_direct_cost, unit_gross_margin, gross_margin_rate, markup_multiple,
       price_realization_rate, list_amount, discount_amount, net_amount, gross_margin_amount
from sales_proposal_lines order by line_number;

\echo '--- Cascada de la propuesta (v_sales_proposal_margin) ---'
select code, version, client_name, list_amount, discount_amount, net_revenue, passthrough_revenue,
       direct_cost, gross_margin, gross_margin_rate, operating_margin_rate,
       price_realization_rate, total_hours, revenue_per_hour, margin_per_hour
from v_sales_proposal_margin;

\echo '--- Margen por rol (v_sales_margin_by_role) ---'
select role_family, seniority, total_hours, avg_unit_price, avg_unit_cost,
       avg_unit_margin, avg_margin_rate, avg_markup_multiple, avg_discount_rate
from v_sales_margin_by_role order by role_family, seniority;

\echo '--- Pipeline ponderado (v_sales_pipeline) ---'
select code, stage, probability, expected_amount, weighted_amount, weighted_margin,
       latest_proposal_code, latest_proposal_version, days_to_close, days_in_pipeline
from v_sales_pipeline;

-- Ganar la propuesta -> contrato -> proyecto -> hitos -> horas reales
insert into projects (code, name, third_party_id, status, currency, baseline_revenue, baseline_direct_cost, baseline_hours, baseline_margin, budget_revenue, budget_direct_cost, budget_hours, percent_complete)
select 'PRJ-001','Plataforma de cobranza IA', m.third_party_id, 'EN_EJECUCION', 'COP',
       m.net_revenue, m.direct_cost, m.total_hours, m.gross_margin, m.net_revenue, m.direct_cost, m.total_hours, 40
from v_sales_proposal_margin m where m.code='PRO-001';

insert into sales_contracts (code, name, third_party_id, proposal_id, project_id, status, currency, contract_value, signed_date, start_date, payment_terms_days)
select 'CTR-001','Contrato cobranza IA', p.third_party_id, p.id, pr.id, 'ACTIVO', 'COP', m.net_revenue, current_date, current_date, 45
from sales_proposals p
join v_sales_proposal_margin m on m.id = p.id
join projects pr on pr.code='PRJ-001'
where p.code='PRO-001';

update projects set contract_id = (select id from sales_contracts where code='CTR-001') where code='PRJ-001';

insert into sales_billing_milestones (contract_id, project_id, milestone_number, name, milestone_type, planned_date, percent_of_contract, amount, status)
select c.id, c.project_id, v.n, v.nm, v.mt, current_date + v.d, v.pc, c.contract_value * v.pc / 100, v.st
from sales_contracts c,
(values (1,'Anticipo','ANTICIPO', -30, 30::numeric,'COBRADO'),
        (2,'Entrega MVP','ENTREGABLE', 15, 40::numeric,'LISTO_FACTURAR'),
        (3,'Cierre','FINAL', 90, 30::numeric,'PENDIENTE')
) as v(n,nm,mt,d,pc,st)
where c.code='CTR-001';

insert into project_time_entries (project_id, work_date, hours, is_billable, non_billable_reason, role_family, seniority, hourly_cost)
select pr.id, current_date - 10, v.h, v.b, v.r, v.rf, v.sn, v.hc
from projects pr,
(values (900::numeric, true,  null,          'DESARROLLO','SENIOR', 55000::numeric),
        (150::numeric, false, 'RETRABAJO',   'DESARROLLO','SENIOR', 55000::numeric),
        (140::numeric, true,  null,          'ARQUITECTURA','SENIOR', 62000::numeric)
) as v(h,b,r,rf,sn,hc)
where pr.code='PRJ-001';

\echo '--- Seguimiento plan vs real (v_project_margin_tracking) ---'
select code, percent_complete, baseline_revenue, baseline_margin, baseline_hours,
       hours_worked, non_billable_hours, actual_direct_cost, invoiced_amount, collected_amount,
       ready_to_invoice_amount, backlog_amount, estimated_cost_at_completion,
       forecast_margin, margin_variance, hours_consumption_rate, effective_hourly_rate
from v_project_margin_tracking;

\echo '--- Backlog / caja proyectada (v_sales_backlog) ---'
select contract_code, milestone_name, milestone_type, planned_date, amount, status, expected_cash_date, days_overdue
from v_sales_backlog order by planned_date;

\echo '--- Rentabilidad por cliente (v_sales_client_profitability) ---'
select client_name, contracts, projects, contracted_value, baseline_margin, baseline_margin_rate from v_sales_client_profitability;

\echo '--- Dimension proyecto propagada al resto del ERP ---'
select table_name, column_name from information_schema.columns
where column_name in ('project_id','cost_center_id','contract_line_id','milestone_id','unit_cost','contract_id')
  and table_schema='public' and table_name in ('journal_lines','invoice_lines','invoices','payroll_lines','bank_movements','voucher_lines')
order by table_name, column_name;
