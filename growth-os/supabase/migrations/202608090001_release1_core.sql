create extension if not exists pgcrypto with schema extensions;

create type public.tenant_status as enum ('active', 'suspended', 'closed');
create type public.membership_role as enum ('client_owner');
create type public.lead_status as enum ('new', 'qualified', 'booked', 'won', 'lost');
create type public.attribution_touch_type as enum ('unresolved', 'first', 'last', 'manual');
create type public.attribution_confidence as enum ('high', 'medium', 'low');
create type public.provider as enum ('google_analytics', 'google_ads', 'meta_ads');
create type public.connection_health as enum ('healthy', 'degraded', 'action_required', 'revoked');
create type public.sync_status as enum ('pending', 'running', 'succeeded', 'partial', 'failed');
create type public.privacy_request_state as enum (
  'pending',
  'verified',
  'restricted',
  'processing',
  'completed',
  'failed'
);
create type public.audit_action as enum (
  'auth.login',
  'auth.logout',
  'membership.invited',
  'membership.changed',
  'brand.updated',
  'support.started',
  'support.ended',
  'cross_tenant_access_denied',
  'lead.created',
  'lead.status_changed',
  'lead.reopened',
  'revenue.recorded',
  'attribution.recomputed',
  'attribution.corrected',
  'connector.authorized',
  'connector.synced',
  'connector.refresh_failed',
  'connector.revoked',
  'privacy.requested',
  'privacy.exported',
  'privacy.restricted',
  'privacy.deleted',
  'retention.completed'
);

create function public.is_allowlisted_click_ids(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  if input_value - array['gclid', 'gbraid', 'wbraid', 'fbclid'] <> '{}'::jsonb then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if jsonb_typeof(item.value) not in ('string', 'null')
      or char_length(item.value #>> '{}') > 200 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if char_length(item.key) > 80
      or item.key ~* '(email|phone|name|note|token|secret|credential|cipher|address|subject|payload)'
      or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
      or char_length(item.value::text) > 500 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  status public.tenant_status not null default 'active',
  timezone text not null default 'America/New_York',
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  lead_retention_months smallint not null default 24
    check (lead_retention_months between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, timezone),
  unique (id, currency)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null check (role = 'client_owner'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.brands (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  logo_url text not null check (
    char_length(logo_url) <= 500 and logo_url ~ '^https://[^[:space:]]+$'
  ),
  primary_color char(6) not null check (primary_color ~ '^[0-9A-Fa-f]{6}$'),
  accent_color char(6) not null check (accent_color ~ '^[0-9A-Fa-f]{6}$'),
  on_primary_color char(6) not null check (on_primary_color ~ '^[0-9A-Fa-f]{6}$'),
  report_name text not null check (char_length(report_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  role public.membership_role not null default 'client_owner' check (role = 'client_owner'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_at is null or accepted_at >= created_at)
);

create unique index membership_invitations_active_tenant_email_idx
on public.membership_invitations (tenant_id, email)
where accepted_at is null;

create unique index membership_invitations_token_hash_idx
on public.membership_invitations (token_hash);

create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  admin_user_id uuid not null references public.platform_admins(user_id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > started_at and expires_at <= started_at + interval '60 minutes'),
  check (revoked_at is null or revoked_at >= started_at)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  origin text not null check (
    char_length(origin) <= 255 and origin ~ '^https://[^/?#[:space:]]+$'
  ),
  key_id text not null check (char_length(key_id) between 8 and 120),
  signing_secret_ciphertext text not null check (char_length(signing_secret_ciphertext) >= 1),
  enabled boolean not null default true,
  rate_limit_per_minute smallint not null default 120
    check (rate_limit_per_minute between 1 and 120),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key_id),
  unique (tenant_id, origin),
  unique (tenant_id, id)
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider public.provider not null,
  credential_envelope_ciphertext text not null
    check (char_length(credential_envelope_ciphertext) >= 1),
  granted_scopes text[] not null check (
    cardinality(granted_scopes) > 0 and array_position(granted_scopes, null) is null
  ),
  selected_external_account_id text not null
    check (char_length(selected_external_account_id) between 1 and 255),
  selected_external_account_name text not null
    check (char_length(selected_external_account_name) between 1 and 255),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null check (char_length(timezone) between 1 and 100),
  health public.connection_health not null default 'healthy',
  checkpoint jsonb not null default '{}'::jsonb check (jsonb_typeof(checkpoint) = 'object'),
  last_success_at timestamptz,
  next_retry_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, selected_external_account_id),
  unique (tenant_id, id)
);

create table public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  provider public.provider not null,
  provider_external_id text not null check (char_length(provider_external_id) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 255),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null check (char_length(timezone) between 1 and 100),
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, provider_external_id),
  constraint provider_accounts_tenant_connection_fkey
    foreign key (tenant_id, connection_id)
    references public.connections (tenant_id, id)
    on delete cascade
);

