create or replace function public.publish_metric_window(
  target_tenant uuid,
  target_connection uuid,
  window_start date,
  window_end date,
  rows_payload jsonb,
  completed_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_currency char(3);
  published_count integer;
begin
  if window_start is null
    or window_end is null
    or window_end < window_start
    or window_end - window_start > 31 then
    raise exception using errcode = '22023', message = 'invalid sync window';
  end if;

  if jsonb_typeof(rows_payload) <> 'array' then
    raise exception using errcode = '22023', message = 'metric rows must be an array';
  end if;

  select currency
  into connection_currency
  from public.connections
  where id = target_connection
    and tenant_id = target_tenant
    and revoked_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'connection not found';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(rows_payload) row_value
    where jsonb_typeof(row_value) <> 'object'
      or not (row_value ? 'campaign_id')
      or not (row_value ? 'metric_date')
      or not (row_value ? 'currency')
      or (row_value ->> 'currency') !~ '^[A-Z]{3}$'
      or (row_value ->> 'currency') <> connection_currency::text
  ) then
    raise exception using errcode = '22023', message = 'invalid metric row shape';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(rows_payload) as x(
      campaign_id uuid,
      metric_date date,
      currency text,
      impressions bigint,
      clicks bigint,
      sessions bigint,
      engaged_sessions bigint,
      users_count bigint,
      spend_minor bigint,
      provider_conversions numeric,
      provider_conversion_value_minor bigint
    )
    left join public.campaigns c
      on c.id = x.campaign_id
      and c.tenant_id = target_tenant
      and c.connection_id = target_connection
    where x.campaign_id is null
      or c.id is null
      or x.metric_date not between window_start and window_end
      or x.impressions < 0
      or x.clicks < 0
      or x.sessions < 0
      or x.engaged_sessions < 0
      or x.users_count < 0
      or x.spend_minor < 0
      or x.provider_conversions < 0
      or x.provider_conversion_value_minor < 0
  ) then
    raise exception using errcode = '22023', message = 'invalid metric row values';
  end if;

  delete from public.campaign_metrics_daily
  where tenant_id = target_tenant
    and connection_id = target_connection
    and metric_date between window_start and window_end;

  insert into public.campaign_metrics_daily (
    tenant_id,
    connection_id,
    campaign_id,
    metric_date,
    currency,
    impressions,
    clicks,
    sessions,
    engaged_sessions,
    users_count,
    spend_minor,
    provider_conversions,
    provider_conversion_value_minor,
    is_complete,
    source_updated_at
  )
  select
    target_tenant,
    target_connection,
    x.campaign_id,
    x.metric_date,
    x.currency,
    x.impressions,
    x.clicks,
    x.sessions,
    x.engaged_sessions,
    x.users_count,
    x.spend_minor,
    x.provider_conversions,
    x.provider_conversion_value_minor,
    true,
    completed_at
  from jsonb_to_recordset(rows_payload) as x(
    campaign_id uuid,
    metric_date date,
    currency char(3),
    impressions bigint,
    clicks bigint,
    sessions bigint,
    engaged_sessions bigint,
    users_count bigint,
    spend_minor bigint,
    provider_conversions numeric,
    provider_conversion_value_minor bigint
  );

  get diagnostics published_count = row_count;
  return published_count;
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
  if char_length(btrim(coalesce(session_reason, ''))) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'support reason must be 10-500 characters';
  end if;

  if requested_expires_at is null
    or requested_expires_at <= session_started_at
    or requested_expires_at > session_started_at + interval '60 minutes' then
    raise exception using errcode = '22023', message = 'support session expiry must be within 60 minutes';
  end if;

  if not exists (select 1 from public.tenants where id = target_tenant) then
    raise exception using errcode = '23503', message = 'tenant not found';
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

