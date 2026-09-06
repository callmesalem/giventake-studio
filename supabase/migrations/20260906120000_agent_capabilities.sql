-- Agent capability model.
--
-- operator_system_control has read operators_enabled: false since 2026-08-18 and
-- stopped nothing. None of the ten write functions granted to crm_agent consulted
-- it. Sami read that switch and chose to respect it, which is good behaviour from a
-- well-configured agent and is not a control.
--
-- This makes the switch real, and adds the layer between "may never" and "may
-- always" — so an agent can enrich companies without being able to move deals.
--
-- Sources of truth for the ten function bodies re-created below:
-- docs/operations/operator-control/live-write-functions-2026-09-06.md, captured
-- from production and verified body-for-body against the repo (nine of ten match;
-- deal_advance_stage had no committed source and is recovered here).

-- ---------------------------------------------------------------------------
-- 1. What each agent may do
-- ---------------------------------------------------------------------------

create table if not exists public.agent_capabilities (
  agent_role  text not null,
  capability  text not null,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (agent_role, capability)
);

comment on table public.agent_capabilities is
  'What each agent role may do. capability is the function name deliberately, so this table and the GRANT list name the same things. A MISSING ROW DENIES: a new write function is off for every agent until someone turns it on.';

alter table public.agent_capabilities enable row level security;
-- service_role is essential here, not cosmetic: Supabase's default privileges for
-- new tables in the public schema grant it arwdDxtm, and it holds BYPASSRLS, so the RLS
-- above stops it from nothing. Without this revoke the capability table would be a
-- writable PostgREST endpoint — the fine-grained control would end up weaker than
-- the coarse switch it supplements. The three sibling control tables
-- (operator_system_control, operator_controls, operator_audit_events) are all
-- postgres-only for the same reason.
revoke all on table public.agent_capabilities from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The guard
-- ---------------------------------------------------------------------------