create unique index provider_accounts_selected_connection_idx
on public.provider_accounts (tenant_id, connection_id)
where selected;

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  attempt_number smallint not null default 1 check (attempt_number between 1 and 20),
  status public.sync_status not null default 'pending',
  checkpoint_before jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checkpoint_before) = 'object'),
  checkpoint_after jsonb check (checkpoint_after is null or jsonb_typeof(checkpoint_after) = 'object'),
  imported_count integer not null default 0 check (imported_count >= 0),
  published_count integer not null default 0 check (published_count >= 0),
  sanitized_error_code text check (
    sanitized_error_code is null
    or (
      char_length(sanitized_error_code) between 1 and 80
      and sanitized_error_code ~ '^[A-Z0-9_]+$'
    )
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (window_end >= window_start and window_end - window_start <= 31),
  check (completed_at is null or completed_at >= started_at),
  unique (tenant_id, id),
  constraint sync_runs_tenant_connection_fkey
    foreign key (tenant_id, connection_id)
    references public.connections (tenant_id, id)
    on delete cascade
);

create table public.sync_payloads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  payload_ciphertext text not null check (char_length(payload_ciphertext) >= 1),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (expires_at = created_at + interval '7 days'),
  constraint sync_payloads_tenant_sync_run_fkey
    foreign key (tenant_id, sync_run_id)
    references public.sync_runs (tenant_id, id)
    on delete cascade
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  provider_external_id text not null check (char_length(provider_external_id) between 1 and 255),
  name text not null check (char_length(name) between 1 and 255),
  normalized_status text not null default 'unknown'
    check (normalized_status in ('enabled', 'paused', 'removed', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, connection_id, provider_external_id),
  unique (tenant_id, id),
  constraint campaigns_tenant_connection_fkey
    foreign key (tenant_id, connection_id)
    references public.connections (tenant_id, id)
    on delete cascade
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id),
  external_event_id uuid not null,
  status public.lead_status not null default 'new',
  name_ciphertext text not null,
  email_ciphertext text not null,
  email_lookup_hash text not null,
  phone_ciphertext text,
  phone_lookup_hash text,
  company_ciphertext text,
  notes_ciphertext text not null,
  declared_source text not null,
  source_detail text,
  budget_range text not null,
  timeline_range text not null,
  occurred_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  restricted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_event_id),
  unique (tenant_id, id),
  constraint leads_tenant_site_fkey
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict
);

create index leads_tenant_email_lookup_hash_idx
on public.leads (tenant_id, email_lookup_hash);

create index leads_tenant_phone_lookup_hash_idx
on public.leads (tenant_id, phone_lookup_hash)
where phone_lookup_hash is not null;

