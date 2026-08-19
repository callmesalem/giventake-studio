-- Campaign suite. Owned outreach campaigns: sequences, per-lead enrollments,
-- events. Draft + track only; sending stays human/gated. Runtime roles receive
-- NO table grants: access via narrow security-definer RPCs granted to
-- service_role only. Mirrors the operator-control security model (RLS on,
-- revoke from anon/authenticated, no direct table access).

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  channel text not null default 'email' check (channel in ('email','linkedin','manual')),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  audience jsonb not null default '{}' check (jsonb_typeof(audience)='object'),
  owner text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  step_order int not null check (step_order >= 0),
  delay_hours int not null default 0 check (delay_hours >= 0),
  channel text not null default 'email' check (channel in ('email','linkedin','manual')),
  template jsonb not null default '{}' check (jsonb_typeof(template)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create table public.campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  lead_id uuid not null references public.leads on delete cascade,
  status text not null default 'enrolled'
    check (status in ('enrolled','active','replied','unsubscribed','suppressed','bounced','completed','stopped')),
  current_step int not null default 0 check (current_step >= 0),
  last_advanced_at timestamptz not null default now(),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create table public.campaign_events (
  id bigint generated always as identity primary key,
  enrollment_id uuid not null references public.campaign_enrollments on delete cascade,
  event_type text not null,
  details jsonb not null default '{}' check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaign_enrollments enable row level security;
alter table public.campaign_events enable row level security;

revoke all on table public.campaigns, public.campaign_steps, public.campaign_enrollments, public.campaign_events
  from anon, authenticated;
revoke all on sequence public.campaign_events_id_seq from anon, authenticated;

-- Narrow RPCs. Service role only; no browser role grants; no direct table access.

create function public.campaign_upsert(
  p_id uuid, p_name text, p_goal text, p_channel text, p_status text, p_audience jsonb, p_owner text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if coalesce(p_status,'draft') not in ('draft','active','paused','completed','archived') then
    raise exception 'invalid status';
  end if;
  if p_id is null then
    insert into campaigns(name,goal,channel,status,audience,owner)
      values(p_name,p_goal,coalesce(p_channel,'email'),coalesce(p_status,'draft'),
             coalesce(p_audience,'{}'::jsonb),p_owner)
      returning id into v_id;
  else
    update campaigns set name=p_name, goal=p_goal, channel=coalesce(p_channel,channel),
      status=coalesce(p_status,status), audience=coalesce(p_audience,audience),
      owner=p_owner, updated_at=now()
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'campaign not found'; end if;
  end if;
  return v_id;
end $$;

-- Enroll a lead, honoring the do_not_contact suppression list via the canonical
-- operator_is_suppressed(). A suppressed address is recorded as 'suppressed' and
-- never enters active outreach. Idempotent on (campaign_id, lead_id).
create function public.campaign_enroll_lead(p_campaign_id uuid, p_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_email text; v_suppressed boolean;
begin
  select email into v_email from leads where id=p_lead_id;
  if v_email is null then raise exception 'lead not found'; end if;
  v_suppressed := public.operator_is_suppressed(v_email);
  insert into campaign_enrollments(campaign_id, lead_id, status)
    values(p_campaign_id, p_lead_id, case when v_suppressed then 'suppressed' else 'enrolled' end)
    on conflict (campaign_id, lead_id) do update set updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.campaign_record_event(p_enrollment_id uuid, p_event_type text, p_details jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint;
begin
  if p_details is null or jsonb_typeof(p_details)<>'object' then raise exception 'object details required'; end if;
  insert into campaign_events(enrollment_id,event_type,details)
    values(p_enrollment_id,p_event_type,p_details) returning id into v_id;
  return v_id;
end $$;

create function public.campaign_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'campaigns', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from campaigns c), '[]'::jsonb),
    'enrollmentsByStatus', coalesce(
      (select jsonb_object_agg(status, n) from (select status, count(*) n from campaign_enrollments group by status) s),
      '{}'::jsonb)
  ) $$;

revoke all on function
  public.campaign_upsert(uuid,text,text,text,text,jsonb,text),
  public.campaign_enroll_lead(uuid,uuid),
  public.campaign_record_event(uuid,text,jsonb),
  public.campaign_snapshot() from public;
grant execute on function
  public.campaign_upsert(uuid,text,text,text,text,jsonb,text),
  public.campaign_enroll_lead(uuid,uuid),
  public.campaign_record_event(uuid,text,jsonb),
  public.campaign_snapshot() to service_role;
