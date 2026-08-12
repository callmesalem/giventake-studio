alter table public.leads
add column preterminal_status public.lead_status;

alter table public.leads
add constraint leads_preterminal_status_check
check (preterminal_status is null or preterminal_status in ('new', 'qualified', 'booked'));

update public.leads lead
set preterminal_status = coalesce(
  (
    select (event.metadata ->> 'previous_status')::public.lead_status
    from public.audit_events event
    where event.tenant_id = lead.tenant_id
      and event.target_type = 'lead'
      and event.target_id = lead.id
      and event.action = 'lead.status_changed'
      and event.metadata ->> 'previous_status' in ('new', 'qualified', 'booked')
    order by event.created_at desc, event.id desc
    limit 1
  ),
  'qualified'::public.lead_status
)
where lead.status in ('won', 'lost');

alter table public.revenue_outcomes
drop constraint if exists revenue_outcomes_tenant_id_lead_id_key;

alter table public.revenue_outcomes
add column superseded_at timestamptz;

create unique index revenue_outcomes_one_current_per_lead_idx
on public.revenue_outcomes (tenant_id, lead_id)
where superseded_at is null;

create index revenue_outcomes_lead_history_idx
on public.revenue_outcomes (tenant_id, lead_id, created_at desc, id desc);

create function public.amount_minor_text(outcome public.revenue_outcomes)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select outcome.amount_minor::text
$$;

