alter table public.attribution_recompute_jobs
drop constraint attribution_recompute_jobs_status_check;

alter table public.attribution_recompute_jobs
drop constraint attribution_recompute_jobs_sanitized_failure_code_check;

alter table public.attribution_recompute_jobs
drop constraint attribution_recompute_jobs_check;

alter table public.attribution_recompute_jobs
add column generation bigint not null default 1 check (generation > 0),
add column claimed_generation bigint,
add column claim_token uuid,
add column lease_expires_at timestamptz;

update public.attribution_recompute_jobs
set attempt_count = 0
where status = 'succeeded';

alter table public.attribution_recompute_jobs
add constraint attribution_recompute_jobs_status_check check (
  status in ('pending', 'processing', 'failed', 'succeeded', 'exhausted')
),
add constraint attribution_recompute_jobs_sanitized_failure_code_check check (
  sanitized_failure_code is null
  or sanitized_failure_code in ('RECOMPUTE_FAILED', 'RETRY_EXHAUSTED')
),
add constraint attribution_recompute_jobs_state_shape_check check (
  (
    status = 'pending'
    and sanitized_failure_code is null
    and next_retry_at is null
    and claimed_generation is null
    and claim_token is null
    and lease_expires_at is null
  )
  or
  (
    status = 'processing'
    and sanitized_failure_code is null
    and next_retry_at is null
    and claimed_generation = generation
    and claim_token is not null
    and lease_expires_at is not null
  )
  or
  (
    status = 'failed'
    and sanitized_failure_code = 'RECOMPUTE_FAILED'
    and next_retry_at is not null
    and claimed_generation is null
    and claim_token is null
    and lease_expires_at is null
  )
  or
  (
    status = 'succeeded'
    and sanitized_failure_code is null
    and next_retry_at is null
    and claimed_generation is null
    and claim_token is null
    and lease_expires_at is null
  )
  or
  (
    status = 'exhausted'
    and sanitized_failure_code = 'RETRY_EXHAUSTED'
    and next_retry_at is null
    and claimed_generation is null
    and claim_token is null
    and lease_expires_at is null
  )
);

drop index public.attribution_recompute_jobs_retry_idx;

create index attribution_recompute_jobs_retry_idx
on public.attribution_recompute_jobs (
  status, next_retry_at, lease_expires_at, updated_at, tenant_id, lead_id
)
where status in ('pending', 'processing', 'failed');

revoke all on public.attribution_recompute_jobs
from public, anon, authenticated, service_role;

drop trigger queue_attribution_recompute on public.attribution_evidence;
drop function private.queue_attribution_recompute();

create function private.queue_attribution_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_lead uuid := coalesce(new.lead_id, old.lead_id);
  affected_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if not exists (
    select 1 from public.leads lead
    where lead.tenant_id = affected_tenant and lead.id = affected_lead
  ) then
    return coalesce(new, old);
  end if;

  insert into public.attribution_recompute_jobs (tenant_id, lead_id)
  values (affected_tenant, affected_lead)
  on conflict (tenant_id, lead_id) do update
  set generation = attribution_recompute_jobs.generation + 1,
      status = 'pending',
      attempt_count = 0,
      sanitized_failure_code = null,
      last_request_id = null,
      next_retry_at = null,
      claimed_generation = null,
      claim_token = null,
      lease_expires_at = null,
      updated_at = now();
  return coalesce(new, old);
end;
$$;

create trigger queue_attribution_recompute
after insert or update or delete on public.attribution_evidence
for each row
execute function private.queue_attribution_recompute();

revoke all on function private.queue_attribution_recompute()
from public, anon, authenticated, service_role;

create function private.attribution_recompute_snapshot(
  target_tenant uuid,
  target_lead uuid,
  target_generation bigint,
  target_claim_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tenant_id', lead.tenant_id,
    'lead_id', lead.id,
    'generation', target_generation::text,
    'claim_token', target_claim_token,
    'submitted_at', lead.occurred_at,
    'evidence', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'occurred_at', evidence.occurred_at,
          'declared_source', evidence.declared_source,
          'click_ids', evidence.click_ids,
          'utm_source', evidence.utm_source,
          'utm_campaign', evidence.utm_campaign,
          'referrer_domain', evidence.referrer_domain
        ) order by evidence.occurred_at, evidence.id
      )
      from public.attribution_evidence evidence
      where evidence.tenant_id = lead.tenant_id
        and evidence.lead_id = lead.id
    ), '[]'::jsonb)
  )
  from public.leads lead
  where lead.tenant_id = target_tenant
    and lead.id = target_lead
    and lead.restricted_at is null
