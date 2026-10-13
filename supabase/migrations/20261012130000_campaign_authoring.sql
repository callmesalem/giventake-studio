-- Campaign authoring from the CRM.
--
-- The engine (20260831120000) sends steps and the suite (20260818140000)
-- stores them, but nothing let a human write a step or read a campaign's
-- steps and enrollments: crm.marketing.tsx only created campaign rows. These
-- RPCs close that gap, in the same posture as the engine's: security
-- definer, service_role only, no browser role, no direct table access.
--
-- campaign_claim_due is redefined to also return the lead's company, so the
-- runner can fill {{company}} (src/lib/campaign-template.ts). Logic otherwise
-- unchanged from 20260831120000, including the stop-on-conversion check.

create or replace function public.campaign_step_upsert(
  p_campaign_id uuid,
  p_step_order int,
  p_delay_hours int,
  p_template jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_step_order is null or p_step_order < 0 then
    raise exception 'campaign_step_upsert: step_order must be 0 or more';
  end if;
  if p_delay_hours is null or p_delay_hours < 0 then
    raise exception 'campaign_step_upsert: delay_hours must be 0 or more';
  end if;
  if p_template is null or jsonb_typeof(p_template) <> 'object' then
    raise exception 'campaign_step_upsert: template must be an object';
  end if;
  if coalesce(btrim(p_template->>'subject'), '') = ''
     or coalesce(btrim(p_template->>'text'), '') = '' then
    raise exception 'campaign_step_upsert: template needs a subject and a text body';
  end if;
  if not exists (select 1 from campaigns where id = p_campaign_id) then
    raise exception 'campaign_step_upsert: campaign not found';
  end if;

  insert into campaign_steps (campaign_id, step_order, delay_hours, template)
  values (p_campaign_id, p_step_order, p_delay_hours, p_template)
  on conflict (campaign_id, step_order) do update
    set delay_hours = excluded.delay_hours,
        template = excluded.template
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.campaign_step_delete(p_campaign_id uuid, p_step_order int)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.campaign_steps
  where campaign_id = p_campaign_id and step_order = p_step_order;
$$;

create or replace function public.campaign_detail(p_campaign_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'campaign', (
      select jsonb_build_object(
        'id', c.id, 'name', c.name, 'goal', c.goal, 'channel', c.channel,
        'status', c.status, 'sop', c.sop
      )
      from public.campaigns c where c.id = p_campaign_id
    ),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'stepOrder', s.step_order, 'delayHours', s.delay_hours,
        'template', s.template
      ) order by s.step_order)
      from public.campaign_steps s where s.campaign_id = p_campaign_id
    ), '[]'::jsonb),
    'enrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'leadId', e.lead_id, 'name', l.name, 'email', l.email,
        'status', e.status, 'currentStep', e.current_step, 'updatedAt', e.updated_at
      ) order by e.created_at desc)
      from public.campaign_enrollments e
      join public.leads l on l.id = e.lead_id
      where e.campaign_id = p_campaign_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.campaign_step_upsert(uuid, int, int, jsonb) from public;
grant execute on function public.campaign_step_upsert(uuid, int, int, jsonb) to service_role;
revoke all on function public.campaign_step_delete(uuid, int) from public;
grant execute on function public.campaign_step_delete(uuid, int) to service_role;
revoke all on function public.campaign_detail(uuid) from public;
grant execute on function public.campaign_detail(uuid) to service_role;

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
    'company',      l.company,
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

revoke all on function public.campaign_claim_due(int, int) from public;
grant execute on function public.campaign_claim_due(int, int) to service_role;
