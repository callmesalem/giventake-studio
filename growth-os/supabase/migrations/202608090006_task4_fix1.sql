create or replace function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys constant text[] := array[
    'channel', 'change_code', 'reason_code', 'status', 'previous_status', 'current_status',
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
      or char_length(item.value::text) > 500 then
      return false;
    end if;

    scalar_value := item.value #>> '{}';

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

create function public.current_support_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_headers jsonb;
  session_value text;
begin
  begin
    request_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;

  session_value := request_headers ->> 'x-gt-support-session';
  if session_value is null
    or session_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return session_value::uuid;
end;
$$;

create or replace function public.has_active_support_session(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.support_sessions s
    join public.platform_admins p on p.user_id = s.admin_user_id
    where s.id = public.current_support_session_id()
      and s.tenant_id = target_tenant
      and s.admin_user_id = (select auth.uid())
      and s.revoked_at is null
      and s.expires_at > now()
      and exists (
        select 1
        from public.audit_events a
        where a.tenant_id = s.tenant_id
          and a.actor_user_id = s.admin_user_id
          and a.action = 'support.started'
          and a.target_type = 'support_session'
          and a.target_id = s.id
      )
  );
$$;

create or replace function public.can_access_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_client_owner(target_tenant)
    or public.has_active_support_session(target_tenant);
$$;

revoke all on function public.current_support_session_id() from public, anon, authenticated;

drop function public.update_tenant_brand(uuid, text, text, text, text, text, text, uuid);

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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  canonical_display_name text := regexp_replace(
    coalesce(brand_display_name, ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  canonical_logo_url text := btrim(coalesce(brand_logo_url, ''));
  canonical_primary_color text := lower(btrim(coalesce(brand_primary_color, '')));
  canonical_accent_color text := lower(btrim(coalesce(brand_accent_color, '')));
  canonical_on_primary_color text := lower(btrim(coalesce(brand_on_primary_color, '')));
  canonical_report_name text := regexp_replace(
    coalesce(brand_report_name, ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  canonical_brand jsonb;
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  if not exists (
    select 1 from public.tenants where id = target_tenant and status = 'active'
  ) then
    raise exception using errcode = '23503', message = 'active tenant not found';
  end if;

  if char_length(coalesce(canonical_display_name, '')) not between 1 and 120
    or char_length(coalesce(canonical_report_name, '')) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'brand names must be 1-120 non-whitespace characters';
  end if;

  if char_length(canonical_logo_url) not between 1 and 500
    or canonical_logo_url !~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
    raise exception using errcode = '22023', message = 'brand logo must be a valid HTTPS URL';
  end if;

  if canonical_primary_color !~ '^[0-9a-f]{6}$'
    or canonical_accent_color !~ '^[0-9a-f]{6}$'
    or canonical_on_primary_color !~ '^[0-9a-f]{6}$' then
    raise exception using errcode = '22023', message = 'brand colors must be six-digit hex values';
  end if;

  if public.brand_contrast_ratio(canonical_primary_color, canonical_on_primary_color) < 4.5 then
    raise exception using errcode = '22023', message = 'brand contrast must be at least 4.5 to 1';
  end if;

  insert into public.brands (
    tenant_id, display_name, logo_url, primary_color, accent_color, on_primary_color, report_name
  )
  values (
    target_tenant, canonical_display_name, canonical_logo_url, canonical_primary_color,
    canonical_accent_color, canonical_on_primary_color, canonical_report_name
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

  canonical_brand := jsonb_build_object(
    'display_name', canonical_display_name,
    'logo_url', canonical_logo_url,
    'primary_color', canonical_primary_color,
    'accent_color', canonical_accent_color,
    'on_primary_color', canonical_on_primary_color,
    'report_name', canonical_report_name
  );
  return canonical_brand;
end;
$$;

revoke all on function public.update_tenant_brand(
  uuid, text, text, text, text, text, text, uuid
) from public, anon;
grant execute on function public.update_tenant_brand(
  uuid, text, text, text, text, text, text, uuid
) to authenticated;
