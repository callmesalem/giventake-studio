-- Website lead capture (draft + track only; no sending).
--
-- Additive migration. It (1) completes the lean CRM schema from
-- docs/operations/01-tooling-stack.md by adding the two missing tables
-- (`invoices`, `agent_log`) and enriching `leads` with real-intake columns, and
-- (2) adds ONE narrow SECURITY DEFINER RPC, `capture_website_lead`, that records
-- a real (non-synthetic) website contact-form submission as a lead + touchpoint
-- and a charter §9 agent_log row.
--
-- Safety envelope (unchanged by this migration):
--   * No operator run is started; the synthetic CFO/CRO pipeline and every one of
--     its fixture guards are untouched. This is a separate, independently
--     auditable capture path, not a relaxation of the synthetic guards.
--   * Nothing here sends. `send`/`deploy`/etc. remain HARD_DENIED and no transport
--     exists. Recording an inbound lead is "track", not outbound.
--   * Direct table access stays revoked for anon/authenticated/service_role.
--     Runtime reaches data only through this definer RPC.
--   * Grants and revokes below are scoped to the NEW objects only — no broad
--     schema-wide REVOKE.

-- 1. Enrich `leads` for real website intake. All additive and nullable/defaulted.
alter table public.leads add column if not exists company text;
alter table public.leads add column if not exists description text;
alter table public.leads add column if not exists budget text;
alter table public.leads add column if not exists timeline text;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists source_detail text;
alter table public.leads add column if not exists attribution jsonb not null default '{}'
  check (jsonb_typeof(attribution) = 'object');
alter table public.leads add column if not exists status text not null default 'new';
alter table public.leads add column if not exists captured_at timestamptz not null default now();
alter table public.leads add column if not exists qualified_at timestamptz;
alter table public.leads add column if not exists qualification jsonb;
alter table public.leads add column if not exists last_touch_at timestamptz;
create index if not exists leads_status_idx on public.leads(status, created_at desc);
create unique index if not exists leads_real_email_uidx
  on public.leads(lower(email)) where synthetic = false;

-- 2. Missing lean tables from the tooling-stack data model.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects,
  stripe_id text,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

