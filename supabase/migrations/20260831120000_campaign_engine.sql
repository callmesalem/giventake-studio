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
  -- When this row was last claimed for sending. Distinct from created_at on
  -- purpose: a re-claim rewrites status and attempts but leaves created_at at
  -- the first attempt, so created_at cannot tell a freshly re-claimed row from
  -- one abandoned hours ago. Staleness is measured from here.
  claimed_at timestamptz not null default now(),
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
      -- Stop sequencing anyone who is no longer a prospect. convertLead records
      -- a conversion as leads.status = 'converted' (src/lib/crm-data.ts), and a
      -- converted lead is already a client — continuing to send them cold
      -- outreach is the sequence arriving after they have signed.
      --
      -- EXISTS rather than a join, for the same reason as the checks above:
      -- campaign_enrollments must stay the only table in this FROM list so
      -- FOR UPDATE SKIP LOCKED locks enrollment rows alone. It also covers a
      -- missing lead row defensively.
      and exists (
        select 1 from leads l
        where l.id = e.lead_id
          and coalesce(l.status, '') <> 'converted'
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

-- 4. Claim one step for sending, as a state machine. The boolean this replaces
--    could not express "this failed and may be retried", so a failed step was
--    re-claimed by claim_due every tick and skipped forever.
create or replace function public.campaign_claim_step(
  p_enrollment_id uuid, p_step_order int, p_max_attempts int default 3,
  p_stale_seconds int default 900
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_attempts int;
  v_claimed_at timestamptz;
begin
  insert into campaign_sends (enrollment_id, step_order, status, attempts, claimed_at)
  values (p_enrollment_id, p_step_order, 'sending', 1, now())
  on conflict (enrollment_id, step_order) do nothing;

  if found then
    return 'claimed';
  end if;

  select status, attempts, claimed_at into v_status, v_attempts, v_claimed_at
    from campaign_sends
   where enrollment_id = p_enrollment_id and step_order = p_step_order
     for update;

  -- Already delivered: a previous tick sent it and then crashed before
  -- advancing. The caller must advance WITHOUT sending again.
  if v_status = 'sent' then
    return 'already_sent';
  end if;

  if v_status = 'sending' then
    -- Still 'sending' long after it was claimed means the tick holding it died
    -- between claiming and recording. We cannot know whether Resend accepted
    -- it, and the house rule is that ambiguity resolves to sent — the same rule
    -- the runner applies to a network throw. Resolve it the same way rather
    -- than leaving the enrollment stalled here forever.
    --
    -- The default window is well beyond the 300s claim lease and any plausible
    -- tick duration, and the greatest(60, ...) floor stops a caller shrinking
    -- it far enough to mistake a live concurrent tick for a dead one.
    if v_claimed_at < now() - make_interval(secs => greatest(60, p_stale_seconds)) then
      update campaign_sends
         set status = 'sent', error = coalesce(error, 'stale_sending')
       where enrollment_id = p_enrollment_id and step_order = p_step_order;
      return 'already_sent';
    end if;
    -- Claimed recently: another tick almost certainly holds it right now.
    -- Leave it alone; it resolves itself, or goes stale and is swept above.
    return 'in_flight';
  end if;

  if v_attempts >= p_max_attempts then
    return 'exhausted';
  end if;

  update campaign_sends
     set status = 'sending', attempts = attempts + 1, error = null, claimed_at = now()
   where enrollment_id = p_enrollment_id and step_order = p_step_order;
  return 'claimed';
end;
$$;

-- Record the outcome of a claimed step.
create or replace function public.campaign_record_result(
  p_enrollment_id uuid, p_step_order int, p_status text,
  p_provider_message_id text default null, p_error text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update campaign_sends
     set status = p_status,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = p_error,
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where enrollment_id = p_enrollment_id and step_order = p_step_order;
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
revoke all on function public.campaign_claim_step(uuid, int, int, int) from public;
grant execute on function public.campaign_claim_step(uuid, int, int, int) to service_role;
revoke all on function public.campaign_record_result(uuid, int, text, text, text) from public;
grant execute on function public.campaign_record_result(uuid, int, text, text, text) to service_role;
revoke all on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) from public;
grant execute on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) to service_role;

-- 6. The inbound paths. A Resend delivery event and an inbound reply both know
--    a provider message id and nothing else; campaign_sends is the only place
--    that maps one back to an enrollment.
--
--    There is no advance flag: everything arriving this way - a bounce, a
--    complaint, a reply - is terminal, and advancing a bounced enrollment
--    would queue the next email straight at an address that just bounced.
--
--    An id we never sent is a no-op rather than an error. Resend delivers
--    events for the transactional mail in src/lib/intake.ts too, and a reply
--    can thread onto anything at all.
create or replace function public.campaign_mark_by_message(
  p_provider_message_id text, p_status text,
  p_event_type text default 'status_changed', p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enrollment uuid;
begin
  -- Two forms of the same id. campaign_sends.provider_message_id holds the id
  -- Resend's API returned - a bare uuid - but a reply's In-Reply-To/References
  -- headers hold the RFC-822 form, "<uuid@sending-domain>", of which reply.ts
  -- hands us "uuid@sending-domain". Matching on equality alone means no reply
  -- ever matches and the entire reply path is dead. split_part returns the
  -- whole string when there is no '@', so the bounce path (which passes the
  -- bare id from data.email_id) is unaffected.
  select enrollment_id into v_enrollment
  from campaign_sends
  where provider_message_id is not null
    and provider_message_id in (
      p_provider_message_id,
      split_part(p_provider_message_id, '@', 1)
    )
  order by created_at desc
  limit 1;
  if v_enrollment is null then return; end if;

  update campaign_enrollments
    set status = p_status, updated_at = now() where id = v_enrollment;
  insert into campaign_events (enrollment_id, event_type, details)
  values (v_enrollment, p_event_type, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.campaign_mark_by_message(text, text, text, jsonb) from public;
grant execute on function public.campaign_mark_by_message(text, text, text, jsonb) to service_role;