create table public.ingest_idempotency (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  idempotency_key uuid not null,
  body_digest text not null check (body_digest ~ '^[0-9a-f]{64}$'),
  lead_id uuid not null references public.leads(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (tenant_id, site_id, idempotency_key),
  constraint ingest_idempotency_tenant_site_fkey
    foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete cascade,
  constraint ingest_idempotency_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade
);

create unique index ingest_idempotency_tenant_lead_idx
on public.ingest_idempotency (tenant_id, lead_id);

create table public.attribution_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  occurred_at timestamptz not null,
  declared_source text not null check (char_length(declared_source) between 1 and 80),
  source_detail text check (source_detail is null or char_length(source_detail) <= 200),
  utm_source text check (utm_source is null or char_length(utm_source) <= 200),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 200),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200),
  utm_content text check (utm_content is null or char_length(utm_content) <= 200),
  utm_term text check (utm_term is null or char_length(utm_term) <= 200),
  referrer_domain text check (referrer_domain is null or char_length(referrer_domain) <= 200),
  click_ids jsonb not null default '{}'::jsonb
    check (public.is_allowlisted_click_ids(click_ids)),
  landing_origin text not null check (
    char_length(landing_origin) <= 255 and landing_origin ~ '^https://[^/?#[:space:]]+$'
  ),
  landing_path text not null check (
    char_length(landing_path) between 1 and 500 and landing_path ~ '^/'
  ),
  offer_id text not null check (char_length(offer_id) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint attribution_evidence_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade
);

create table public.attribution_touches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  evidence_id uuid references public.attribution_evidence(id) on delete set null,
  touch_type public.attribution_touch_type not null,
  normalized_source text not null check (char_length(normalized_source) between 1 and 80),
  campaign_id uuid references public.campaigns(id) on delete set null,
  confidence public.attribution_confidence not null,
  state text not null check (state in ('attributed', 'ambiguous', 'unattributed')),
  reason_codes text[] not null default '{}'::text[] check (array_position(reason_codes, null) is null),
  manual_actor uuid references auth.users(id) on delete restrict,
  manual_reason text check (manual_reason is null or char_length(btrim(manual_reason)) between 10 and 500),
  created_at timestamptz not null default now(),
  check (
    (touch_type = 'manual' and manual_actor is not null and manual_reason is not null)
    or
    (touch_type <> 'manual' and manual_actor is null and manual_reason is null)
  ),
  constraint attribution_touches_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade,
  constraint attribution_touches_tenant_evidence_fkey
    foreign key (tenant_id, evidence_id)
    references public.attribution_evidence (tenant_id, id)
    on delete set null (evidence_id),
  constraint attribution_touches_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references public.campaigns (tenant_id, id)
    on delete set null (campaign_id)
);

create table public.revenue_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  confirmed_on date not null,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  note_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, lead_id),
  constraint revenue_outcomes_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade
);

create table public.campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  metric_date date not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  impressions bigint check (impressions is null or impressions >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  sessions bigint check (sessions is null or sessions >= 0),
  engaged_sessions bigint check (engaged_sessions is null or engaged_sessions >= 0),
  users_count bigint check (users_count is null or users_count >= 0),
  spend_minor bigint check (spend_minor is null or spend_minor >= 0),
  provider_conversions numeric(18, 6) check (
    provider_conversions is null or provider_conversions >= 0
  ),
  provider_conversion_value_minor bigint check (
    provider_conversion_value_minor is null or provider_conversion_value_minor >= 0
  ),
  is_complete boolean not null default false,
  source_updated_at timestamptz,
  published_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, connection_id, campaign_id, metric_date),
  constraint campaign_metrics_tenant_connection_fkey
    foreign key (tenant_id, connection_id)
    references public.connections (tenant_id, id)
    on delete cascade,
  constraint campaign_metrics_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references public.campaigns (tenant_id, id)
    on delete cascade
);

create table public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  connection_id uuid references public.connections(id) on delete cascade,
  sync_run_id uuid references public.sync_runs(id) on delete cascade,
  receipt_type text not null check (receipt_type in ('website_lead', 'provider_import')),
  policy_version text not null check (char_length(policy_version) between 1 and 80),
  processing_basis text not null
    check (processing_basis in ('contact_request', 'account_authorization')),
  categories jsonb not null check (jsonb_typeof(categories) = 'object'),
  source text not null check (char_length(source) between 1 and 80),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (receipt_type = 'website_lead' and lead_id is not null
      and connection_id is null and sync_run_id is null)
    or
    (receipt_type = 'provider_import' and lead_id is null
      and connection_id is not null and sync_run_id is not null)
  ),
  constraint consent_receipts_tenant_lead_fkey
    foreign key (tenant_id, lead_id)
    references public.leads (tenant_id, id)
    on delete cascade,
  constraint consent_receipts_tenant_connection_fkey
    foreign key (tenant_id, connection_id)
    references public.connections (tenant_id, id)
    on delete cascade,
  constraint consent_receipts_tenant_sync_run_fkey
    foreign key (tenant_id, sync_run_id)
    references public.sync_runs (tenant_id, id)
    on delete cascade
);