-- Charter §9 agent activity log. Distinct from operator_audit_events (which is the
-- tightly-scoped synthetic-run audit trail); this is the general operator log.
create table if not exists public.agent_log (
  id bigint generated always as identity primary key,
  operator text not null,
  sop text,
  step text,
  client_id uuid references public.clients,
  lead_id uuid references public.leads,
  trigger text,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  outcome text,
  escalated boolean not null default false,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agent_log_created_idx on public.agent_log(created_at desc);

alter table public.invoices enable row level security;
alter table public.agent_log enable row level security;
-- Scoped to the two new tables only: keep the fail-closed no-direct-access posture.
revoke all on table public.invoices, public.agent_log from anon, authenticated, service_role;
revoke all on sequence public.agent_log_id_seq from anon, authenticated, service_role;

comment on table public.invoices is 'Lean CRM invoices (docs/operations/01-tooling-stack.md). Stripe-linked; no direct role grants.';
comment on table public.agent_log is 'Charter §9 agent activity log. Written via SECURITY DEFINER RPCs only; no direct role grants.';

-- 3. Narrow capture RPC. Records a real inbound lead; never sends, never starts a run.
create function public.capture_website_lead(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_allowed text[] := array['email','name','company','description','budget','timeline','source','source_detail','attribution'];
  v_attr_allowed text[] := array['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer'];
  v_email text;
  v_name text;
  v_company text;
  v_description text;
  v_attr jsonb;
  v_lead uuid;
  v_touchpoint uuid;
  v_duplicate boolean := false;
  v_suppressed boolean;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'object payload required';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k where not (k = any(v_allowed))) then
    raise exception 'unexpected payload key';
  end if;

  v_email := lower(trim(p_payload->>'email'));
  v_name := trim(p_payload->>'name');
  v_company := nullif(trim(coalesce(p_payload->>'company','')), '');
  v_description := trim(coalesce(p_payload->>'description',''));

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 255 then
    raise exception 'valid email required';
  end if;
  if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'valid name required';
  end if;
  if length(v_description) > 1500 then raise exception 'description too long'; end if;
  if v_company is not null and length(v_company) > 120 then raise exception 'company too long'; end if;
  if length(coalesce(p_payload->>'budget','')) > 80
     or length(coalesce(p_payload->>'timeline','')) > 80
     or length(coalesce(p_payload->>'source','')) > 80
     or length(coalesce(p_payload->>'source_detail','')) > 160 then
    raise exception 'field too long';
  end if;

  -- Sanitise attribution to the known keys with bounded text values.
  v_attr := '{}'::jsonb;
  if p_payload ? 'attribution' and jsonb_typeof(p_payload->'attribution') = 'object' then
    if exists (select 1 from jsonb_object_keys(p_payload->'attribution') k where not (k = any(v_attr_allowed))) then
      raise exception 'unexpected attribution key';
    end if;
    select coalesce(jsonb_object_agg(k, left(v, 200)), '{}'::jsonb) into v_attr
    from jsonb_each_text(p_payload->'attribution') as e(k, v)
    where v is not null and trim(v) <> '';
  end if;

  v_suppressed := exists (select 1 from do_not_contact where normalized_address = v_email);

  -- Dedupe on the real-lead email. Repeat submissions update the existing lead and
  -- add a fresh touchpoint rather than creating duplicate lead rows.
  select id into v_lead from leads where lower(email) = v_email and synthetic = false for update;
  if found then
    v_duplicate := true;
    update leads set
      name = coalesce(nullif(v_name, ''), name),
      company = coalesce(v_company, company),
      description = coalesce(nullif(v_description, ''), description),
      budget = coalesce(nullif(p_payload->>'budget',''), budget),
      timeline = coalesce(nullif(p_payload->>'timeline',''), timeline),
      source = coalesce(nullif(p_payload->>'source',''), source),
      source_detail = coalesce(nullif(p_payload->>'source_detail',''), source_detail),
      attribution = case when v_attr <> '{}'::jsonb then v_attr else attribution end,
      last_touch_at = now()
    where id = v_lead;
  else
    insert into leads(email, name, synthetic, company, description, budget, timeline,
                      source, source_detail, attribution, status, last_touch_at)
    values (v_email, v_name, false, v_company, nullif(v_description, ''),
            nullif(p_payload->>'budget',''), nullif(p_payload->>'timeline',''),
            nullif(p_payload->>'source',''), nullif(p_payload->>'source_detail',''),
            v_attr, case when v_suppressed then 'suppressed' else 'new' end, now())
    returning id into v_lead;
  end if;

  insert into touchpoints(lead_id, kind, content, synthetic)
  values (v_lead, 'website_contact_form',
          jsonb_build_object(
            'source', nullif(p_payload->>'source',''),
            'sourceDetail', nullif(p_payload->>'source_detail',''),
            'budget', nullif(p_payload->>'budget',''),
            'timeline', nullif(p_payload->>'timeline',''),
            'company', v_company,
            'description', nullif(v_description, ''),
            'attribution', v_attr,
            'suppressed', v_suppressed),
          false)
  returning id into v_touchpoint;

  insert into agent_log(operator, sop, step, lead_id, trigger, payload, outcome, escalated, synthetic)
  values ('website-intake', '02-sales-pipeline', 'capture', v_lead, 'contact_form',
          jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                             'duplicate', v_duplicate, 'suppressed', v_suppressed,
                             'source', nullif(p_payload->>'source','')),
          'lead_captured', false, false);

  return jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                            'duplicate', v_duplicate, 'suppressed', v_suppressed);
end $$;

-- New functions default-grant EXECUTE to PUBLIC; strip that and expose to the
-- server runtime role only. Scoped to this one function.
revoke all on function public.capture_website_lead(jsonb) from public;
grant execute on function public.capture_website_lead(jsonb) to service_role;
comment on function public.capture_website_lead(jsonb) is
  'Records a real inbound website lead (lead + touchpoint + agent_log). Never sends; never starts an operator run. service_role execute only.';
