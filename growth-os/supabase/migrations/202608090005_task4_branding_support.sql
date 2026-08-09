create or replace function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'channel',
    'change_code',
    'reason_code',
    'status',
    'previous_status',
    'current_status',
    'provider',
    'error_code',
    'attribution_model',
    'confidence',
    'expires_at',
    'occurred_at',
    'completed_at',
    'window_start',
    'window_end',
    'recorded_on',
    'connection_id',
    'lead_id',
    'campaign_id',
    'sync_run_id',
    'privacy_request_id',
    'site_id',
    'amount_minor',
    'rows_processed',
    'imported_count',
    'published_count',
    'sync_rows_deleted',
    'evidence_rows_deleted',
    'touch_rows_deleted',
    'consent_rows_deleted',
    'revenue_rows_deleted',
    'idempotency_rows_deleted',
    'lead_rows_deleted',
    'metric_rows_deleted',
    'audit_rows_deleted',
    'privacy_rows_deleted',
    'has_more'
  ];
  item record;
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if not item.key = any(allowed_keys)
      or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
      or char_length(item.value::text) > 500 then
      return false;
    end if;

    if item.key in (
      'connection_id',
      'lead_id',
      'campaign_id',
      'sync_run_id',
      'privacy_request_id',
      'site_id'
    ) and jsonb_typeof(item.value) <> 'null'
      and (item.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;

    if item.key in (
      'channel',
      'change_code',
      'reason_code',
      'status',
      'previous_status',
      'current_status',
      'attribution_model'
    ) and jsonb_typeof(item.value) <> 'null'
      and (
        char_length(item.value #>> '{}') > 80
        or (item.value #>> '{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      ) then
      return false;
    end if;

    if item.key = 'error_code' and jsonb_typeof(item.value) <> 'null'
      and (
        char_length(item.value #>> '{}') > 80
        or (item.value #>> '{}') !~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'
      ) then
      return false;
    end if;

    if item.key = 'provider' and jsonb_typeof(item.value) <> 'null'
      and (item.value #>> '{}') not in ('google_analytics', 'google_ads', 'meta_ads') then
      return false;
    end if;

    if item.key = 'confidence' and jsonb_typeof(item.value) <> 'null'
      and (item.value #>> '{}') not in ('high', 'medium', 'low') then
      return false;
    end if;

    if item.key in ('expires_at', 'occurred_at', 'completed_at')
      and jsonb_typeof(item.value) <> 'null'
      and (item.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}(:\d{2})?)$' then
      return false;
    end if;

    if item.key in ('window_start', 'window_end', 'recorded_on')
      and jsonb_typeof(item.value) <> 'null'
      and (item.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
      return false;
    end if;

    if item.key in (
      'amount_minor',
      'rows_processed',
      'imported_count',
      'published_count',
      'sync_rows_deleted',
      'evidence_rows_deleted',
      'touch_rows_deleted',
      'consent_rows_deleted',
      'revenue_rows_deleted',
      'idempotency_rows_deleted',
      'lead_rows_deleted',
      'metric_rows_deleted',
      'audit_rows_deleted',
      'privacy_rows_deleted'
    ) and jsonb_typeof(item.value) <> 'null' and (
      jsonb_typeof(item.value) <> 'number'
      or (item.value #>> '{}') !~ '^[0-9]+$'
    ) then
      return false;
    end if;

    if item.key = 'has_more'
      and jsonb_typeof(item.value) not in ('boolean', 'null') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function public.brand_contrast_ratio(first_color text, second_color text)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_bytes bytea;
  second_bytes bytea;
  channel double precision;
  first_luminance double precision := 0;
  second_luminance double precision := 0;
  weights constant double precision[] := array[0.2126, 0.7152, 0.0722];
begin
  if first_color !~ '^[0-9A-Fa-f]{6}$' or second_color !~ '^[0-9A-Fa-f]{6}$' then
    return null;
  end if;

  first_bytes := decode(first_color, 'hex');
  second_bytes := decode(second_color, 'hex');

  for position in 0..2 loop
    channel := get_byte(first_bytes, position)::double precision / 255;
    first_luminance := first_luminance + weights[position + 1] * case
      when channel <= 0.04045 then channel / 12.92
      else power((channel + 0.055) / 1.055, 2.4)
    end;

    channel := get_byte(second_bytes, position)::double precision / 255;
    second_luminance := second_luminance + weights[position + 1] * case
      when channel <= 0.04045 then channel / 12.92
      else power((channel + 0.055) / 1.055, 2.4)
    end;
  end loop;

  return (greatest(first_luminance, second_luminance) + 0.05)
    / (least(first_luminance, second_luminance) + 0.05);
end;
$$;

create function public.update_tenant_brand(
  target_tenant uuid,
  brand_display_name text,
  brand_logo_url text,
  brand_primary_color text,
  brand_accent_color text,
  brand_on_primary_color text,
  brand_report_name text,
  event_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  if not exists (
    select 1 from public.tenants where id = target_tenant and status = 'active'
  ) then
    raise exception using errcode = '23503', message = 'active tenant not found';
  end if;

  if public.brand_contrast_ratio(brand_primary_color, brand_on_primary_color) < 4.5 then
    raise exception using errcode = '22023', message = 'brand contrast must be at least 4.5 to 1';
  end if;

  insert into public.brands (
    tenant_id,
    display_name,
    logo_url,
    primary_color,
    accent_color,
    on_primary_color,
    report_name
  )
  values (
    target_tenant,
    brand_display_name,
    brand_logo_url,
    brand_primary_color,
    brand_accent_color,
    brand_on_primary_color,
    brand_report_name
  )
  on conflict (tenant_id) do update
  set
    display_name = excluded.display_name,
    logo_url = excluded.logo_url,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    on_primary_color = excluded.on_primary_color,
    report_name = excluded.report_name,
    updated_at = now();

  perform public.write_audit_event(
    target_tenant,
    'brand.updated',
    'brand',
    target_tenant,
    event_request_id,
    jsonb_build_object('change_code', 'settings_saved'),
    actor_user_id
  );

  return true;
end;
$$;

create or replace function public.start_support_session(
  target_tenant uuid,
  target_admin_user uuid,
  session_reason text,
  requested_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_id uuid;
  session_started_at timestamptz := clock_timestamp();
begin
  if char_length(btrim(coalesce(session_reason, ''))) not between 10 and 500
    or session_reason ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'support reason must be sanitized and 10-500 characters';
  end if;

  if requested_expires_at is null
    or requested_expires_at <= session_started_at
    or requested_expires_at > session_started_at + interval '60 minutes' then
    raise exception using errcode = '22023', message = 'support session expiry must be within 60 minutes';
  end if;

  if not exists (
    select 1 from public.tenants where id = target_tenant and status = 'active'
  ) then
    raise exception using errcode = '23503', message = 'active tenant not found';
  end if;

  if not exists (
    select 1 from public.platform_admins where user_id = target_admin_user
  ) then
    raise exception using errcode = '42501', message = 'platform administrator required';
  end if;

  insert into public.support_sessions (
    tenant_id,
    admin_user_id,
    reason,
    started_at,
    expires_at
  )
  values (
    target_tenant,
    target_admin_user,
    btrim(session_reason),
    session_started_at,
    requested_expires_at
  )
  returning id into session_id;

  perform public.write_audit_event(
    target_tenant,
    'support.started',
    'support_session',
    session_id,
    gen_random_uuid(),
    jsonb_build_object('expires_at', requested_expires_at),
    target_admin_user
  );

  return session_id;
end;
$$;

create function public.end_support_session(
  target_session uuid,
  target_admin_user uuid,
  event_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended_tenant uuid;
begin
  if not exists (
    select 1 from public.platform_admins where user_id = target_admin_user
  ) then
    raise exception using errcode = '42501', message = 'platform administrator required';
  end if;

  update public.support_sessions
  set revoked_at = clock_timestamp()
  where id = target_session
    and admin_user_id = target_admin_user
    and revoked_at is null
    and expires_at > clock_timestamp()
  returning tenant_id into ended_tenant;

  if ended_tenant is null then
    raise exception using errcode = 'P0002', message = 'active support session not found';
  end if;

  perform public.write_audit_event(
    ended_tenant,
    'support.ended',
    'support_session',
    target_session,
    event_request_id,
    '{}'::jsonb,
    target_admin_user
  );

  return ended_tenant;
end;
$$;

revoke all on function public.update_tenant_brand(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) from public;
revoke all on function public.end_support_session(uuid, uuid, uuid) from public;
revoke all on function public.brand_contrast_ratio(text, text) from public;

revoke insert, update, delete on public.brands from authenticated;

grant execute on function public.update_tenant_brand(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) to authenticated;
grant execute on function public.end_support_session(uuid, uuid, uuid) to service_role;
