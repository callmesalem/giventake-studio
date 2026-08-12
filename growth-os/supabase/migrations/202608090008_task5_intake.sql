create unique index sites_key_id_unique_idx on public.sites (key_id);

create table public.ingest_rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  attempted_at timestamptz not null,
  constraint ingest_rate_limit_attempts_tenant_site_fkey
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete cascade
);

create index ingest_rate_limit_attempts_site_time_idx
on public.ingest_rate_limit_attempts (site_id, attempted_at);

alter table public.ingest_rate_limit_attempts enable row level security;
alter table public.ingest_rate_limit_attempts force row level security;

create function public.consume_site_ingest_rate_limit(
  target_site uuid,
  target_tenant uuid,
  attempt_time timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_count integer;
  configured_limit smallint;
begin
  if target_site is null or target_tenant is null or attempt_time is null then
    raise exception using errcode = '22004', message = 'site rate limit input is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_site::text, 0)
  );

  select site.rate_limit_per_minute
  into configured_limit
  from public.sites site
  join public.tenants tenant on tenant.id = site.tenant_id
  where site.id = target_site
    and site.tenant_id = target_tenant
    and site.enabled
    and tenant.status = 'active';

  if configured_limit is null then
    return false;
  end if;

  delete from public.ingest_rate_limit_attempts attempt
  where attempt.site_id = target_site
    and attempt.tenant_id = target_tenant
    and attempt.attempted_at <= attempt_time - interval '60 seconds';

  select count(*)::integer
  into attempt_count
  from public.ingest_rate_limit_attempts attempt
  where attempt.site_id = target_site
    and attempt.tenant_id = target_tenant
    and attempt.attempted_at > attempt_time - interval '60 seconds'
    and attempt.attempted_at <= attempt_time;

  if attempt_count >= configured_limit then
    return false;
  end if;

  insert into public.ingest_rate_limit_attempts (tenant_id, site_id, attempted_at)
  values (target_tenant, target_site, attempt_time);
  return true;
end;
$$;

