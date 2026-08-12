delete from public.attribution_touches manual
where manual.touch_type = 'manual'
  and (
    manual.original_computed_touch_id is null
    or not exists (
      select 1
      from public.attribution_touches original
      where original.tenant_id = manual.tenant_id
        and original.lead_id = manual.lead_id
        and original.id = manual.original_computed_touch_id
        and original.touch_type in ('first', 'last')
        and not original.is_manual
    )
  );

alter table public.attribution_touches
drop constraint attribution_touches_original_computed_shape_check;

alter table public.attribution_touches
add constraint attribution_touches_original_computed_shape_check check (
  (
    touch_type = 'manual'
    and is_manual
    and original_computed_touch_id is not null
  )
  or
  (
    touch_type <> 'manual'
    and not is_manual
    and original_computed_touch_id is null
  )
) not valid;

alter table public.attribution_touches
validate constraint attribution_touches_original_computed_shape_check;

create function private.validate_attribution_touch_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.touch_type = 'manual' and not exists (
    select 1
    from public.attribution_touches original
    where original.tenant_id = new.tenant_id
      and original.lead_id = new.lead_id
      and original.id = new.original_computed_touch_id
      and original.touch_type in ('first', 'last')
      and not original.is_manual
  ) then
    raise exception using
      errcode = '23514',
      message = 'manual attribution requires an original computed touch for the same lead';
  end if;
  return new;
end;
$$;

create trigger validate_attribution_touch_insert
before insert on public.attribution_touches
for each row
execute function private.validate_attribution_touch_insert();

create function private.reject_attribution_touch_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  call_context text;
begin
  if tg_op = 'UPDATE'
    and pg_trigger_depth() > 1
    and old.evidence_id is not null
    and new.evidence_id is null
    and to_jsonb(new) - array['evidence_id', 'is_manual']
      = to_jsonb(old) - array['evidence_id', 'is_manual']
  then
    return new;
  end if;
  if tg_op = 'DELETE' then
    get diagnostics call_context = pg_context;
    if position('PL/pgSQL function public.run_retention_cleanup' in call_context) > 0 then
      return old;
    end if;
  end if;
  if tg_op = 'DELETE' and (
    not exists (
      select 1 from public.tenants tenant where tenant.id = old.tenant_id
    )
    or not exists (
      select 1 from public.leads lead
      where lead.tenant_id = old.tenant_id and lead.id = old.lead_id
    )
  ) then
    return old;
  end if;
  raise exception using errcode = '42501', message = 'attribution history is append-only';
end;
$$;

create trigger reject_attribution_touch_mutation
before update or delete on public.attribution_touches
for each row
execute function private.reject_attribution_touch_mutation();

revoke all on function private.validate_attribution_touch_insert()
from public, anon, authenticated, service_role;
revoke all on function private.reject_attribution_touch_mutation()
from public, anon, authenticated, service_role;

revoke insert, update, delete on public.attribution_touches
from public, anon, authenticated, service_role;

create table public.attribution_recompute_jobs (
  tenant_id uuid not null,
  lead_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'failed', 'succeeded')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sanitized_failure_code text check (
    sanitized_failure_code is null or sanitized_failure_code = 'RECOMPUTE_FAILED'
  ),
  last_request_id uuid,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, lead_id),
  constraint attribution_recompute_jobs_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade,
  check (
    (status = 'failed' and sanitized_failure_code = 'RECOMPUTE_FAILED' and next_retry_at is not null)
    or
    (status <> 'failed' and sanitized_failure_code is null and next_retry_at is null)
  )
);

create index attribution_recompute_jobs_retry_idx
on public.attribution_recompute_jobs (status, next_retry_at, updated_at, tenant_id, lead_id)
where status in ('pending', 'failed');

alter table public.attribution_recompute_jobs enable row level security;

revoke all on public.attribution_recompute_jobs from public, anon, authenticated, service_role;
grant select on public.attribution_recompute_jobs to service_role;

create function private.queue_attribution_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.attribution_recompute_jobs (tenant_id, lead_id)
  values (new.tenant_id, new.lead_id)
  on conflict (tenant_id, lead_id) do update
  set status = 'pending',
      sanitized_failure_code = null,
      last_request_id = null,
      next_retry_at = null,
      updated_at = now();
  return new;
end;
$$;

create trigger queue_attribution_recompute
after insert on public.attribution_evidence
for each row
execute function private.queue_attribution_recompute();