create or replace function public.restrict_privacy_subject(
  target_tenant uuid,
  requested_type text,
  subject_lookup_hmac text,
  requester_user_id uuid,
  event_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_count integer;
  privacy_request_id uuid;
  restricted_time timestamptz := clock_timestamp();
begin
  if requested_type not in ('access', 'correction', 'deletion', 'export', 'opt_out') then
    raise exception using errcode = '22023', message = 'invalid privacy request type';
  end if;

  if char_length(subject_lookup_hmac) not between 32 and 255 then
    raise exception using errcode = '22023', message = 'invalid subject lookup';
  end if;

  if not exists (
    select 1
    from public.memberships
    where tenant_id = target_tenant
      and user_id = requester_user_id
      and role = 'client_owner'
  ) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  update public.leads
  set
    restricted_at = coalesce(restricted_at, restricted_time),
    updated_at = restricted_time
  where tenant_id = target_tenant
    and (
      email_lookup_hash = subject_lookup_hmac
      or phone_lookup_hash = subject_lookup_hmac
    );

  get diagnostics matched_count = row_count;

  insert into public.privacy_requests (
    tenant_id,
    request_type,
    state,
    subject_lookup_hmac,
    requested_by,
    requested_at,
    verified_at,
    restricted_at
  )
  values (
    target_tenant,
    requested_type,
    'restricted',
    subject_lookup_hmac,
    requester_user_id,
    restricted_time,
    restricted_time,
    restricted_time
  )
  returning id into privacy_request_id;

  perform public.write_audit_event(
    target_tenant,
    'privacy.restricted',
    'privacy_request',
    privacy_request_id,
    event_request_id,
    jsonb_build_object(
      'request_type', requested_type,
      'matched_count', matched_count
    ),
    requester_user_id
  );

  return privacy_request_id;
end;
$$;

create or replace function public.run_retention_cleanup(
  target_tenant uuid,
  cleanup_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_count integer := 0;
  audit_cutoff timestamptz;
  attribution_touch_count integer := 0;
  evidence_count integer := 0;
  evidence_cutoff timestamptz;
  has_more boolean;
  lead_count integer := 0;
  lead_cutoff timestamptz;
  local_month_start timestamp;
  metric_count integer := 0;
  metric_cutoff date;
  privacy_count integer := 0;
  sync_payload_count integer := 0;
  tenant_record public.tenants%rowtype;
begin
  select * into tenant_record from public.tenants where id = target_tenant;
  if not found then
    raise exception using errcode = '23503', message = 'tenant not found';
  end if;

  local_month_start := date_trunc('month', cleanup_at at time zone tenant_record.timezone);
  evidence_cutoff := (local_month_start - interval '13 months') at time zone tenant_record.timezone;
  lead_cutoff := (
    local_month_start - make_interval(months => tenant_record.lead_retention_months::integer)
  ) at time zone tenant_record.timezone;
  metric_cutoff := (local_month_start - interval '25 months')::date;
  audit_cutoff := (local_month_start - interval '25 months') at time zone tenant_record.timezone;

  with candidates as (
    select id
    from public.sync_payloads
    where tenant_id = target_tenant and expires_at <= cleanup_at
    order by expires_at, id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.sync_payloads p
    using candidates c
    where p.id = c.id
    returning p.id
  )
  select count(*) into sync_payload_count from deleted;

  with candidates as (
    select id
    from public.attribution_evidence
    where tenant_id = target_tenant and occurred_at < evidence_cutoff
    order by occurred_at, id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.attribution_evidence e
    using candidates c
    where e.id = c.id
    returning e.id
  )
  select count(*) into evidence_count from deleted;

  with candidates as (
    select touch.id
    from public.attribution_touches touch
    join public.leads lead
      on lead.id = touch.lead_id
      and lead.tenant_id = touch.tenant_id
    where touch.tenant_id = target_tenant
      and lead.last_activity_at < lead_cutoff
    order by touch.created_at, touch.id
    limit 500
    for update of touch skip locked
  ), deleted as (
    delete from public.attribution_touches touch
    using candidates c
    where touch.id = c.id
    returning touch.id
  )
  select count(*) into attribution_touch_count from deleted;

  with candidates as (
    select lead.id
    from public.leads lead
    where lead.tenant_id = target_tenant
      and lead.last_activity_at < lead_cutoff
      and not exists (
        select 1
        from public.attribution_evidence evidence
        where evidence.tenant_id = target_tenant
          and evidence.lead_id = lead.id
      )
      and not exists (
        select 1
        from public.attribution_touches touch
        where touch.tenant_id = target_tenant
          and touch.lead_id = lead.id
      )
    order by lead.last_activity_at, lead.id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.leads l
    using candidates c
    where l.id = c.id
    returning l.id
  )
  select count(*) into lead_count from deleted;

  with candidates as (
    select id
    from public.campaign_metrics_daily
    where tenant_id = target_tenant and metric_date < metric_cutoff
    order by metric_date, id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.campaign_metrics_daily m
    using candidates c
    where m.id = c.id
    returning m.id
  )
  select count(*) into metric_count from deleted;

  with candidates as (
    select id
    from public.audit_events
    where tenant_id = target_tenant and created_at < audit_cutoff
    order by created_at, id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.audit_events a
    using candidates c
    where a.id = c.id
    returning a.id
  )
  select count(*) into audit_count from deleted;

  with candidates as (
    select id
    from public.privacy_requests
    where tenant_id = target_tenant
      and state = 'completed'
      and completed_at < audit_cutoff
    order by completed_at, id
    limit 500
    for update skip locked
  ), deleted as (
    delete from public.privacy_requests p
    using candidates c
    where p.id = c.id
    returning p.id
  )
  select count(*) into privacy_count from deleted;

  select
    exists (
      select 1 from public.sync_payloads
      where tenant_id = target_tenant and expires_at <= cleanup_at
    )
    or exists (
      select 1 from public.attribution_evidence
      where tenant_id = target_tenant and occurred_at < evidence_cutoff
    )
    or exists (
      select 1 from public.leads
      where tenant_id = target_tenant and last_activity_at < lead_cutoff
    )
    or exists (
      select 1
      from public.attribution_touches touch
      join public.leads lead
        on lead.id = touch.lead_id
        and lead.tenant_id = touch.tenant_id
      where touch.tenant_id = target_tenant
        and lead.last_activity_at < lead_cutoff
    )
    or exists (
      select 1 from public.campaign_metrics_daily
      where tenant_id = target_tenant and metric_date < metric_cutoff
    )
    or exists (
      select 1 from public.audit_events
      where tenant_id = target_tenant and created_at < audit_cutoff
    )
    or exists (
      select 1 from public.privacy_requests
      where tenant_id = target_tenant
        and state = 'completed'
        and completed_at < audit_cutoff
    )
  into has_more;

  perform public.write_audit_event(
    target_tenant,
    'retention.completed',
    'tenant',
    target_tenant,
    gen_random_uuid(),
    jsonb_build_object(
      'sync_rows_deleted', sync_payload_count,
      'evidence_rows_deleted', evidence_count,
      'touch_rows_deleted', attribution_touch_count,
      'lead_rows_deleted', lead_count,
      'metric_rows_deleted', metric_count,
      'audit_rows_deleted', audit_count,
      'privacy_rows_deleted', privacy_count,
      'has_more', has_more
    ),
    null
  );

  return jsonb_build_object(
    'syncPayloadsDeleted', sync_payload_count,
    'attributionEvidenceDeleted', evidence_count,
    'attributionTouchesDeleted', attribution_touch_count,
    'leadsDeleted', lead_count,
    'metricsDeleted', metric_count,
    'auditEventsDeleted', audit_count,
    'privacyRequestsDeleted', privacy_count,
    'hasMore', has_more
  );
end;
$$;

revoke all on function public.publish_metric_window(
  uuid,
  uuid,
  date,
  date,
  jsonb,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.start_support_session(
  uuid,
  uuid,
  text,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.restrict_privacy_subject(
  uuid,
  text,
  text,
  uuid,
  uuid
) from public, anon, authenticated;
revoke all on function public.run_retention_cleanup(uuid, timestamptz)
from public, anon, authenticated;

grant execute on function public.publish_metric_window(
  uuid,
  uuid,
  date,
  date,
  jsonb,
  timestamptz
) to service_role;
grant execute on function public.start_support_session(
  uuid,
  uuid,
  text,
  timestamptz
) to service_role;
grant execute on function public.restrict_privacy_subject(
  uuid,
  text,
  text,
  uuid,
  uuid
) to service_role;
grant execute on function public.run_retention_cleanup(uuid, timestamptz)
to service_role;
