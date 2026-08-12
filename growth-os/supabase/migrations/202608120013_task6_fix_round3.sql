create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create or replace function public.is_sanitized_lead_operation_metadata(
  event_action public.audit_action,
  event_metadata jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case event_action
    when 'lead.status_changed' then
      jsonb_typeof(event_metadata) = 'object'
      and event_metadata ?& array['change_code', 'previous_status', 'current_status']
      and event_metadata - array['change_code', 'previous_status', 'current_status'] = '{}'::jsonb
      and jsonb_typeof(event_metadata -> 'change_code') = 'string'
      and event_metadata ->> 'change_code' = 'lead_status_changed'
      and jsonb_typeof(event_metadata -> 'previous_status') = 'string'
      and event_metadata ->> 'previous_status' in ('new', 'qualified', 'booked')
      and jsonb_typeof(event_metadata -> 'current_status') = 'string'
      and event_metadata ->> 'current_status' in ('qualified', 'booked', 'won', 'lost')
    when 'lead.reopened' then
      jsonb_typeof(event_metadata) = 'object'
      and event_metadata ?& array[
        'change_code', 'previous_status', 'current_status', 'superseded_count'
      ]
      and event_metadata - array[
        'change_code', 'previous_status', 'current_status', 'superseded_count'
      ] = '{}'::jsonb
      and jsonb_typeof(event_metadata -> 'change_code') = 'string'
      and event_metadata ->> 'change_code' = 'lead_reopened'
      and jsonb_typeof(event_metadata -> 'previous_status') = 'string'
      and event_metadata ->> 'previous_status' in ('won', 'lost')
      and jsonb_typeof(event_metadata -> 'current_status') = 'string'
      and event_metadata ->> 'current_status' in ('new', 'qualified', 'booked')
      and jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
      and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
    when 'revenue.recorded' then
      jsonb_typeof(event_metadata) = 'object'
      and event_metadata ?& array['change_code', 'recorded_on', 'superseded_count']
      and event_metadata - array['change_code', 'recorded_on', 'superseded_count'] = '{}'::jsonb
      and jsonb_typeof(event_metadata -> 'change_code') = 'string'
      and event_metadata ->> 'change_code' = 'revenue_recorded'
      and jsonb_typeof(event_metadata -> 'recorded_on') = 'string'
      and event_metadata ->> 'recorded_on' ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
      and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
    else true
  end
$$;

alter table public.audit_events
drop constraint audit_events_lead_operation_metadata_check;
alter table public.audit_events
add constraint audit_events_lead_operation_metadata_check
check (public.is_sanitized_lead_operation_metadata(action, metadata)) not valid;
alter table public.audit_events
validate constraint audit_events_lead_operation_metadata_check;

create or replace function public.write_audit_event(
  target_tenant uuid,
  event_action public.audit_action,
  event_target_type text,
  event_target_id uuid,
  event_request_id uuid,
  event_metadata jsonb,
  event_actor_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if event_action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded') then
    raise exception using
      errcode = '42501',
      message = 'lifecycle audit actions require lifecycle transaction function';
  end if;

  if not exists (select 1 from public.tenants where id = target_tenant) then
    raise exception using errcode = '23503', message = 'tenant not found';
  end if;
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if not public.is_sanitized_audit_metadata(coalesce(event_metadata, '{}'::jsonb)) then
    raise exception using errcode = '22023', message = 'audit metadata is not sanitized';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    target_tenant,
    event_actor_user_id,
    case when event_actor_user_id is null then 'system' else 'user' end,
    event_action,
    event_target_type,
    event_target_id,
    event_request_id,
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create function private.write_lead_status_changed_audit(
  target_tenant uuid,
  target_lead uuid,
  event_request_id uuid,
  previous_status public.lead_status,
  current_status public.lead_status,
  event_actor_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
  audit_id uuid;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure;

  if current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'lifecycle transaction function required';
  end if;
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if event_actor_user_id is null then
    raise exception using errcode = '42501', message = 'lifecycle actor is required';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    target_tenant, event_actor_user_id, 'user', 'lead.status_changed', 'lead', target_lead,
    event_request_id,
    jsonb_build_object(
      'change_code', 'lead_status_changed',
      'previous_status', previous_status,
      'current_status', current_status
    )
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create function private.write_lead_reopened_audit(
  target_tenant uuid,
  target_lead uuid,
  event_request_id uuid,
  previous_status public.lead_status,
  current_status public.lead_status,
  superseded_count integer,
  event_actor_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
  audit_id uuid;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.reopen_lead(uuid,uuid,text,uuid)'::regprocedure;

  if current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'lifecycle transaction function required';
  end if;
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if event_actor_user_id is null then
    raise exception using errcode = '42501', message = 'lifecycle actor is required';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    target_tenant, event_actor_user_id, 'user', 'lead.reopened', 'lead', target_lead,
    event_request_id,
    jsonb_build_object(
      'change_code', 'lead_reopened',
      'previous_status', previous_status,
      'current_status', current_status,
      'superseded_count', superseded_count
    )
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create function private.write_revenue_recorded_audit(
  target_tenant uuid,
  target_lead uuid,
  event_request_id uuid,
  recorded_on date,
  superseded_count integer,
  event_actor_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
  audit_id uuid;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure;

  if current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'lifecycle transaction function required';
  end if;
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if event_actor_user_id is null then
    raise exception using errcode = '42501', message = 'lifecycle actor is required';
  end if;

  insert into public.audit_events (
    tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    target_tenant, event_actor_user_id, 'user', 'revenue.recorded', 'lead', target_lead,
    event_request_id,
    jsonb_build_object(
      'change_code', 'revenue_recorded',
      'recorded_on', recorded_on,
      'superseded_count', superseded_count
    )
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function private.write_lead_status_changed_audit(
  uuid, uuid, uuid, public.lead_status, public.lead_status, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.write_lead_reopened_audit(
  uuid, uuid, uuid, public.lead_status, public.lead_status, integer, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.write_revenue_recorded_audit(
  uuid, uuid, uuid, date, integer, uuid
) from public, anon, authenticated, service_role;

create or replace function public.change_lead_status(
  target_tenant uuid,
  target_lead uuid,
  next_status public.lead_status,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_status public.lead_status;
  changed_at timestamptz := clock_timestamp();
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  select lead.status into previous_status
  from public.leads lead
  where lead.tenant_id = target_tenant and lead.id = target_lead and lead.restricted_at is null
  for update;

  if not found then return null; end if;
  if not (
    (previous_status = 'new' and next_status in ('qualified', 'lost'))
    or (previous_status = 'qualified' and next_status in ('booked', 'won', 'lost'))
    or (previous_status = 'booked' and next_status in ('won', 'lost'))
  ) then
    raise exception using errcode = '22023', message = 'lead status transition is not allowed';
  end if;

  update public.leads
  set status = next_status,
      preterminal_status = case when next_status in ('won', 'lost') then previous_status else null end,
      last_activity_at = changed_at,
      updated_at = changed_at
  where tenant_id = target_tenant and id = target_lead and restricted_at is null;

  perform private.write_lead_status_changed_audit(
    target_tenant, target_lead, event_request_id, previous_status, next_status, actor_user_id
  );

  return jsonb_build_object('status', next_status, 'last_activity_at', changed_at);
end;
$$;

create or replace function public.reopen_lead(
  target_tenant uuid,
  target_lead uuid,
  reopen_reason text,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_status public.lead_status;
  restored_status public.lead_status;
  canonical_reason text := btrim(coalesce(reopen_reason, ''));
  reopened_at timestamptz := clock_timestamp();
  superseded_count integer := 0;
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;
  if char_length(canonical_reason) not between 10 and 500 or canonical_reason ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'reopen reason must be 10-500 characters';
  end if;

  select lead.status, lead.preterminal_status into previous_status, restored_status
  from public.leads lead
  where lead.tenant_id = target_tenant and lead.id = target_lead and lead.restricted_at is null
  for update;

  if not found then return null; end if;
  if previous_status not in ('won', 'lost') then
    raise exception using errcode = '22023', message = 'only terminal leads can be reopened';
  end if;
  if restored_status not in ('new', 'qualified', 'booked') then
    raise exception using errcode = '22023', message = 'terminal lead has no restorable status';
  end if;

  update public.revenue_outcomes
  set superseded_at = reopened_at, updated_at = reopened_at
  where tenant_id = target_tenant and lead_id = target_lead and superseded_at is null;
  get diagnostics superseded_count = row_count;

  update public.leads
  set status = restored_status,
      preterminal_status = null,
      last_activity_at = reopened_at,
      updated_at = reopened_at
  where tenant_id = target_tenant and id = target_lead and restricted_at is null;

  perform private.write_lead_reopened_audit(
    target_tenant, target_lead, event_request_id, previous_status, restored_status,
    superseded_count, actor_user_id
  );

  return jsonb_build_object('status', restored_status, 'last_activity_at', reopened_at);
end;
$$;

create or replace function public.record_lead_revenue(
  target_tenant uuid,
  target_lead uuid,
  revenue_amount_minor bigint,
  revenue_currency text,
  revenue_confirmed_on date,
  revenue_note_ciphertext text,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_status public.lead_status;
  recorded_at timestamptz := clock_timestamp();
  superseded_count integer := 0;
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;
  if revenue_amount_minor is null or revenue_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'revenue amount must be positive';
  end if;
  if not public.is_iso_4217_currency(revenue_currency) then
    raise exception using errcode = '22023', message = 'currency must be a valid ISO 4217 code';
  end if;
  if revenue_confirmed_on is null or revenue_confirmed_on > current_date then
    raise exception using errcode = '22023', message = 'confirmation date cannot be in the future';
  end if;
  if revenue_note_ciphertext is not null and char_length(revenue_note_ciphertext) < 1 then
    raise exception using errcode = '22023', message = 'revenue note ciphertext must not be empty';
  end if;

  select lead.status into current_status
  from public.leads lead
  where lead.tenant_id = target_tenant and lead.id = target_lead and lead.restricted_at is null
  for update;

  if not found or current_status <> 'won' then
    raise exception using errcode = 'P0002', message = 'lead not found';
  end if;

  update public.revenue_outcomes
  set superseded_at = recorded_at, updated_at = recorded_at
  where tenant_id = target_tenant and lead_id = target_lead and superseded_at is null;
  get diagnostics superseded_count = row_count;

  insert into public.revenue_outcomes (
    tenant_id, lead_id, amount_minor, currency, confirmed_on, confirmed_by,
    note_ciphertext, created_at, updated_at, superseded_at
  ) values (
    target_tenant, target_lead, revenue_amount_minor, revenue_currency,
    revenue_confirmed_on, actor_user_id, revenue_note_ciphertext,
    recorded_at, recorded_at, null
  );

  update public.leads
  set last_activity_at = recorded_at, updated_at = recorded_at
  where tenant_id = target_tenant and id = target_lead and restricted_at is null;

  perform private.write_revenue_recorded_audit(
    target_tenant, target_lead, event_request_id, revenue_confirmed_on,
    superseded_count, actor_user_id
  );

  return jsonb_build_object(
    'amount_minor', revenue_amount_minor::text,
    'currency', revenue_currency,
    'confirmed_on', revenue_confirmed_on,
    'last_activity_at', recorded_at
  );
end;
$$;
