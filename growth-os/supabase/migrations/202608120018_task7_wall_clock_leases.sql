create or replace function public.record_attribution_recompute_failure(
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
  authorization_time := clock_timestamp();

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

create or replace function public.apply_attribution_recomputation(
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
  authorization_time := clock_timestamp();

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

revoke all on function private.complete_claimed_attribution_recompute_failure(
  uuid, uuid, bigint, uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

revoke all on function private.apply_claimed_attribution_recomputation(
  uuid, uuid, bigint, uuid, uuid, jsonb, uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

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