$$;

revoke all on function private.attribution_recompute_snapshot(uuid, uuid, bigint, uuid)
from public, anon, authenticated, service_role;

create function public.claim_attribution_recompute_job(
  target_tenant uuid,
  target_lead uuid,
  claimed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_token uuid;
  current_job public.attribution_recompute_jobs%rowtype;
begin
  if claimed_at is null then
    raise exception using errcode = '22004', message = 'claim time is required';
  end if;

  select job.* into current_job
  from public.attribution_recompute_jobs job
  join public.leads lead
    on lead.tenant_id = job.tenant_id and lead.id = job.lead_id
  where job.tenant_id = target_tenant
    and job.lead_id = target_lead
    and lead.restricted_at is null
  for update of job;

  if not found then
    return null;
  end if;

  if current_job.status = 'processing'
    and current_job.lease_expires_at <= claimed_at
    and current_job.attempt_count >= 4 then
    update public.attribution_recompute_jobs job
    set status = 'exhausted',
        sanitized_failure_code = 'RETRY_EXHAUSTED',
        next_retry_at = null,
        claimed_generation = null,
        claim_token = null,
        lease_expires_at = null,
        updated_at = claimed_at
    where job.tenant_id = target_tenant and job.lead_id = target_lead;
    return null;
  end if;

  if current_job.attempt_count >= 4
    or not (
      current_job.status in ('pending', 'succeeded')
      or (current_job.status = 'failed' and current_job.next_retry_at <= claimed_at)
      or (current_job.status = 'processing' and current_job.lease_expires_at <= claimed_at)
    ) then
    return null;
  end if;

  claimed_token := gen_random_uuid();
  update public.attribution_recompute_jobs job
  set status = 'processing',
      attempt_count = current_job.attempt_count + 1,
      sanitized_failure_code = null,
      next_retry_at = null,
      claimed_generation = current_job.generation,
      claim_token = claimed_token,
      lease_expires_at = claimed_at + interval '5 minutes',
      updated_at = claimed_at
  where job.tenant_id = target_tenant and job.lead_id = target_lead;

  return private.attribution_recompute_snapshot(
    target_tenant, target_lead, current_job.generation, claimed_token
  );
end;
$$;

create function public.claim_attribution_recompute_jobs(
  batch_size integer default 10,
  claimed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb;
begin
  if batch_size is null or batch_size not between 1 and 10 then
    raise exception using errcode = '22023', message = 'batch size must be 1-10';
  end if;
  if claimed_at is null then
    raise exception using errcode = '22004', message = 'claim time is required';
  end if;

  update public.attribution_recompute_jobs job
  set status = 'exhausted',
      sanitized_failure_code = 'RETRY_EXHAUSTED',
      next_retry_at = null,
      claimed_generation = null,
      claim_token = null,
      lease_expires_at = null,
      updated_at = claimed_at
  where job.status = 'processing'
    and job.lease_expires_at <= claimed_at
    and job.attempt_count >= 4;

  with candidates as (
    select job.tenant_id, job.lead_id
    from public.attribution_recompute_jobs job
    join public.leads lead
      on lead.tenant_id = job.tenant_id and lead.id = job.lead_id
    where lead.restricted_at is null
      and job.attempt_count < 4
      and (
        job.status = 'pending'
        or (job.status = 'failed' and job.next_retry_at <= claimed_at)
        or (job.status = 'processing' and job.lease_expires_at <= claimed_at)
      )
    order by
      coalesce(job.next_retry_at, job.lease_expires_at, job.updated_at),
      job.tenant_id,
      job.lead_id
    limit batch_size
    for update of job skip locked
  ), claimed as (
    update public.attribution_recompute_jobs job
    set status = 'processing',
        attempt_count = job.attempt_count + 1,
        sanitized_failure_code = null,
        next_retry_at = null,
        claimed_generation = job.generation,
        claim_token = gen_random_uuid(),
        lease_expires_at = claimed_at + interval '5 minutes',
        updated_at = claimed_at
    from candidates candidate
    where job.tenant_id = candidate.tenant_id and job.lead_id = candidate.lead_id
    returning job.tenant_id, job.lead_id, job.generation, job.claim_token
  )
  select coalesce(jsonb_agg(
    private.attribution_recompute_snapshot(
      claimed.tenant_id, claimed.lead_id, claimed.generation, claimed.claim_token
    ) order by claimed.tenant_id, claimed.lead_id
  ), '[]'::jsonb)
  into claims
  from claimed;

  return claims;
end;
$$;

create or replace function public.record_attribution_recompute_failure(
  target_tenant uuid,
  target_lead uuid,
  event_request_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select false
$$;

create function public.record_attribution_recompute_failure(
  target_tenant uuid,
  target_lead uuid,
  processed_generation bigint,
  job_claim_token uuid,
  event_request_id uuid,
  failed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_status text;
begin
  if processed_generation is null or processed_generation <= 0
    or job_claim_token is null or event_request_id is null or failed_at is null then
    raise exception using errcode = '22004', message = 'claimed attempt identifiers are required';
  end if;

  update public.attribution_recompute_jobs job
  set status = case when job.attempt_count >= 4 then 'exhausted' else 'failed' end,
      sanitized_failure_code = case
        when job.attempt_count >= 4 then 'RETRY_EXHAUSTED' else 'RECOMPUTE_FAILED'
      end,
      last_request_id = event_request_id,
      next_retry_at = case job.attempt_count
        when 1 then failed_at + interval '1 minute'
        when 2 then failed_at + interval '4 minutes'
        when 3 then failed_at + interval '16 minutes'
        else null
      end,
      claimed_generation = null,
      claim_token = null,
      lease_expires_at = null,
      updated_at = failed_at
  where job.tenant_id = target_tenant
    and job.lead_id = target_lead
    and job.generation = processed_generation
    and job.claimed_generation = processed_generation
    and job.claim_token = job_claim_token
    and job.status = 'processing'
  returning job.status into resulting_status;

  if not found then
    return jsonb_build_object('status', 'stale');
  end if;
  return jsonb_build_object('status', resulting_status);
end;
$$;

create function public.apply_attribution_recomputation(
  target_tenant uuid,
  target_lead uuid,
  processed_generation bigint,
  job_claim_token uuid,
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
  current_job public.attribution_recompute_jobs%rowtype;
  decision jsonb;
  evidence_id uuid;
  model record;
  new_campaign_external_id text;
  new_confidence public.attribution_confidence;
  new_reason_codes text[];
  new_source text;
  new_state text;
  old_touch public.attribution_touches%rowtype;
begin
  if processed_generation is null or processed_generation <= 0
    or job_claim_token is null or event_request_id is null then
    raise exception using errcode = '22004', message = 'claimed attempt identifiers are required';
  end if;

  select job.* into current_job
  from public.attribution_recompute_jobs job
  where job.tenant_id = target_tenant and job.lead_id = target_lead
  for update;
  if not found then
    return jsonb_build_object(
      'found', false, 'changed', false, 'completed', false, 'stale', false
    );
  end if;

  if current_job.generation <> processed_generation
    or current_job.claimed_generation is distinct from processed_generation
    or current_job.claim_token is distinct from job_claim_token
    or current_job.status <> 'processing' then
    return jsonb_build_object(
      'found', true, 'changed', false, 'completed', false, 'stale', true
    );
  end if;

  if not exists (
    select 1 from public.leads lead
    where lead.tenant_id = target_tenant
      and lead.id = target_lead
      and lead.restricted_at is null
  ) then
    return jsonb_build_object(
      'found', false, 'changed', false, 'completed', false, 'stale', false
    );
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
      attempt_count = 0,
      sanitized_failure_code = null,
      last_request_id = event_request_id,
      next_retry_at = null,
      claimed_generation = null,
      claim_token = null,
      lease_expires_at = null,
      updated_at = now()
  where job.tenant_id = target_tenant
    and job.lead_id = target_lead
    and job.generation = processed_generation
    and job.claim_token = job_claim_token;

  return jsonb_build_object(
    'found', true, 'changed', changed_any, 'completed', true, 'stale', false
  );
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
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'found', true, 'changed', false, 'completed', false, 'stale', true
  )
$$;

revoke all on function public.claim_attribution_recompute_job(uuid, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.claim_attribution_recompute_job(uuid, uuid, timestamptz)
to service_role;

revoke all on function public.claim_attribution_recompute_jobs(integer, timestamptz)
from public, anon, authenticated;
grant execute on function public.claim_attribution_recompute_jobs(integer, timestamptz)
to service_role;

revoke all on function public.record_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) to service_role;

revoke all on function public.apply_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.apply_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) to service_role;

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
