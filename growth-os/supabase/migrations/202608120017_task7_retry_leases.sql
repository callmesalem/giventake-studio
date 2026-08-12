update public.attribution_recompute_jobs
set status = 'exhausted',
    sanitized_failure_code = 'RETRY_EXHAUSTED',
    next_retry_at = null,
    claimed_generation = null,
    claim_token = null,
    lease_expires_at = null,
    updated_at = now()
where status in ('pending', 'failed')
  and attempt_count >= 4;

create or replace function public.claim_attribution_recompute_jobs(
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
  exhausted_count integer;
begin
  if batch_size is null or batch_size not between 1 and 10 then
    raise exception using errcode = '22023', message = 'batch size must be 1-10';
  end if;
  if claimed_at is null then
    raise exception using errcode = '22004', message = 'claim time is required';
  end if;

  with exhaustion_candidates as (
    select job.tenant_id, job.lead_id
    from public.attribution_recompute_jobs job
    where job.status = 'processing'
      and job.lease_expires_at <= claimed_at
      and job.attempt_count >= 4
    order by job.lease_expires_at, job.tenant_id, job.lead_id
    limit batch_size
    for update of job skip locked
  ), exhausted as (
    update public.attribution_recompute_jobs job
    set status = 'exhausted',
        sanitized_failure_code = 'RETRY_EXHAUSTED',
        next_retry_at = null,
        claimed_generation = null,
        claim_token = null,
        lease_expires_at = null,
        updated_at = claimed_at
    from exhaustion_candidates candidate
    where job.tenant_id = candidate.tenant_id
      and job.lead_id = candidate.lead_id
    returning 1
  )
  select count(*) into exhausted_count from exhausted;

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

alter function public.record_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) set schema private;
alter function private.record_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) rename to complete_claimed_attribution_recompute_failure;

revoke all on function private.complete_claimed_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

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
  authorization_time timestamptz;
  current_job public.attribution_recompute_jobs%rowtype;
begin
  if event_request_id is null or failed_at is null then
    raise exception using errcode = '22004', message = 'failure event identifiers are required';
  end if;
  if processed_generation is null or processed_generation <= 0 or job_claim_token is null then
    return jsonb_build_object('status', 'stale');
  end if;

  select job.* into current_job
  from public.attribution_recompute_jobs job
  where job.tenant_id = target_tenant and job.lead_id = target_lead
  for update;
  authorization_time := transaction_timestamp();

  if not found
    or current_job.generation <> processed_generation
    or current_job.claimed_generation is distinct from processed_generation
    or current_job.claim_token is distinct from job_claim_token
    or current_job.status <> 'processing'
    or current_job.lease_expires_at is null
    or current_job.lease_expires_at <= authorization_time then
    return jsonb_build_object('status', 'stale');
  end if;

  return private.complete_claimed_attribution_recompute_failure(
    target_tenant,
    target_lead,
    processed_generation,
    job_claim_token,
    event_request_id,
    failed_at
  );
end;
$$;

alter function public.apply_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) set schema private;
alter function private.apply_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) rename to apply_claimed_attribution_recomputation;

revoke all on function private.apply_claimed_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

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
  authorization_time timestamptz;
  current_job public.attribution_recompute_jobs%rowtype;
begin
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if processed_generation is null or processed_generation <= 0 or job_claim_token is null then
    return jsonb_build_object(
      'found', false, 'changed', false, 'completed', false, 'stale', true
    );
  end if;

  select job.* into current_job
  from public.attribution_recompute_jobs job
  where job.tenant_id = target_tenant and job.lead_id = target_lead
  for update;
  authorization_time := transaction_timestamp();

  if not found then
    return jsonb_build_object(
      'found', false, 'changed', false, 'completed', false, 'stale', true
    );
  end if;
  if current_job.generation <> processed_generation
    or current_job.claimed_generation is distinct from processed_generation
    or current_job.claim_token is distinct from job_claim_token
    or current_job.status <> 'processing'
    or current_job.lease_expires_at is null
    or current_job.lease_expires_at <= authorization_time then
    return jsonb_build_object(
      'found', true, 'changed', false, 'completed', false, 'stale', true
    );
  end if;

  return private.apply_claimed_attribution_recomputation(
    target_tenant,
    target_lead,
    processed_generation,
    job_claim_token,
    first_evidence_id,
    first_decision,
    last_evidence_id,
    last_decision,
    event_request_id
  );
end;
$$;

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
