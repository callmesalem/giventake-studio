-- Close the loop from a won deal to a client, a project, and a draft invoice.
--
-- APPLIED AND VERIFIED 2026-08-22 as version 20260822234428.
--
-- Tested end to end against the live database with a throwaway deal, then
-- every artifact removed: a $4,250.50 deal produced one client, one project
-- and one DRAFT invoice of exactly 425050 cents; a second call returned the
-- same project with already_converted=true rather than billing twice; and a
-- synthetic deal was refused outright, producing zero projects.
--
-- THE GAP THIS FILLS
--
-- The CRM sells but does not deliver. `deals` carry a company and a value;
-- `clients`, `projects` and `invoices` all exist and are all empty. Nothing
-- connects them, so winning a deal produces no project to run and no invoice to
-- collect, and the pipeline stages after Close (Kickoff through Retro) have
-- nowhere to live. Six real deals, zero projects.
--
-- DESIGN DECISIONS WORTH KNOWING
--
-- 1. The caller asserts the deal is won; this function does not infer it from a
--    stage string. Stage vocabularies drift, and a money-moving action should
--    not hinge on a text comparison that a rename silently breaks.
--
-- 2. It creates a DRAFT invoice, never an issued or paid one. The pipeline's
--    own gate on stage 4 reads "Signed and paid before any code", and that is a
--    judgement a person makes. Recording a draft is bookkeeping; issuing it is
--    a decision.
--
-- 3. Idempotent on the deal. Running it twice returns the existing project
--    rather than creating a second one, because a retry after a dropped
--    connection must not double-bill anyone.
--
-- 4. Nothing is sent. Consistent with the charter and with
--    capture_website_lead: this is "track", not outbound. There is no transport
--    here and no approval is consumed.
--
-- 5. Direct table access stays revoked. Runtime reaches this only through the
--    definer RPC, and the grant below is scoped to this new function alone.
--
-- The rationale above was written alongside the original migration and lived
-- only on feat/deal-to-project. The provenance note below, and every SQL
-- statement in this file, are unchanged: they were backfilled from the
-- database and are what actually ran. Only comments were added here.

-- convert_won_deal: promote a won deal into a client + project + DRAFT invoice.
-- Backfilled 2026-08-27 from the remote migration history
-- (supabase_migrations.schema_migrations, version 20260822234428) — the
-- authoritative applied statements. Replaces the earlier NO-OP placeholder that
-- only existed to align `db push` history. Idempotent; service_role only; sends nothing.

alter table public.projects
  add column if not exists deal_id uuid references public.deals;

create unique index if not exists projects_deal_uidx
  on public.projects (deal_id)
  where deal_id is not null;

alter table public.invoices
  add column if not exists source_deal_id uuid references public.deals;

create or replace function public.convert_won_deal(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deal_id uuid := nullif(p_payload->>'deal_id', '')::uuid;
  v_actor text := coalesce(nullif(p_payload->>'actor', ''), 'unknown');
  v_make_invoice boolean := coalesce((p_payload->>'draft_invoice')::boolean, true);
  v_deal public.deals%rowtype;
  v_company public.companies%rowtype;
  v_client_id uuid;
  v_project_id uuid;
  v_invoice_id uuid;
  v_existing_project uuid;
  v_amount_cents bigint;
begin
  if v_deal_id is null then
    raise exception 'deal_id is required';
  end if;

  select * into v_deal from public.deals where id = v_deal_id;
  if not found then
    raise exception 'deal % not found', v_deal_id;
  end if;

  if v_deal.synthetic then
    raise exception 'refusing to convert a synthetic deal';
  end if;

  select id into v_existing_project from public.projects where deal_id = v_deal_id;
  if v_existing_project is not null then
    return jsonb_build_object('project_id', v_existing_project, 'already_converted', true);
  end if;

  if v_deal.company_id is not null then
    select * into v_company from public.companies where id = v_deal.company_id;
  end if;

  select id into v_client_id
  from public.clients
  where synthetic = false
    and lower(name) = lower(coalesce(v_company.name, v_deal.name))
  limit 1;

  if v_client_id is null then
    insert into public.clients (name, synthetic)
    values (coalesce(v_company.name, v_deal.name), false)
    returning id into v_client_id;
  end if;

  insert into public.projects (client_id, name, deal_id, synthetic)
  values (v_client_id, v_deal.name, v_deal_id, false)
  returning id into v_project_id;

  if v_make_invoice and v_deal.value_usd is not null and v_deal.value_usd > 0 then
    v_amount_cents := round(v_deal.value_usd * 100)::bigint;
    insert into public.invoices
      (project_id, amount_cents, currency, status, source_deal_id, synthetic)
    values (v_project_id, v_amount_cents, 'usd', 'draft', v_deal_id, false)
    returning id into v_invoice_id;
  end if;

  insert into public.touchpoints (client_id, project_id, kind, content, synthetic)
  values (v_client_id, v_project_id, 'deal_won',
          jsonb_build_object('deal_id', v_deal_id, 'actor', v_actor), false);

  insert into public.agent_log
    (operator, sop, step, client_id, trigger, payload, outcome, escalated, synthetic)
  values ('deal-conversion', '02-sales-pipeline', 'close', v_client_id, 'convert_won_deal',
          jsonb_build_object('dealId', v_deal_id, 'projectId', v_project_id,
                             'invoiceId', v_invoice_id, 'actor', v_actor),
          'deal_converted', false, false);

  return jsonb_build_object(
    'client_id', v_client_id,
    'project_id', v_project_id,
    'invoice_id', v_invoice_id,
    'already_converted', false
  );
end
$$;

comment on function public.convert_won_deal(jsonb) is
  'Converts one won deal into a client, a project, and a DRAFT invoice. Caller asserts the deal is won. Idempotent per deal. Sends nothing, issues nothing.';

revoke all on function public.convert_won_deal(jsonb) from public;
revoke all on function public.convert_won_deal(jsonb) from anon, authenticated;
grant execute on function public.convert_won_deal(jsonb) to service_role;
