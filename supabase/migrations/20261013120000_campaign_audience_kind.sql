-- Two audiences with different compliance treatment (campaign engine plan,
-- follow-up 4). Until now every enrollment was cold outreach: the address had
-- to be on the per-SOP human allowlist (is_approved_recipient). A lead who
-- ticked the consent box on the site asked to hear from us, and gating that
-- nurture on a hand-typed allowlist is the wrong consent model.
--
-- campaigns.audience jsonb carries {"kind": "cold" | "opt_in"}; absent means
-- cold, so every existing campaign keeps today's behaviour. The runner reads
-- the kind and the lead's consent_given off the claimed row and decides in
-- src/server/campaigns/policy.ts; nothing here loosens do_not_contact.

create or replace function public.campaign_set_audience_kind(p_campaign_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind is null or p_kind not in ('cold', 'opt_in') then
    raise exception 'campaign audience kind must be cold or opt_in';
  end if;
  update campaigns
    set audience = coalesce(audience, '{}'::jsonb) || jsonb_build_object('kind', p_kind),
        updated_at = now()
    where id = p_campaign_id;
  if not found then
    raise exception 'campaign not found';
  end if;
end;
$$;

revoke all on function public.campaign_set_audience_kind(uuid, text) from public;
grant execute on function public.campaign_set_audience_kind(uuid, text) to service_role;

-- campaign_detail: expose the kind so the CRM page can show and change it.
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
        'status', c.status, 'sop', c.sop,
        'audienceKind', coalesce(c.audience->>'kind', 'cold')
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

-- campaign_claim_due: same claim logic as 20261012130000, plus the audience
-- kind and the lead's recorded consent so the runner can apply the right gate.
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
    'enrollmentId',  cl.id,
    'campaignId',    cl.campaign_id,
    'stepOrder',     cl.current_step,
    'sop',           c.sop,
    'audienceKind',  coalesce(c.audience->>'kind', 'cold'),
    'email',         l.email,
    'name',          l.name,
    'company',       l.company,
    'consentGiven',  coalesce(l.consent_given, false),
    'template',      s.template
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