create unique index consent_receipts_website_lead_idx
on public.consent_receipts (tenant_id, lead_id)
where receipt_type = 'website_lead';

create unique index consent_receipts_provider_import_idx
on public.consent_receipts (tenant_id, sync_run_id)
where receipt_type = 'provider_import';

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_type text not null
    check (request_type in ('access', 'correction', 'deletion', 'export', 'opt_out')),
  state public.privacy_request_state not null default 'pending',
  subject_lookup_hmac text not null check (char_length(subject_lookup_hmac) between 32 and 255),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  restricted_at timestamptz,
  completed_at timestamptz,
  sanitized_failure_code text check (
    sanitized_failure_code is null
    or (
      char_length(sanitized_failure_code) between 1 and 80
      and sanitized_failure_code ~ '^[A-Z0-9_]+$'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verified_at is null or verified_at >= requested_at),
  check (restricted_at is null or restricted_at >= requested_at),
  check (completed_at is null or completed_at >= requested_at)
);

create index privacy_requests_tenant_subject_lookup_idx
on public.privacy_requests (tenant_id, subject_lookup_hmac);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('user', 'system')),
  action public.audit_action not null,
  target_type text not null check (
    char_length(target_type) between 1 and 80 and target_type ~ '^[a-z][a-z0-9_]*$'
  ),
  target_id uuid,
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb
    check (public.is_sanitized_audit_metadata(metadata)),
  created_at timestamptz not null default now(),
  check (
    (actor_kind = 'user' and actor_user_id is not null)
    or
    (actor_kind = 'system' and actor_user_id is null)
  )
);

create index memberships_user_tenant_idx on public.memberships (user_id, tenant_id);
create index platform_admins_granted_by_idx on public.platform_admins (granted_by);
create index membership_invitations_invited_by_idx
  on public.membership_invitations (invited_by);
create index support_sessions_admin_tenant_expiry_idx
  on public.support_sessions (admin_user_id, tenant_id, expires_at)
  where revoked_at is null;
create index support_sessions_tenant_idx on public.support_sessions (tenant_id);
create index provider_accounts_connection_idx
  on public.provider_accounts (tenant_id, connection_id);
create index sync_runs_connection_started_idx
  on public.sync_runs (tenant_id, connection_id, started_at desc);
create index sync_payloads_expiry_idx on public.sync_payloads (tenant_id, expires_at);
create index campaigns_connection_idx on public.campaigns (tenant_id, connection_id);
create index leads_tenant_activity_idx on public.leads (tenant_id, last_activity_at);
create index leads_site_idx on public.leads (tenant_id, site_id);
create index attribution_evidence_lead_idx
  on public.attribution_evidence (tenant_id, lead_id, occurred_at);
create index attribution_touches_lead_idx
  on public.attribution_touches (tenant_id, lead_id, touch_type);
create index attribution_touches_evidence_idx
  on public.attribution_touches (tenant_id, evidence_id);
create index attribution_touches_campaign_idx
  on public.attribution_touches (tenant_id, campaign_id);
create index campaign_metrics_tenant_date_idx
  on public.campaign_metrics_daily (tenant_id, metric_date);
create index campaign_metrics_connection_date_idx
  on public.campaign_metrics_daily (tenant_id, connection_id, metric_date);
create index consent_receipts_connection_idx
  on public.consent_receipts (tenant_id, connection_id);
create index audit_events_tenant_created_idx
  on public.audit_events (tenant_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id);
create index privacy_requests_requested_by_idx on public.privacy_requests (requested_by);
create index revenue_outcomes_confirmed_by_idx on public.revenue_outcomes (confirmed_by);
create index attribution_touches_manual_actor_idx on public.attribution_touches (manual_actor);