revoke all on function private.queue_attribution_recompute()
from public, anon, authenticated, service_role;

insert into public.attribution_recompute_jobs (tenant_id, lead_id)
select distinct evidence.tenant_id, evidence.lead_id
from public.attribution_evidence evidence
where not exists (
    select 1 from public.attribution_touches touch
    where touch.tenant_id = evidence.tenant_id
      and touch.lead_id = evidence.lead_id
      and touch.touch_type = 'first'
      and not touch.is_manual
  )
  or not exists (
    select 1 from public.attribution_touches touch
    where touch.tenant_id = evidence.tenant_id
      and touch.lead_id = evidence.lead_id
      and touch.touch_type = 'last'
      and not touch.is_manual
  )
on conflict (tenant_id, lead_id) do nothing;

create function public.record_attribution_recompute_failure(
  target_tenant uuid,
  target_lead uuid,
  event_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;

  update public.attribution_recompute_jobs job
  set status = 'failed',
      attempt_count = case
        when job.attempt_count < 2147483647 then job.attempt_count + 1
        else job.attempt_count
      end,
      sanitized_failure_code = 'RECOMPUTE_FAILED',
      last_request_id = event_request_id,
      next_retry_at = now() + interval '5 minutes',
      updated_at = now()
  where job.tenant_id = target_tenant and job.lead_id = target_lead;

  return found;
end;
$$;

create or replace function public.apply_attribution_recomputation(
  target_tenant uuid,
  target_lead uuid,
  first_evidence_id uuid,
  first_decision jsonb,
  last_evidence_id uuid,
  last_decision jsonb,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_any boolean := false;
  decision jsonb;
  evidence_id uuid;
  locked_lead uuid;
  model record;
  new_campaign_external_id text;
  new_confidence public.attribution_confidence;
  new_reason_codes text[];
  new_source text;
  new_state text;
  old_touch public.attribution_touches%rowtype;
begin
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;

  select lead.id into locked_lead
  from public.leads lead
  where lead.tenant_id = target_tenant
    and lead.id = target_lead
    and lead.restricted_at is null
  for update;
  if not found then
    return jsonb_build_object('found', false, 'changed', false);
  end if;

  if not public.is_attribution_decision(first_decision)
    or not public.is_attribution_decision(last_decision) then
    raise exception using errcode = '22023', message = 'attribution decision is invalid';
  end if;

  for model in
    select * from (
      values
        ('first'::public.attribution_touch_type, first_evidence_id, first_decision),
        ('last'::public.attribution_touch_type, last_evidence_id, last_decision)
    ) as selected(touch_type, selected_evidence_id, selected_decision)
  loop
    evidence_id := model.selected_evidence_id;
    decision := model.selected_decision;
    if evidence_id is not null and not exists (
      select 1 from public.attribution_evidence evidence
      where evidence.tenant_id = target_tenant
        and evidence.lead_id = target_lead
        and evidence.id = evidence_id
        and evidence.occurred_at <= (
          select lead.occurred_at from public.leads lead
          where lead.tenant_id = target_tenant and lead.id = target_lead
        )
    ) then
      raise exception using errcode = '22023', message = 'attribution evidence is invalid';
    end if;

    new_source := coalesce(decision ->> 'source', 'unattributed');
    new_campaign_external_id := decision ->> 'campaign_external_id';
    new_confidence := (decision ->> 'confidence')::public.attribution_confidence;
    new_state := decision ->> 'state';
    select coalesce(array_agg(value order by ordinal), '{}'::text[])
    into new_reason_codes
    from jsonb_array_elements_text(decision -> 'reason_codes')
      with ordinality reason(value, ordinal);

    old_touch := null;
    select touch.* into old_touch
    from public.attribution_touches touch
    where touch.tenant_id = target_tenant
      and touch.lead_id = target_lead
      and touch.touch_type = model.touch_type
      and not touch.is_manual
    order by touch.created_at desc, touch.id desc
    limit 1;

    if old_touch.id is null
      or old_touch.evidence_id is distinct from evidence_id
      or old_touch.normalized_source is distinct from new_source
      or old_touch.campaign_external_id is distinct from new_campaign_external_id
      or old_touch.confidence is distinct from new_confidence
      or old_touch.state is distinct from new_state
      or old_touch.reason_codes is distinct from new_reason_codes then
      insert into public.attribution_touches (
        tenant_id, lead_id, evidence_id, touch_type, normalized_source,
        campaign_external_id, confidence, state, reason_codes
      ) values (
        target_tenant, target_lead, evidence_id, model.touch_type, new_source,
        new_campaign_external_id, new_confidence, new_state, new_reason_codes
      );

      perform public.write_audit_event(
        target_tenant,
        'attribution.recomputed',
        'lead',
        target_lead,
        event_request_id,
        jsonb_build_object(
          'attribution_model', case
            when model.touch_type = 'first' then 'first_touch' else 'last_touch'
          end,
          'old_source', case
            when old_touch.id is null or old_touch.state = 'unattributed' then null
            else old_touch.normalized_source
          end,
          'new_source', case when new_state = 'unattributed' then null else new_source end,
          'old_confidence', case
            when old_touch.id is null then null else old_touch.confidence::text
          end,
          'new_confidence', new_confidence::text,
          'old_state', case when old_touch.id is null then null else old_touch.state end,
          'new_state', new_state,
          'old_reason_codes', case
            when old_touch.id is null then null else array_to_string(old_touch.reason_codes, ',')
          end,
          'new_reason_codes', array_to_string(new_reason_codes, ',')
        ),
        null
      );
      changed_any := true;
    end if;
  end loop;

  update public.attribution_recompute_jobs job
  set status = 'succeeded',
      sanitized_failure_code = null,
      last_request_id = event_request_id,
      next_retry_at = null,
      updated_at = now()
  where job.tenant_id = target_tenant and job.lead_id = target_lead;

  return jsonb_build_object('found', true, 'changed', changed_any);
end;
$$;

create or replace function public.get_growth_overview(
  target_tenant uuid,
  range_start date,
  range_end date,
  attribution_model text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  tenant_currency text;
  tenant_timezone text;
begin
  if range_start is null or range_end is null
    or range_end < range_start
    or range_end - range_start > 365 then
    raise exception using errcode = '22023', message = 'invalid overview date range';
  end if;
  if attribution_model not in ('first_touch', 'last_touch') then
    raise exception using errcode = '22023', message = 'invalid attribution model';
  end if;
  if not public.can_access_tenant(target_tenant) then
    return null;
  end if;

  select tenant.currency, tenant.timezone
  into tenant_currency, tenant_timezone
  from public.tenants tenant
  where tenant.id = target_tenant and tenant.status = 'active';
  if not found then
    return null;
  end if;

  with effective_attribution as (
    select
      lead.id as lead_id,
      lead.status,
      lead.occurred_at,
      coalesce(correction.normalized_source, computed.normalized_source) as source,
      coalesce(correction.state, computed.state) as state
    from public.leads lead
    left join lateral (
      select touch.*
      from public.attribution_touches touch
      where touch.tenant_id = lead.tenant_id
        and touch.lead_id = lead.id
        and touch.touch_type = case
          when attribution_model = 'first_touch' then 'first'::public.attribution_touch_type
          else 'last'::public.attribution_touch_type
        end
        and not touch.is_manual
      order by touch.created_at desc, touch.id desc
      limit 1
    ) computed on true
    left join lateral (
      select touch.*
      from public.attribution_touches touch
      where touch.tenant_id = lead.tenant_id
        and touch.lead_id = lead.id
        and touch.is_manual
        and touch.original_computed_touch_id = computed.id
      order by touch.created_at desc, touch.id desc
      limit 1
    ) correction on true
    where lead.tenant_id = target_tenant and lead.restricted_at is null
  ),
  range_leads as (
    select * from effective_attribution attribution
    where (attribution.occurred_at at time zone tenant_timezone)::date
      between range_start and range_end
  ),
  lead_facts as (
    select
      count(*)::integer as total_leads,
      count(*) filter (where status in ('qualified', 'booked', 'won'))::integer
        as qualified_leads,
      count(*) filter (where status = 'won')::integer as won_leads,
      count(*) filter (
        where status in ('qualified', 'booked', 'won')
          and source in ('google_ads', 'meta_ads')
          and state <> 'unattributed'
      )::integer as paid_qualified_leads,
      count(*) filter (
        where source is null or state is null or state = 'unattributed'
      )::integer as unattributed_leads,
      count(*) filter (where state = 'ambiguous')::integer as ambiguous_leads
    from range_leads
  ),
  revenue_facts as (
    select
      coalesce(sum(outcome.amount_minor), 0)::text as confirmed_revenue_minor,
      coalesce(sum(outcome.amount_minor) filter (
        where attribution.source in ('google_ads', 'meta_ads')
          and attribution.state <> 'unattributed'
      ), 0)::text as paid_revenue_minor,
      coalesce(sum(outcome.amount_minor) filter (
        where attribution.source is not null and attribution.state <> 'unattributed'
      ), 0)::text as attributed_revenue_minor
    from public.revenue_outcomes outcome
    join effective_attribution attribution on attribution.lead_id = outcome.lead_id
    where outcome.tenant_id = target_tenant
      and outcome.superseded_at is null
      and outcome.currency = tenant_currency
      and outcome.confirmed_on between range_start and range_end
      and attribution.status = 'won'
  ),
  paid_metric_rows as (
    select
      metric.currency,
      metric.spend_minor,
      connection.currency as connection_currency,
      connection.provider
    from public.campaign_metrics_daily metric
    join public.connections connection
      on connection.tenant_id = metric.tenant_id
     and connection.id = metric.connection_id
    where metric.tenant_id = target_tenant
      and metric.metric_date between range_start and range_end
      and metric.is_complete
      and connection.provider in ('google_ads', 'meta_ads')
  ),
  metric_coverage as (
    select
      coalesce(bool_or(
        row.currency <> tenant_currency
        or row.connection_currency <> tenant_currency
        or row.currency <> row.connection_currency
        or row.spend_minor is null
      ), false) as unsafe,
      coalesce(array_agg(distinct row.provider) filter (where
        row.currency <> tenant_currency
        or row.connection_currency <> tenant_currency
        or row.currency <> row.connection_currency
        or row.spend_minor is null
      ), array[]::public.provider[]) as unsafe_providers
    from paid_metric_rows row
  ),
  metric_facts as (
    select case
      when coverage.unsafe then null
      else sum(row.spend_minor)::text
    end as spend_minor
    from metric_coverage coverage
    left join paid_metric_rows row on true
    group by coverage.unsafe
  ),
  freshness as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'provider', provider.provider,
        'last_successful_sync', latest.last_success_at,
        'state', case
          when provider.provider = any(coverage.unsafe_providers) then 'stale'
          when latest.id is null or latest.last_success_at is null then 'missing'
          when latest.health = 'healthy' then 'fresh'
          else 'stale'
        end
      ) order by provider.ordinal
    ), '[]'::jsonb) as value
    from unnest(enum_range(null::public.provider)) with ordinality provider(provider, ordinal)
    cross join metric_coverage coverage
    left join lateral (
      select connection.id, connection.health, connection.last_success_at
      from public.connections connection
      where connection.tenant_id = target_tenant
        and connection.provider = provider.provider
      order by connection.last_success_at desc nulls last, connection.id desc
      limit 1
    ) latest on true
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'start', range_start, 'end', range_end, 'timezone', tenant_timezone
    ),
    'currency', tenant_currency,
    'freshness', freshness.value,
    'facts', jsonb_build_object(
      'total_leads', lead_facts.total_leads,
      'qualified_leads', lead_facts.qualified_leads,
      'won_leads', lead_facts.won_leads,
      'paid_qualified_leads', lead_facts.paid_qualified_leads,
      'confirmed_revenue_minor', revenue_facts.confirmed_revenue_minor,
      'spend_minor', metric_facts.spend_minor,
      'paid_revenue_minor', revenue_facts.paid_revenue_minor,
      'attributed_revenue_minor', revenue_facts.attributed_revenue_minor,
      'unattributed_leads', lead_facts.unattributed_leads,
      'ambiguous_leads', lead_facts.ambiguous_leads
    )
  ) into result
  from lead_facts, revenue_facts, metric_facts, freshness;

  return result;
end;
$$;

revoke all on function public.record_attribution_recompute_failure(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.record_attribution_recompute_failure(uuid, uuid, uuid)
to service_role;

revoke all on function public.apply_attribution_recomputation(
  uuid, uuid, uuid, jsonb, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.apply_attribution_recomputation(
  uuid, uuid, uuid, jsonb, uuid, jsonb, uuid
) to service_role;

revoke all on function public.get_growth_overview(uuid, date, date, text)
from public, anon, service_role;
grant execute on function public.get_growth_overview(uuid, date, date, text)
to authenticated;
