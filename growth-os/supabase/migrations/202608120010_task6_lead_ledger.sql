create or replace function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'channel', 'change_code', 'reason_code', 'reason',
    'status', 'previous_status', 'current_status',
    'provider', 'error_code', 'attribution_model', 'confidence', 'request_type',
    'expires_at', 'occurred_at', 'completed_at', 'window_start', 'window_end', 'recorded_on',
    'connection_id', 'lead_id', 'campaign_id', 'sync_run_id', 'privacy_request_id', 'site_id',
    'amount_minor', 'rows_processed', 'imported_count', 'published_count',
    'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted', 'consent_rows_deleted',
    'revenue_rows_deleted', 'idempotency_rows_deleted', 'lead_rows_deleted',
    'metric_rows_deleted', 'audit_rows_deleted', 'privacy_rows_deleted', 'matched_count', 'has_more'
  ];
  item record;
  scalar_value text;
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if not item.key = any(allowed_keys)
      or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
      or (item.key <> 'reason' and char_length(item.value::text) > 500) then
      return false;
    end if;

    scalar_value := item.value #>> '{}';

    if item.key = 'reason'
      and (
        jsonb_typeof(item.value) <> 'string'
        or char_length(scalar_value) not between 10 and 500
        or scalar_value ~ '[[:cntrl:]]'
      ) then
      return false;
    end if;

    if item.key = 'channel'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('magic_link') then
      return false;
    end if;

    if item.key = 'change_code'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('invitation_accepted', 'settings_saved') then
      return false;
    end if;

    if item.key = 'reason_code'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('tenant_not_allowed') then
      return false;
    end if;

    if item.key in ('status', 'previous_status', 'current_status')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'active', 'suspended', 'closed',
        'new', 'qualified', 'booked', 'won', 'lost',
        'healthy', 'degraded', 'action_required', 'revoked',
        'pending', 'running', 'succeeded', 'partial', 'failed',
        'verified', 'restricted', 'processing', 'completed',
        'enabled', 'paused', 'removed', 'unknown'
      ) then
      return false;
    end if;

    if item.key = 'provider'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('google_analytics', 'google_ads', 'meta_ads') then
      return false;
    end if;

    if item.key = 'error_code'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'RATE_LIMITED', 'NETWORK', 'TOKEN_EXPIRED', 'TOKEN_REVOKED',
        'INVALID_RESPONSE', 'INVALID_SCOPE'
      ) then
      return false;
    end if;

    if item.key = 'attribution_model'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('first_touch', 'last_touch') then
      return false;
    end if;

    if item.key = 'confidence'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('high', 'medium', 'low') then
      return false;
    end if;

    if item.key = 'request_type'
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('access', 'correction', 'deletion', 'export', 'opt_out') then
      return false;
    end if;

    if item.key in (
      'connection_id', 'lead_id', 'campaign_id', 'sync_run_id',
      'privacy_request_id', 'site_id'
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
      and scalar_value !~ '^\d{4}-\d{2}-\d{2}$' then
      return false;
    end if;

    if item.key in (
      'amount_minor', 'rows_processed', 'imported_count', 'published_count',
      'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted',
      'consent_rows_deleted', 'revenue_rows_deleted', 'idempotency_rows_deleted',
      'lead_rows_deleted', 'metric_rows_deleted', 'audit_rows_deleted',
      'privacy_rows_deleted', 'matched_count'
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

create function public.is_iso_4217_currency(input_value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select input_value = any (array[
    'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD',
    'BIF','BMD','BND','BOB','BOV','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHE','CHF',
    'CHW','CLF','CLP','CNY','COP','COU','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP',
    'ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL',
    'HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF',
    'KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD',
    'MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MXV','MYR','MZN','NAD','NGN','NIO','NOK',
    'NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF',
    'SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SOS','SRD','SSP','STN','SVC','SYP','SZL',
    'THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','USN','UYI','UYU',
    'UYW','UZS','VED','VES','VND','VUV','WST','XAF','XAG','XAU','XBA','XBB','XBC','XBD','XCG','XCD',
    'XDR','XOF','XPD','XPF','XPT','XSU','XTS','XUA','XXX','YER','ZAR','ZMW','ZWG'
  ]::text[])
$$;

create index leads_tenant_status_occurred_active_idx
on public.leads (tenant_id, status, occurred_at desc, id desc)
where restricted_at is null;

create index leads_tenant_source_occurred_active_idx
on public.leads (tenant_id, declared_source, occurred_at desc, id desc)
where restricted_at is null;

create function public.enforce_lead_status_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    and auth.uid() is not null
    and coalesce(current_setting('app.lead_status_transaction', true), '') <> 'true' then
    raise exception using errcode = '42501', message = 'lead status changes require transaction function';
  end if;
  return new;
end;
$$;

create trigger enforce_lead_status_transaction
before update on public.leads
for each row execute function public.enforce_lead_status_transaction();

create function public.enforce_revenue_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and coalesce(current_setting('app.revenue_transaction', true), '') <> 'true' then
    raise exception using errcode = '42501', message = 'revenue changes require transaction function';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger enforce_revenue_transaction
before insert or update or delete on public.revenue_outcomes
for each row execute function public.enforce_revenue_transaction();

create function public.change_lead_status(
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

  select lead.status
  into previous_status
  from public.leads lead
  where lead.tenant_id = target_tenant
    and lead.id = target_lead
    and lead.restricted_at is null
  for update;

  if not found then
    return null;
  end if;

  if not (
    (previous_status = 'new' and next_status in ('qualified', 'lost'))
    or (previous_status = 'qualified' and next_status in ('booked', 'won', 'lost'))
    or (previous_status = 'booked' and next_status in ('won', 'lost'))
  ) then
    raise exception using errcode = '22023', message = 'lead status transition is not allowed';
  end if;

  perform set_config('app.lead_status_transaction', 'true', true);

  update public.leads
  set status = next_status,
      last_activity_at = changed_at,
      updated_at = changed_at
  where tenant_id = target_tenant
    and id = target_lead
    and restricted_at is null;

  perform set_config('app.lead_status_transaction', 'false', true);

  perform public.write_audit_event(
    target_tenant,
    'lead.status_changed',
    'lead',
    target_lead,
    event_request_id,
    jsonb_build_object(
      'previous_status', previous_status,
      'current_status', next_status
    ),
    actor_user_id
  );

  return jsonb_build_object(
    'status', next_status,
    'last_activity_at', changed_at
  );
end;
$$;

create function public.reopen_lead(
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
  canonical_reason text := btrim(coalesce(reopen_reason, ''));
  reopened_at timestamptz := clock_timestamp();
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  if char_length(canonical_reason) not between 10 and 500
    or canonical_reason ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'reopen reason must be 10-500 characters';
  end if;

  select lead.status
  into previous_status
  from public.leads lead
  where lead.tenant_id = target_tenant
    and lead.id = target_lead
    and lead.restricted_at is null
  for update;

  if not found then
    return null;
  end if;

  if previous_status not in ('won', 'lost') then
    raise exception using errcode = '22023', message = 'only terminal leads can be reopened';
  end if;

  perform set_config('app.lead_status_transaction', 'true', true);

  update public.leads
  set status = 'qualified',
      last_activity_at = reopened_at,
      updated_at = reopened_at
  where tenant_id = target_tenant
    and id = target_lead
    and restricted_at is null;

  perform set_config('app.lead_status_transaction', 'false', true);

  perform public.write_audit_event(
    target_tenant,
    'lead.reopened',
    'lead',
    target_lead,
    event_request_id,
    jsonb_build_object(
      'previous_status', previous_status,
      'current_status', 'qualified',
      'reason', canonical_reason
    ),
    actor_user_id
  );

  return jsonb_build_object(
    'status', 'qualified',
    'last_activity_at', reopened_at
  );
end;
$$;

create function public.record_lead_revenue(
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

  select lead.status
  into current_status
  from public.leads lead
  where lead.tenant_id = target_tenant
    and lead.id = target_lead
    and lead.restricted_at is null
  for update;

  if not found or current_status <> 'won' then
    raise exception using errcode = 'P0002', message = 'lead not found';
  end if;

  perform set_config('app.revenue_transaction', 'true', true);

  insert into public.revenue_outcomes (
    tenant_id,
    lead_id,
    amount_minor,
    currency,
    confirmed_on,
    confirmed_by,
    note_ciphertext,
    created_at,
    updated_at
  )
  values (
    target_tenant,
    target_lead,
    revenue_amount_minor,
    revenue_currency,
    revenue_confirmed_on,
    actor_user_id,
    revenue_note_ciphertext,
    recorded_at,
    recorded_at
  )
  on conflict (tenant_id, lead_id) do update
  set amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      confirmed_on = excluded.confirmed_on,
      confirmed_by = excluded.confirmed_by,
      note_ciphertext = excluded.note_ciphertext,
      updated_at = excluded.updated_at;

  perform set_config('app.revenue_transaction', 'false', true);

  update public.leads
  set last_activity_at = recorded_at,
      updated_at = recorded_at
  where tenant_id = target_tenant
    and id = target_lead
    and restricted_at is null;

  perform public.write_audit_event(
    target_tenant,
    'revenue.recorded',
    'lead',
    target_lead,
    event_request_id,
    jsonb_build_object('recorded_on', revenue_confirmed_on),
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

revoke all on function public.is_iso_4217_currency(text) from public, anon, authenticated;
revoke all on function public.enforce_lead_status_transaction() from public, anon, authenticated;
revoke all on function public.enforce_revenue_transaction() from public, anon, authenticated;
revoke all on function public.change_lead_status(uuid, uuid, public.lead_status, uuid)
from public, anon, authenticated;
revoke all on function public.reopen_lead(uuid, uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.record_lead_revenue(uuid, uuid, bigint, text, date, text, uuid)
from public, anon, authenticated;

grant execute on function public.change_lead_status(uuid, uuid, public.lead_status, uuid)
to authenticated;
grant execute on function public.reopen_lead(uuid, uuid, text, uuid)
to authenticated;
grant execute on function public.record_lead_revenue(uuid, uuid, bigint, text, date, text, uuid)
to authenticated;