create function public.is_sanitized_lead_operation_metadata(
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
      event_metadata ?& array['change_code', 'previous_status', 'current_status']
      and not event_metadata ?| array['reason', 'amount_minor', 'note', 'note_ciphertext']
      and event_metadata ->> 'change_code' = 'lead_status_changed'
      and event_metadata ->> 'previous_status' in ('new', 'qualified', 'booked')
      and event_metadata ->> 'current_status' in ('qualified', 'booked', 'won', 'lost')
    when 'lead.reopened' then
      event_metadata ?& array['change_code', 'previous_status', 'current_status', 'superseded_count']
      and not event_metadata ?| array['reason', 'amount_minor', 'note', 'note_ciphertext']
      and event_metadata ->> 'change_code' = 'lead_reopened'
      and event_metadata ->> 'previous_status' in ('won', 'lost')
      and event_metadata ->> 'current_status' in ('new', 'qualified', 'booked')
      and jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
      and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
    when 'revenue.recorded' then
      event_metadata ?& array['change_code', 'recorded_on', 'superseded_count']
      and not event_metadata ?| array['reason', 'amount_minor', 'note', 'note_ciphertext']
      and event_metadata ->> 'change_code' = 'revenue_recorded'
      and event_metadata ->> 'recorded_on' ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
      and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
    else true
  end
$$;

alter table public.audit_events
add constraint audit_events_lead_operation_metadata_check
check (public.is_sanitized_lead_operation_metadata(action, metadata)) not valid;

create or replace function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  scalar_value text;
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if item.key not in (
      'channel', 'change_code', 'reason_code',
      'status', 'previous_status', 'current_status',
      'provider', 'error_code', 'attribution_model', 'confidence', 'request_type',
      'expires_at', 'occurred_at', 'completed_at', 'window_start', 'window_end', 'recorded_on',
      'connection_id', 'lead_id', 'campaign_id', 'sync_run_id', 'privacy_request_id', 'site_id',
      'amount_minor', 'rows_processed', 'imported_count', 'published_count',
      'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted', 'consent_rows_deleted',
      'revenue_rows_deleted', 'idempotency_rows_deleted', 'lead_rows_deleted',
      'metric_rows_deleted', 'audit_rows_deleted', 'privacy_rows_deleted', 'matched_count',
      'superseded_count', 'has_more'
    ) or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
      or char_length(item.value::text) > 500 then
      return false;
    end if;

    scalar_value := item.value #>> '{}';

    if item.key = 'channel' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('magic_link') then return false; end if;

    if item.key = 'change_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'invitation_accepted', 'settings_saved',
        'lead_status_changed', 'lead_reopened', 'revenue_recorded'
      ) then return false; end if;

    if item.key = 'reason_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('tenant_not_allowed') then return false; end if;

    if item.key in ('status', 'previous_status', 'current_status')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'active', 'suspended', 'closed', 'new', 'qualified', 'booked', 'won', 'lost',
        'healthy', 'degraded', 'action_required', 'revoked', 'pending', 'running',
        'succeeded', 'partial', 'failed', 'verified', 'restricted', 'processing',
        'completed', 'enabled', 'paused', 'removed', 'unknown'
      ) then return false; end if;

    if item.key = 'provider' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('google_analytics', 'google_ads', 'meta_ads') then return false; end if;

    if item.key = 'error_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'RATE_LIMITED', 'NETWORK', 'TOKEN_EXPIRED', 'TOKEN_REVOKED',
        'INVALID_RESPONSE', 'INVALID_SCOPE'
      ) then return false; end if;

    if item.key = 'attribution_model' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('first_touch', 'last_touch') then return false; end if;

    if item.key = 'confidence' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('high', 'medium', 'low') then return false; end if;

    if item.key = 'request_type' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('access', 'correction', 'deletion', 'export', 'opt_out') then
      return false;
    end if;

    if item.key in (
      'connection_id', 'lead_id', 'campaign_id', 'sync_run_id', 'privacy_request_id', 'site_id'
    ) and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;

    if item.key in ('expires_at', 'occurred_at', 'completed_at')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}(:\d{2})?)$' then
      return false;
    end if;

    if item.key in ('window_start', 'window_end', 'recorded_on')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;

    if item.key in (
      'amount_minor', 'rows_processed', 'imported_count', 'published_count',
      'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted',
      'consent_rows_deleted', 'revenue_rows_deleted', 'idempotency_rows_deleted',
      'lead_rows_deleted', 'metric_rows_deleted', 'audit_rows_deleted',
      'privacy_rows_deleted', 'matched_count', 'superseded_count'
    ) and jsonb_typeof(item.value) <> 'null'
      and (jsonb_typeof(item.value) <> 'number' or scalar_value !~ '^[0-9]+$') then
      return false;
    end if;

    if item.key = 'has_more' and jsonb_typeof(item.value) not in ('boolean', 'null') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.enforce_lead_status_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure;

  if old.status is distinct from new.status
    and auth.uid() is not null
    and current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'lead status changes require transaction function';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_revenue_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure;

  if auth.uid() is not null and current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'revenue changes require transaction function';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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

  perform public.write_audit_event(
    target_tenant, 'lead.status_changed', 'lead', target_lead, event_request_id,
    jsonb_build_object(
      'change_code', 'lead_status_changed',
      'previous_status', previous_status,
      'current_status', next_status
    ),
    actor_user_id
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

  perform public.write_audit_event(
    target_tenant, 'lead.reopened', 'lead', target_lead, event_request_id,
    jsonb_build_object(
      'change_code', 'lead_reopened',
      'previous_status', previous_status,
      'current_status', restored_status,
      'superseded_count', superseded_count
    ),
    actor_user_id
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

  perform public.write_audit_event(
    target_tenant, 'revenue.recorded', 'lead', target_lead, event_request_id,
    jsonb_build_object(
      'change_code', 'revenue_recorded',
      'recorded_on', revenue_confirmed_on,
      'superseded_count', superseded_count
    ),
    actor_user_id
  );

  return jsonb_build_object(
    'amount_minor', revenue_amount_minor::text,
    'currency', revenue_currency,
    'confirmed_on', revenue_confirmed_on,
    'last_activity_at', recorded_at
  );
end;
$$;

revoke all on function public.amount_minor_text(public.revenue_outcomes) from public, anon;
grant execute on function public.amount_minor_text(public.revenue_outcomes) to authenticated, service_role;
revoke all on function public.is_sanitized_lead_operation_metadata(public.audit_action, jsonb)
from public, anon, authenticated;
