-- crm_out_of_band_baseline: what exists in production that no migration ever
-- created. The crm_agent role and the pipeline objects.
--
-- Backfilled 2026-09-18 from the live catalog (pg_roles, information_schema.columns,
-- pg_get_constraintdef, pg_indexes, pg_get_functiondef and the twelve rows of
-- public.pipeline_stages), the same way 20260822234428_convert_won_deal.sql was
-- backfilled from the remote history. Without this file the chain cannot rebuild
-- the database. Replayed onto an empty Supabase Postgres it stops at
-- 20260820120000_operator_control_agent_access.sql ("role crm_agent does not
-- exist"), and past that 20260906120000_agent_capabilities.sql grants EXECUTE on
-- attribution_snapshot() and pipeline_stages_list(), which nothing defines, and
-- deal_advance_stage reads two tables nothing creates.
--
-- The version is chosen, not arbitrary. It has to come before 20260820120000,
-- which grants to crm_agent. It has to come after 20260819140000_force_rls.sql,
-- because production's two pipeline tables are not FORCEd and that migration
-- forces every table it finds. And it has to come before
-- 20260821200000_ownership_and_consent.sql: in production deals.lead_id,
-- closed_at and lost_reason are columns 12 to 14, ahead of owner_id (15), which
-- that migration adds.
--
-- PRODUCTION: do not run this. Every object already exists. Record it as applied
-- (`supabase migration repair --status applied 20260820110000`). Every statement
-- is idempotent anyway, so an accidental run changes nothing.
--
-- Left exactly as production has it, and fixed later by the grants
-- reconciliation migration rather than here: RLS on the two tables is enabled
-- but not FORCEd, and service_role holds every table privilege on both.

-- 0. The shared agent role. Login, no table grants, no BYPASSRLS; the password is
--    set out of band and never appears in a migration. Same shape as agent_sami in
--    20260906120000, except that production's crm_agent was created with the
--    default INHERIT. It is a member of nothing, so that changes no privilege.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_agent') then
    create role crm_agent login;
  end if;
end $$;

grant usage on schema public to crm_agent;

-- 1. The twelve-stage pipeline. `name` is what deals.stage and
--    deal_stage_events.to_stage reference, so it is unique as well as the number.
create table if not exists public.pipeline_stages (
  stage_number integer primary key,
  name text not null unique,
  artifact text not null,
  gate text not null,
  detail text,
  sort_order integer not null unique
);

insert into public.pipeline_stages (stage_number, name, artifact, gate, detail, sort_order) values
  (0, 'Lead arrives', 'Lead record', '—',
   'Track the lead source at intake — with no ad budget, knowing which channel produced the conversation is the only way to allocate time (see 08 §10).', 0),
  (1, 'Qualify (10 min)', 'Qualification note', 'Budget and fit plausible',
   'A 10-minute screening call or short email exchange. Five things to establish: what they''re trying to build or fix; what happens if they do nothing (the single best qualifier); is there a budget in range; what''s driving the timeline; who makes the decision. If it''s not a fit, decline directly and offer a referral.', 1),
  (2, 'Discovery call (45–60 min)', 'Discovery notes', 'Problem understood, quantified',
   'Structured, not a chat — use the core question set plus the modules for their business type and what they''re building. Ask for the last concrete instance, not the general description. Quantify everything (frequency, duration, cost). Do not design on the call. Send a same-day summary asking "did I get this right?".', 2),
  (3, 'Scope', 'Proposal + SOW', '—',
   'Small, clear projects go straight to a proposal. Complex or ambiguous ones get a paid discovery sprint ($750-1,500, credited against the build). The proposal contains the problem in the client''s words, what will and won''t be built, objective/testable acceptance criteria, a timeline with their dependencies marked, a fixed price with payment schedule, and what''s needed from them. Never quote on a call.', 3),
  (4, 'Close', 'Signed SOW + deposit', 'Signed and paid before any code',
   'Signed SOW and cleared deposit before any code is written — no exceptions. Documents: MSA (once per client) + SOW (per project). Send the AI use disclosure alongside it.', 4),
  (5, 'Kickoff', 'Kickoff note + baseline measured', 'Access granted, baseline recorded',
   'Confirm the decision-maker, collect access (repos/hosting/domain/accounts), set the recurring weekly demo slot, agree the communication channel and response times, confirm no AI restrictions (MSA §3.4). Before anything is built, record the current numbers in writing from the client: how long the process takes, how often it happens, error/no-show/rework rate, how many people touch it, what it costs. This is the case-study baseline and is not optional.', 5),
  (6, 'Build cycles', 'Weekly demo + written update', 'Client saw it working each week',
   'Weekly rhythm, non-negotiable: a working demo every week (something they can click, not a status update), plus a written update — what shipped, what''s next, what''s needed from them, anything at risk. Scope changes go through a written Change Order before the work happens. Client silence is noted in writing with the timeline impact.', 6),
  (7, 'Delivery review', 'Review checklist', 'Nothing ships without it',
   'The specific commitment made publicly on the site ("nothing ships without manual human review"). Covers the review standard in 04-ai-delivery-policy.md §5: every AI-generated file read by a human, auth/authorization/payment paths reviewed line by line, tests passing on critical paths, licence scan and SBOM, no secrets committed, dependency vulnerabilities checked. The completed checklist is kept in the repo.', 7),
  (8, 'Acceptance', 'Written acceptance', 'Meets SOW criteria',
   'Tested against the SOW''s original acceptance criteria from Stage 3, not a new set invented now. Client has 10 business days to accept or report a material defect in writing. Defects against the criteria are fixed free; anything beyond them is a change request. Acceptance is obtained in writing.', 8),
  (9, 'Handoff', 'Handoff package', 'Client can operate it',
   'Source code and repository access; a deployed environment the client controls; written documentation; a 30-minute recorded walkthrough; SBOM and licence scan report; credentials transferred and the vendor''s own access removed or reduced, confirmed in writing.', 9),
  (10, 'Support window', 'Support log', 'Window expires or converts',
   '14 / 30 / 60 days depending on tier. Every request logged: what it was, defect vs. new request, how long it took. Also the natural opening for a retainer conversation when requests keep arriving after the window closes.', 10),
  (11, 'Retro', 'Retro note + testimonial + metrics', 'Case study material captured',
   'Two weeks after handoff. Internally: estimated vs. actual hours, effective hourly rate, what broke, and process-document updates. With the client: re-measure the Stage 5 baseline numbers (the case study), ask for a testimonial, a Google review, and referrals, and raise the retainer if the work is ongoing.', 11)
on conflict (stage_number) do nothing;

-- 2. Deals learn where they came from and how they ended.
alter table public.deals add column if not exists lead_id uuid;
alter table public.deals add column if not exists closed_at timestamptz;
alter table public.deals add column if not exists lost_reason text;

-- 3. Clients remember the lead and the deal they grew out of.
alter table public.clients add column if not exists lead_id uuid;
alter table public.clients add column if not exists deal_id uuid;

-- 3b. Referrals learn what was owed and whether it was paid. The Referrals page
--     reads paid_at (src/routes/crm.referrals.tsx). Columns 10 to 12 in
--     production, ahead of owner_id (13), so the same window as the rest.
alter table public.referrals add column if not exists amount numeric;
alter table public.referrals add column if not exists paid_at timestamptz;
alter table public.referrals add column if not exists invoice_id uuid;

-- Constraints are added by name so a second run finds them and does nothing.
-- `add column if not exists ... references` would skip the column but could not
-- express that for the constraint on its own.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_lead_id_fkey' and conrelid = 'public.deals'::regclass) then
    alter table public.deals add constraint deals_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'deals_stage_fkey' and conrelid = 'public.deals'::regclass) then
    alter table public.deals add constraint deals_stage_fkey
      foreign key (stage) references public.pipeline_stages(name);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_lead_id_fkey' and conrelid = 'public.clients'::regclass) then
    alter table public.clients add constraint clients_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_deal_id_fkey' and conrelid = 'public.clients'::regclass) then
    alter table public.clients add constraint clients_deal_id_fkey
      foreign key (deal_id) references public.deals(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_amount_check' and conrelid = 'public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_amount_check
      check (amount is null or amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_invoice_id_fkey' and conrelid = 'public.referrals'::regclass) then
    alter table public.referrals add constraint referrals_invoice_id_fkey
      foreign key (invoice_id) references public.invoices(id) on delete set null;
  end if;
end $$;

-- 4. The stage history. A deleted deal takes its history with it; a stage name
--    cannot be removed while an event still points at it.
create table if not exists public.deal_stage_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_stage text,
  to_stage text not null references public.pipeline_stages(name),
  note text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists deal_stage_events_deal_id_idx on public.deal_stage_events (deal_id);

alter table public.pipeline_stages enable row level security;
alter table public.deal_stage_events enable row level security;

revoke all on table public.pipeline_stages, public.deal_stage_events from public, anon, authenticated;
grant all on table public.pipeline_stages, public.deal_stage_events to service_role;

-- 5. Functions. Both SQL-language bodies are checked when they are created, which
--    is why the columns above come first.
create or replace function public.pipeline_stages_list()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'stageNumber', stage_number,
      'name', name,
      'artifact', artifact,
      'gate', gate,
      'detail', detail,
      'sortOrder', sort_order
    ) order by sort_order), '[]'::jsonb)
  from pipeline_stages