-- Called as the FIRST statement of every write function.
--
-- session_user, NOT current_user. These functions are SECURITY DEFINER owned by
-- postgres, so current_user inside them is postgres for every caller — a guard on
-- it would allow everything or deny everything, and would look correct in review.
-- Neither SECURITY DEFINER nor SET ROLE changes session_user; it stays the role
-- that opened the connection.
--
-- Order matters: the global switch is consulted before any capability row, so one
-- flip stops every agent regardless of what the table says.
create or replace function public.agent_require(p_capability text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   text := session_user;
  v_global   boolean;
  v_enabled  boolean;
  v_reason   text;
begin
  -- Callers that are not agents.
  --
  -- The dashboard reaches these same functions through PostgREST, which logs in as
  -- `authenticator` and then SET ROLEs to service_role. SET ROLE does not change
  -- session_user, so EVERY dashboard write arrives here as `authenticator`.
  -- Without this branch the guard would refuse every write in the CRM UI.
  --
  -- That path is the human one: authenticated and audited at the application
  -- layer, and not what this model governs. postgres and supabase_admin own these
  -- functions and can drop any guard, so gating them buys nothing.
  --
  -- This is a closed list, not a pattern. Any other role — including one added
  -- later — falls through and needs a capability row, so it denies by default.
  if v_caller in ('authenticator', 'postgres', 'supabase_admin', 'cli_login_postgres') then
    return;
  end if;

  select operators_enabled into v_global
    from public.operator_system_control
    where id = 'global';

  if coalesce(v_global, false) is not true then
    v_reason := 'operators_disabled';
  else
    select enabled into v_enabled
      from public.agent_capabilities
      where agent_role = v_caller and capability = p_capability;

    if v_enabled is null then
      v_reason := 'capability_missing';
    elsif v_enabled is not true then
      v_reason := 'capability_disabled';
    end if;
  end if;

  if v_reason is null then
    -- Allowed. This row commits with the write it authorised, which is what makes
    -- it a usable trail: "what did Sami change last Tuesday".
    insert into public.operator_audit_events(operator_key, event_type, details)
    values (v_caller, 'capability_allowed',
            jsonb_build_object('capability', p_capability));
    return;
  end if;

  -- Denied.
  --
  -- A refusal CANNOT be recorded in operator_audit_events. Raising aborts the
  -- transaction and takes any row inserted here with it, so an insert placed above
  -- the raise would look like an audit trail while always rolling back — worse
  -- than having none, because an operator would search for denials, find zero, and
  -- conclude nothing had been refused.
  --
  -- The server log is not transactional and survives the abort, so that is where
  -- the durable record goes. See the runbook for how to query it.
  raise warning 'agent_capability_denied caller=% capability=% reason=%',
    v_caller, p_capability, v_reason;

  raise exception 'agent_capability_denied: % (%, %)', v_reason, v_caller, p_capability
    using errcode = 'check_violation';
end $;

comment on function public.agent_require(text) is
  'Capability guard for agent write paths. Reads session_user, checks the global kill switch, then the per-agent capability row, audits both outcomes, and raises on refusal. Callers that are not agents (authenticator, postgres, supabase_admin) pass through.';

revoke all on function public.agent_require(text) from public;

-- ---------------------------------------------------------------------------
-- 3. The ten write functions, re-created with the guard as their first statement
-- ---------------------------------------------------------------------------
--
-- Bodies are unchanged from production. The only edit to each is the added
-- `perform public.agent_require(...)` line naming that function's own capability.

create or replace function public.approval_request(p_agent_name text, p_action_type text, p_target_type text, p_target_id text, p_summary text, p_payload jsonb, p_risk_level text, p_expires_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('approval_request');
  if coalesce(p_risk_level,'medium') not in ('low','medium','high','critical') then
    raise exception 'invalid risk level';
  end if;
  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;
  insert into approval_queue(agent_name,action_type,target_type,target_id,summary,proposed_payload,risk_level,expires_at)
    values(p_agent_name,p_action_type,p_target_type,p_target_id,p_summary,
           coalesce(p_payload,'{}'::jsonb), coalesce(p_risk_level,'medium'), p_expires_at)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.company_upsert(p_source text, p_source_record_id text, p_name text, p_domain text, p_description text, p_categories jsonb, p_employee_range text, p_location text, p_socials jsonb, p_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('company_upsert');
  insert into companies(source,source_record_id,name,domain,description,categories,employee_range,location,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_name, p_domain, p_description,
           coalesce(p_categories,'[]'::jsonb), p_employee_range, p_location,
           coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      name=excluded.name, domain=excluded.domain, description=excluded.description,
      categories=excluded.categories, employee_range=excluded.employee_range,
      location=excluded.location, socials=excluded.socials, metadata=excluded.metadata,
      updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.contact_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_email text, p_phone text, p_job_title text, p_socials jsonb, p_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('contact_upsert');
  insert into contacts(source,source_record_id,company_id,name,email,phone,job_title,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_email,
           p_phone, p_job_title, coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, email=excluded.email,
      phone=excluded.phone, job_title=excluded.job_title, socials=excluded.socials,
      metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.deal_advance_stage(p_deal_id uuid, p_to_stage text, p_note text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from_stage text;
  v_event_id uuid;
begin
  perform public.agent_require('deal_advance_stage');
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
end $$;

create or replace function public.deal_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_stage text, p_value_usd numeric, p_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('deal_upsert');
  insert into deals(source,source_record_id,company_id,name,stage,value_usd,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_stage,
           p_value_usd, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, stage=excluded.stage,
      value_usd=excluded.value_usd, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

-- p_lead_id keeps its DEFAULT NULL::uuid. Dropping it here would silently break
-- every six-argument caller.
create or replace function public.note_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_title text, p_content text, p_metadata jsonb, p_lead_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('note_upsert');
  insert into notes(source,source_record_id,company_id,lead_id,title,content,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_lead_id,
           p_title, p_content, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, lead_id=excluded.lead_id, title=excluded.title,
      content=excluded.content, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end
$$;

create or replace function public.referral_partner_upsert(p_id uuid, p_name text, p_kind text, p_contact_email text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('referral_partner_upsert');
  if coalesce(p_kind,'individual') not in ('individual','firm','partner') then
    raise exception 'invalid kind';
  end if;
  if p_id is null then
    insert into referral_partners(name,kind,contact_email,notes)
      values(p_name,coalesce(p_kind,'individual'),p_contact_email,p_notes)
      returning id into v_id;
  else
    update referral_partners set name=p_name, kind=coalesce(p_kind,kind),
      contact_email=p_contact_email, notes=p_notes, updated_at=now()
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'referral partner not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.referral_record(p_partner_id uuid, p_lead_id uuid, p_company_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('referral_record');
  insert into referrals(partner_id, lead_id, company_name)
    values(p_partner_id, p_lead_id, p_company_name)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.referral_set_status(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count bigint;
begin
  perform public.agent_require('referral_set_status');
  if p_status not in ('received','qualified','converted','declined') then
    raise exception 'invalid status';
  end if;
  update referrals set status=p_status, updated_at=now() where id=p_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

create or replace function public.task_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_content text, p_is_completed boolean, p_deadline_at timestamptz, p_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('task_upsert');
  insert into tasks(source,source_record_id,company_id,content,is_completed,deadline_at,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_content, coalesce(p_is_completed,false), p_deadline_at, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, content=excluded.content, is_completed=excluded.is_completed,
      deadline_at=excluded.deadline_at, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Sami's role
-- ---------------------------------------------------------------------------

-- One role per agent, so identity is proven by the connection rather than claimed
-- in a parameter. No table grants and no RLS bypass — the same shape as crm_agent.
-- The password is set out of band and never appears in a migration.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_sami') then
    create role agent_sami login noinherit;
  end if;
end $$;

grant usage on schema public to agent_sami;

-- agent_require is deliberately NOT granted to the agent. The ten write functions
-- are SECURITY DEFINER owned by postgres, so the nested call is checked against
-- current_user = postgres, who owns the guard: it works with no grant to the
-- caller. Granting it would hand the agent a direct call with an arbitrary
-- capability string, and every call writes an audit row that UPDATE/DELETE cannot
-- remove — an audit-forgery primitive, and a way to enumerate its own capabilities.

-- The same 22 functions crm_agent holds: ten writes and twelve reads. Listed
-- explicitly rather than looped — a grant list is a security boundary and should
-- be readable.
grant execute on function
  public.activity_snapshot(),
  public.approval_queue_list(text),
  public.approval_request(text,text,text,text,text,jsonb,text,timestamptz),
  public.attribution_snapshot(),
  public.check_operator_control(text,operator_mode),
  public.company_upsert(text,text,text,text,text,jsonb,text,text,jsonb,jsonb),
  public.contact_upsert(text,text,uuid,text,text,text,text,jsonb,jsonb),
  public.deal_advance_stage(uuid,text,text,text),
  public.deal_upsert(text,text,uuid,text,text,numeric,jsonb),
  public.is_approved_recipient(text,text),
  public.leads_list(integer),
  public.note_upsert(text,text,uuid,text,text,jsonb,uuid),
  public.operator_get_controls(text),
  public.operator_get_system_control(),
  public.operator_is_suppressed(text),
  public.pipeline_stages_list(),
  public.prospecting_snapshot(),
  public.referral_partner_upsert(uuid,text,text,text,text),
  public.referral_record(uuid,uuid,text),
  public.referral_set_status(uuid,text),
  public.referral_snapshot(),
  public.task_upsert(text,text,uuid,text,boolean,timestamptz,jsonb)
  to agent_sami;

-- All ten enabled for BOTH roles, which reproduces today's behaviour exactly.
--
-- crm_agent is not a leftover. Sami connects as crm_agent TODAY, and the moment
-- this migration lands the guard — not the GRANT list — becomes the gate. Since
-- `create or replace` preserves the existing ACL, crm_agent would keep every grant
-- and lose the ability to use any of them: seeded rows for agent_sami alone would
-- cut Sami off the instant this applies, in exactly the live window the deploy
-- order was designed to protect.
--
-- crm_agent is deliberately seeded rather than added to the guard's exemption
-- list; exempting it would leave it permanently ungoverned. Its rows are deleted
-- in the same step that revokes its grants — see the runbook.
--
-- This migration makes restriction POSSIBLE; it does not restrict. Changing what
-- Sami may do is a separate, deliberate decision, and bundling it here would hide
-- a behaviour change inside an infrastructure change.
insert into public.agent_capabilities(agent_role, capability, enabled, updated_by)
values
  ('agent_sami','approval_request',true,'migration'),
  ('agent_sami','company_upsert',true,'migration'),
  ('agent_sami','contact_upsert',true,'migration'),
  ('agent_sami','deal_advance_stage',true,'migration'),
  ('agent_sami','deal_upsert',true,'migration'),
  ('agent_sami','note_upsert',true,'migration'),
  ('agent_sami','referral_partner_upsert',true,'migration'),
  ('agent_sami','referral_record',true,'migration'),
  ('agent_sami','referral_set_status',true,'migration'),
  ('agent_sami','task_upsert',true,'migration'),
  ('crm_agent','approval_request',true,'migration'),
  ('crm_agent','company_upsert',true,'migration'),
  ('crm_agent','contact_upsert',true,'migration'),
  ('crm_agent','deal_advance_stage',true,'migration'),
  ('crm_agent','deal_upsert',true,'migration'),
  ('crm_agent','note_upsert',true,'migration'),
  ('crm_agent','referral_partner_upsert',true,'migration'),
  ('crm_agent','referral_record',true,'migration'),
  ('crm_agent','referral_set_status',true,'migration'),
  ('crm_agent','task_upsert',true,'migration')
on conflict (agent_role, capability) do nothing;

-- ---------------------------------------------------------------------------
-- 5. The switch this whole migration exists to make real
-- ---------------------------------------------------------------------------
--
-- READ THIS BEFORE APPLYING.
--
-- operator_system_control.operators_enabled has read false since 2026-08-18 while
-- enforcing nothing, so agents have been writing freely the entire time. The
-- record and the reality disagree, and this migration is what connects them.
--
-- The guard consults this switch BEFORE any capability row. So if it is still
-- false when this applies, every agent write raises operators_disabled and the ten
-- seeded rows above are never even read — the migration would be a total outage
-- rather than the behaviour-neutral change it is meant to be.
--
-- Setting it true does not grant anything new. It records what has been true in
-- practice since 2026-08-18, and it is what makes flipping it to false a real
-- control for the first time.
--
-- IF YOU WANT AGENTS OFF AT CUTOVER, DELETE THIS STATEMENT AND KNOW THAT SAMI
-- STOPS WRITING THE MOMENT THIS MIGRATION LANDS. That is a legitimate choice; it
-- is just not the default, because it is a behaviour change and this migration is
-- not the place to hide one.
update public.operator_system_control
   set operators_enabled = true,
       updated_at = now(),
       reason = 'agent capability model applied; per-capability control now lives in agent_capabilities'
 where id = 'global'
   and operators_enabled is not true;
