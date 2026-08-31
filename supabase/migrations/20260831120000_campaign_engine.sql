-- Campaign sequence engine: the sender for the schema added in 20260818140000.
--
-- Additive only. Same security model as the rest of this schema: RLS on,
-- no anon/authenticated grants, access via narrow SECURITY DEFINER RPCs
-- granted to service_role.

-- 1. The allowlist gate takes a SOP. campaigns had nowhere to put one, so
--    is_approved_recipient() could not be called for a campaign at all.
alter table public.campaigns add column if not exists sop text;
comment on column public.campaigns.sop is
  'Charter §3.8 SOP key, passed to is_approved_recipient(address, sop). A campaign with a null sop can never pass the gate and therefore can never send.';

-- 2. One row per (enrollment, step). The unique constraint is the idempotency
--    spine: a replayed tick collides here instead of sending a second email.
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.campaign_enrollments on delete cascade,
  step_order int not null check (step_order >= 0),
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  provider_message_id text,
  attempts int not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (enrollment_id, step_order)
);

create index if not exists campaign_sends_provider_idx
  on public.campaign_sends (provider_message_id);

alter table public.campaign_sends enable row level security;
alter table public.campaign_sends force row level security;
revoke all on table public.campaign_sends from anon, authenticated;

-- 3. Claim due enrollments under a lease. SKIP LOCKED so two overlapping ticks
--    never claim the same enrollment.
create or replace function public.campaign_claim_due(p_limit int, p_lease_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  with due as (
    -- Deliberately references only campaign_enrollments in its FROM list (the
    -- campaigns/campaign_steps checks are EXISTS subqueries, not joins) so
    -- that FOR UPDATE SKIP LOCKED locks only enrollment rows. Two ticks
    -- claiming different enrollments under the same campaign must never
    -- block each other on a shared campaigns/campaign_steps row.
    --
    -- The step check is an EXISTS, not a join with a defaulted delay,
    -- because an enrollment whose current_step is past the campaign's final
    -- step_order has no matching step row at all. That must EXCLUDE the
    -- enrollment, not be treated as "delay elapsed" — a defaulted delay of
    -- zero would make every finished enrollment due on every tick forever,
    -- rewriting its status/timestamps each time and consuming the claim
    -- batch that genuinely due enrollments need.
    select e.id
    from campaign_enrollments e
    where e.status in ('enrolled','active')
      and not coalesce(e.synthetic, false)
      and exists (
        select 1 from campaigns c
        where c.id = e.campaign_id and c.status = 'active'
      )
      and exists (
        select 1 from campaign_steps s
        where s.campaign_id = e.campaign_id
          and s.step_order = e.current_step
          and e.last_advanced_at + make_interval(hours => s.delay_hours) <= now()
      )
    order by e.last_advanced_at
    limit greatest(1, least(coalesce(p_limit, 25), 200))
    for update skip locked
  ),
  claimed as (
    update campaign_enrollments e
    set status = 'active',
        updated_at = now(),
        last_advanced_at = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 300)))
    from due
    where e.id = due.id
    returning e.id, e.campaign_id, e.lead_id, e.current_step
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'enrollmentId', cl.id,
    'campaignId',   cl.campaign_id,
    'stepOrder',    cl.current_step,
    'sop',          c.sop,
    'email',        l.email,
    'name',         l.name,
    'template',     s.template
  )), '[]'::jsonb)
  into result
  from claimed cl
  join campaigns c on c.id = cl.campaign_id
  join campaign_steps s on s.campaign_id = cl.campaign_id and s.step_order = cl.current_step
  join leads l on l.id = cl.lead_id;

  return result;
end;
$$;

-- 4. Record a send attempt. Returns false when the (enrollment, step) row
--    already exists, which is how a replay is refused.
create or replace function public.campaign_record_send(
  p_enrollment_id uuid, p_step_order int, p_status text,
  p_provider_message_id text default null, p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted boolean;
begin
  insert into campaign_sends (enrollment_id, step_order, status, provider_message_id, error, attempts, sent_at)
  values (p_enrollment_id, p_step_order, p_status, p_provider_message_id, p_error, 1,
          case when p_status = 'sent' then now() else null end)
  on conflict (enrollment_id, step_order) do nothing;

  get diagnostics inserted = row_count;
  if not inserted then
    update campaign_sends
      set status = p_status,
          provider_message_id = coalesce(p_provider_message_id, provider_message_id),
          error = p_error,
          attempts = attempts + 1,
          sent_at = case when p_status = 'sent' then now() else sent_at end
      where enrollment_id = p_enrollment_id and step_order = p_step_order
        and status = 'sending';
    return false;
  end if;
  return true;
end;
$$;

-- 5. Move an enrollment to a terminal or advanced state, with an audit event.
create or replace function public.campaign_mark_status(
  p_enrollment_id uuid, p_status text, p_advance boolean default false,
  p_event_type text default 'status_changed', p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update campaign_enrollments
    set status = p_status,
        current_step = case when p_advance then current_step + 1 else current_step end,
        last_advanced_at = now(),
        updated_at = now()
    where id = p_enrollment_id;

  insert into campaign_events (enrollment_id, event_type, details)
  values (p_enrollment_id, p_event_type, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.campaign_claim_due(int, int) from public;
grant execute on function public.campaign_claim_due(int, int) to service_role;
revoke all on function public.campaign_record_send(uuid, int, text, text, text) from public;
grant execute on function public.campaign_record_send(uuid, int, text, text, text) to service_role;
revoke all on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) from public;
grant execute on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) to service_role;