create function public.ingest_website_lead(
  target_tenant uuid,
  target_site uuid,
  request_idempotency_key uuid,
  request_body_digest text,
  external_event uuid,
  event_occurred_at timestamptz,
  encrypted_lead jsonb,
  attribution jsonb,
  consent jsonb,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent_analytics boolean;
  consent_gpc boolean;
  consent_marketing boolean;
  consent_necessary boolean;
  consent_preferences boolean;
  contact_requested boolean;
  evidence_id uuid;
  existing_digest text;
  existing_lead_id uuid;
  lead_id uuid := gen_random_uuid();
  safe_click_ids jsonb;
begin
  if target_tenant is null
    or target_site is null
    or request_idempotency_key is null
    or external_event is null
    or event_occurred_at is null then
    raise exception using errcode = '22004', message = 'required intake identifier is missing';
  end if;

  if request_body_digest is null or request_body_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'request digest is invalid';
  end if;

  if not exists (
    select 1
    from public.sites site
    join public.tenants tenant on tenant.id = site.tenant_id
    where site.id = target_site
      and site.tenant_id = target_tenant
      and site.enabled
      and tenant.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active intake site required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_tenant::text || ':' || target_site::text || ':' || request_idempotency_key::text,
      0
    )
  );

  select reservation.body_digest, reservation.lead_id
  into existing_digest, existing_lead_id
  from public.ingest_idempotency reservation
  where reservation.tenant_id = target_tenant
    and reservation.site_id = target_site
    and reservation.idempotency_key = request_idempotency_key;

  if found then
    if existing_digest <> request_body_digest then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('status', 'duplicate', 'lead_id', existing_lead_id);
  end if;

  if jsonb_typeof(encrypted_lead) <> 'object'
    or encrypted_lead - array[
      'name_ciphertext', 'email_ciphertext', 'email_lookup_hash', 'phone_ciphertext',
      'phone_lookup_hash', 'company_ciphertext', 'notes_ciphertext', 'budget_range',
      'timeline_range'
    ] <> '{}'::jsonb
    or not encrypted_lead ?& array[
      'name_ciphertext', 'email_ciphertext', 'email_lookup_hash', 'phone_ciphertext',
      'phone_lookup_hash', 'company_ciphertext', 'notes_ciphertext', 'budget_range',
      'timeline_range'
    ] then
    raise exception using errcode = '22023', message = 'encrypted lead shape is invalid';
  end if;

  if jsonb_typeof(attribution) <> 'object'
    or attribution - array[
      'declared_source', 'source_detail', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'referrer_domain', 'click_ids', 'landing_origin',
      'landing_path', 'offer_id'
    ] <> '{}'::jsonb
    or not attribution ?& array[
      'declared_source', 'source_detail', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'referrer_domain', 'click_ids', 'landing_origin',
      'landing_path', 'offer_id'
    ] then
    raise exception using errcode = '22023', message = 'attribution shape is invalid';
  end if;

  if jsonb_typeof(consent) <> 'object'
    or consent - array[
      'policy_version', 'source', 'necessary', 'analytics', 'marketing', 'preferences',
      'contact_requested', 'gpc', 'recorded_at'
    ] <> '{}'::jsonb
    or not consent ?& array[
      'policy_version', 'source', 'necessary', 'analytics', 'marketing', 'preferences',
      'contact_requested', 'gpc', 'recorded_at'
    ] then
    raise exception using errcode = '22023', message = 'consent shape is invalid';
  end if;

  begin
    consent_necessary := (consent ->> 'necessary')::boolean;
    consent_analytics := (consent ->> 'analytics')::boolean;
    consent_marketing := (consent ->> 'marketing')::boolean;
    consent_preferences := (consent ->> 'preferences')::boolean;
    contact_requested := (consent ->> 'contact_requested')::boolean;
    consent_gpc := (consent ->> 'gpc')::boolean;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'consent categories are invalid';
  end;

  if consent ->> 'source' <> 'contact-form'
    or not consent_necessary
    or not contact_requested then
    raise exception using errcode = '22023', message = 'necessary contact consent is required';
  end if;

  if consent_gpc then
    consent_marketing := false;
  end if;
  safe_click_ids := case
    when consent_marketing and not consent_gpc then attribution -> 'click_ids'
    else '{}'::jsonb
  end;

  insert into public.leads (
    id,
    tenant_id,
    site_id,
    external_event_id,
    name_ciphertext,
    email_ciphertext,
    email_lookup_hash,
    phone_ciphertext,
    phone_lookup_hash,
    company_ciphertext,
    notes_ciphertext,
    declared_source,
    source_detail,
    budget_range,
    timeline_range,
    occurred_at
  )
  values (
    lead_id,
    target_tenant,
    target_site,
    external_event,
    encrypted_lead ->> 'name_ciphertext',
    encrypted_lead ->> 'email_ciphertext',
    encrypted_lead ->> 'email_lookup_hash',
    encrypted_lead ->> 'phone_ciphertext',
    encrypted_lead ->> 'phone_lookup_hash',
    encrypted_lead ->> 'company_ciphertext',
    encrypted_lead ->> 'notes_ciphertext',
    attribution ->> 'declared_source',
    attribution ->> 'source_detail',
    encrypted_lead ->> 'budget_range',
    encrypted_lead ->> 'timeline_range',
    event_occurred_at
  );

  insert into public.attribution_evidence (
    tenant_id,
    lead_id,
    occurred_at,
    declared_source,
    source_detail,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    referrer_domain,
    click_ids,
    landing_origin,
    landing_path,
    offer_id
  )
  values (
    target_tenant,
    lead_id,
    event_occurred_at,
    attribution ->> 'declared_source',
    attribution ->> 'source_detail',
    attribution ->> 'utm_source',
    attribution ->> 'utm_medium',
    attribution ->> 'utm_campaign',
    attribution ->> 'utm_content',
    attribution ->> 'utm_term',
    attribution ->> 'referrer_domain',
    safe_click_ids,
    attribution ->> 'landing_origin',
    attribution ->> 'landing_path',
    attribution ->> 'offer_id'
  )
  returning id into evidence_id;

  insert into public.attribution_touches (
    tenant_id,
    lead_id,
    evidence_id,
    touch_type,
    normalized_source,
    confidence,
    state,
    reason_codes
  )
  values (
    target_tenant,
    lead_id,
    evidence_id,
    'unresolved',
    'unresolved',
    'low',
    'unattributed',
    array['pending_attribution']
  );

  insert into public.consent_receipts (
    tenant_id,
    lead_id,
    receipt_type,
    policy_version,
    processing_basis,
    categories,
    source,
    recorded_at
  )
  values (
    target_tenant,
    lead_id,
    'website_lead',
    consent ->> 'policy_version',
    'contact_request',
    jsonb_build_object(
      'necessary', consent_necessary,
      'analytics', consent_analytics,
      'marketing', consent_marketing,
      'preferences', consent_preferences,
      'contact_requested', contact_requested,
      'gpc', consent_gpc
    ),
    consent ->> 'source',
    (consent ->> 'recorded_at')::timestamptz
  );

  insert into public.ingest_idempotency (
    tenant_id,
    site_id,
    idempotency_key,
    body_digest,
    lead_id
  )
  values (
    target_tenant,
    target_site,
    request_idempotency_key,
    request_body_digest,
    lead_id
  );

  perform public.write_audit_event(
    target_tenant,
    'lead.created',
    'lead',
    lead_id,
    event_request_id,
    jsonb_build_object('site_id', target_site, 'lead_id', lead_id),
    null
  );

  return jsonb_build_object('status', 'accepted', 'lead_id', lead_id);
end;
$$;

revoke all on table public.ingest_rate_limit_attempts from public, anon, authenticated;
revoke all on function public.consume_site_ingest_rate_limit(uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.ingest_website_lead(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.consume_site_ingest_rate_limit(uuid, uuid, timestamptz)
to service_role;
grant execute on function public.ingest_website_lead(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) to service_role;