$function$;

create or replace function public.attribution_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with lead_rollup as (
    select
      coalesce(l.source, 'unknown') as source,
      l.id as lead_id,
      exists (select 1 from deals d where d.lead_id = l.id) as became_deal,
      exists (select 1 from clients c where c.lead_id = l.id) as became_client,
      (select coalesce(sum(d.value_usd), 0)
         from deals d
        where d.lead_id = l.id
          and d.closed_at is not null
          and d.lost_reason is null) as value_won
    from leads l
  )
  select jsonb_build_object(
    'bySource', coalesce(
      (select jsonb_agg(row_obj order by row_obj ->> 'source')
         from (
           select jsonb_build_object(
             'source', source,
             'leads', count(*),
             'deals', count(*) filter (where became_deal),
             'clients', count(*) filter (where became_client),
             'valueWonUsd', coalesce(sum(value_won), 0)
           ) as row_obj
           from lead_rollup
           group by source
         ) s
      ), '[]'::jsonb
    ),
    'generatedAt', now()
  )
$function$;

-- deal_advance_stage as it ran before 20260906120000_agent_capabilities.sql put
-- the agent_require guard in front of it. Recovered from pg_get_functiondef and
-- kept until now only in
-- docs/operations/operator-control/live-write-functions-2026-09-06.md. That later
-- migration replaces this body, so the end state is unchanged; what this adds is
-- that the function exists, with the right grants, for the two weeks it did.
create or replace function public.deal_advance_stage(p_deal_id uuid, p_to_stage text, p_note text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_from_stage text;
  v_event_id uuid;
begin
  if not exists (select 1 from pipeline_stages where name = p_to_stage) then
    raise exception 'unknown pipeline stage: %', p_to_stage;
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'note is required to advance a deal stage (state the evidence, not just the destination)';
  end if;
  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'actor is required to advance a deal stage';
  end if;

  select stage into v_from_stage from deals where id = p_deal_id for update;
  if not found then
    raise exception 'deal not found: %', p_deal_id;
  end if;

  update deals set stage = p_to_stage, updated_at = now() where id = p_deal_id;

  insert into deal_stage_events (deal_id, from_stage, to_stage, note, actor)
    values (p_deal_id, v_from_stage, p_to_stage, p_note, p_actor)
    returning id into v_event_id;

  return jsonb_build_object(
    'eventId', v_event_id,
    'dealId', p_deal_id,
    'fromStage', v_from_stage,
    'toStage', p_to_stage
  );
end $function$;

revoke all on function
  public.pipeline_stages_list(),
  public.attribution_snapshot(),
  public.deal_advance_stage(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.pipeline_stages_list(),
  public.attribution_snapshot(),
  public.deal_advance_stage(uuid, text, text, text)
to service_role;

-- 6. What crm_agent could call. Production grants it EXECUTE on 22 functions. Five
--    of those grants are in migrations (20260820120000, 20260820130000,
--    20260821230000). These seventeen were granted by hand. Listed rather than
--    looped, for the reason 20260906120000 gives: a grant list is a security
--    boundary and should be readable. Every function here already exists at this
--    version, and none is dropped later, so the grants survive to the end of the
--    chain. crm_agent itself is due to be revoked once agent_sami takes over; this
--    records what it held, it does not endorse keeping it.
grant execute on function
  public.activity_snapshot(),
  public.approval_queue_list(text),
  public.approval_request(text, text, text, text, text, jsonb, text, timestamptz),
  public.attribution_snapshot(),
  public.company_upsert(text, text, text, text, text, jsonb, text, text, jsonb, jsonb),
  public.contact_upsert(text, text, uuid, text, text, text, text, jsonb, jsonb),
  public.deal_advance_stage(uuid, text, text, text),
  public.deal_upsert(text, text, uuid, text, text, numeric, jsonb),
  public.leads_list(integer),
  public.operator_is_suppressed(text),
  public.pipeline_stages_list(),
  public.prospecting_snapshot(),
  public.referral_partner_upsert(uuid, text, text, text, text),
  public.referral_record(uuid, uuid, text),
  public.referral_set_status(uuid, text),
  public.referral_snapshot(),
  public.task_upsert(text, text, uuid, text, boolean, timestamptz, jsonb)
to crm_agent;
