begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'retention-owner@example.test',
  crypt('retention-owner-password', gen_salt('bf')),
  '2026-06-01T12:00:00Z',
  '{"provider":"email","providers":["email"]}',
  '{}',
  '2026-06-01T12:00:00Z',
  '2026-06-01T12:00:00Z'
);

insert into public.tenants (
  id,
  slug,
  display_name,
  timezone,
  lead_retention_months
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'retention-tenant',
  'Retention Tenant',
  'America/New_York',
  1
);

insert into public.memberships (tenant_id, user_id, role)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'client_owner'
);

insert into public.sites (
  id,
  tenant_id,
  origin,
  key_id,
  signing_secret_ciphertext,
  verified_at
)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'https://retention.example.test',
  'retention-site-key',
  'retention-site-secret-ciphertext',
  '2026-06-01T12:00:00Z'
);

insert into public.connections (
  id,
  tenant_id,
  provider,
  credential_envelope_ciphertext,
  granted_scopes,
  selected_external_account_id,
  selected_external_account_name,
  currency,
  timezone
)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'google_ads',
  'provider-credential-ciphertext',
  array['read'],
  'provider-account',
  'Provider Account',
  'USD',
  'America/New_York'
);

insert into public.sync_runs (
  id,
  tenant_id,
  connection_id,
  window_start,
  window_end,
  status,
  started_at,
  completed_at
)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000002',
  '2026-06-01',
  '2026-06-30',
  'succeeded',
  '2026-07-01T12:00:00Z',
  '2026-07-01T12:01:00Z'
);

insert into public.consent_receipts (
  tenant_id,
  connection_id,
  sync_run_id,
  receipt_type,
  policy_version,
  processing_basis,
  categories,
  source,
  recorded_at
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
  'provider_import',
  'privacy-2026-08-09',
  'account_authorization',
  '{"granted_scopes":["read"],"provider":"google_ads"}',
  'google_ads',
  '2026-07-01T12:01:00Z'
);

insert into public.leads (
  id,
  tenant_id,
  site_id,
  external_event_id,
  name_ciphertext,
  email_ciphertext,
  email_lookup_hash,
  notes_ciphertext,
  declared_source,
  budget_range,
  timeline_range,
  occurred_at,
  last_activity_at,
  created_at,
  updated_at
)
select
  md5('retention-lead-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000001',
  md5('retention-event-' || series)::uuid,
  'name-ciphertext-' || series,
  'email-ciphertext-' || series,
  encode(sha256(('retention-email-' || series)::bytea), 'hex'),
  'notes-ciphertext-' || series,
  'google',
  '5k-10k',
  '1-2-months',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.ingest_idempotency (
  tenant_id,
  site_id,
  idempotency_key,
  body_digest,
  lead_id,
  accepted_at
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000001',
  md5('retention-idempotency-' || series)::uuid,
  encode(sha256(('retention-body-' || series)::bytea), 'hex'),
  md5('retention-lead-' || series)::uuid,
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.attribution_evidence (
  id,
  tenant_id,
  lead_id,
  occurred_at,
  declared_source,
  click_ids,
  landing_origin,
  landing_path,
  offer_id,
  created_at
)
select
  md5('retention-evidence-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  md5('retention-lead-' || series)::uuid,
  '2026-06-15T12:00:00Z',
  'google',
  '{}'::jsonb,
  'https://retention.example.test',
  '/contact',
  'retention-offer',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.attribution_touches (
  id,
  tenant_id,
  lead_id,
  evidence_id,
  touch_type,
  normalized_source,
  confidence,
  state,
  created_at
)
select
  md5('retention-touch-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  md5('retention-lead-' || series)::uuid,
  md5('retention-evidence-' || series)::uuid,
  'unresolved',
  'google',
  'medium',
  'attributed',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.revenue_outcomes (
  id,
  tenant_id,
  lead_id,
  amount_minor,
  currency,
  confirmed_on,
  confirmed_by,
  created_at,
  updated_at
)
select
  md5('retention-revenue-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  md5('retention-lead-' || series)::uuid,
  10000,
  'USD',
  '2026-06-15',
  '11111111-1111-1111-1111-111111111111',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.consent_receipts (
  id,
  tenant_id,
  lead_id,
  receipt_type,
  policy_version,
  processing_basis,
  categories,
  source,
  recorded_at,
  created_at
)
select
  md5('retention-consent-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  md5('retention-lead-' || series)::uuid,
  'website_lead',
  'privacy-2026-08-09',
  'contact_request',
  '{"necessary":true,"analytics":false,"marketing":false,"preferences":false}',
  'contact-form',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

select lives_ok(
  $$ set constraints all immediate $$,
  'accepted lead consent invariant accepts one website receipt per lead'
);
set constraints all deferred;

insert into public.leads (
  id,
  tenant_id,
  site_id,
  external_event_id,
  name_ciphertext,
  email_ciphertext,
  email_lookup_hash,
  notes_ciphertext,
  declared_source,
  budget_range,
  timeline_range,
  occurred_at
)
values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'orphan-name-ciphertext',
  'orphan-email-ciphertext',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'orphan-notes-ciphertext',
  'direct',
  'unknown',
  'unknown',
  '2026-08-09T12:00:00Z'
);

select throws_ok(
  $$ set constraints all immediate $$,
  '23514',
  null,
  'accepted lead without a website receipt violates the deferred invariant'
);
delete from public.leads where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
set constraints all deferred;

select is(
  (
    select count(*)
    from public.leads lead
    where (
      select count(*)
      from public.consent_receipts receipt
      where receipt.tenant_id = lead.tenant_id
        and receipt.lead_id = lead.id
        and receipt.receipt_type = 'website_lead'
    ) <> 1
  )::bigint,
  0::bigint,
  'every accepted lead has exactly one website lead receipt'
);

select is(
  (
    select count(*)
    from public.consent_receipts
    where receipt_type = 'provider_import'
  )::bigint,
  1::bigint,
  'provider sync retains its provider import consent receipt'
);

create temporary table retention_results (
  run_number integer primary key,
  result jsonb not null
) on commit drop;

insert into retention_results (run_number, result)
values (
  1,
  public.run_retention_cleanup(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T12:00:00Z'
  )
);

select results_eq(
  $$
    select
      (result ->> 'attributionEvidenceDeleted')::integer,
      (result ->> 'attributionTouchesDeleted')::integer,
      (result ->> 'consentReceiptsDeleted')::integer,
      (result ->> 'revenueOutcomesDeleted')::integer,
      (result ->> 'ingestIdempotencyDeleted')::integer,
      (result ->> 'leadsDeleted')::integer
    from retention_results where run_number = 1
  $$,
  $$ values (500, 500, 500, 500, 500, 500) $$,
  'first cleanup independently caps every lead-owned table at 500 rows'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.leads),
      (select count(*)::integer from public.attribution_evidence),
      (select count(*)::integer from public.attribution_touches),
      (select count(*)::integer from public.consent_receipts where receipt_type = 'website_lead'),
      (select count(*)::integer from public.revenue_outcomes),
      (select count(*)::integer from public.ingest_idempotency)
  $$,
  $$ values (1, 1, 1, 1, 1, 1) $$,
  'first cleanup leaves one complete lead tree for the next bounded pass'
);

select ok(
  (select (result ->> 'hasMore')::boolean from retention_results where run_number = 1),
  'first cleanup reports actionable remaining work'
);

insert into retention_results (run_number, result)
values (
  2,
  public.run_retention_cleanup(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T12:00:00Z'
  )
);

select results_eq(
  $$
    select
      (result ->> 'attributionEvidenceDeleted')::integer,
      (result ->> 'attributionTouchesDeleted')::integer,
      (result ->> 'consentReceiptsDeleted')::integer,
      (result ->> 'revenueOutcomesDeleted')::integer,
      (result ->> 'ingestIdempotencyDeleted')::integer,
      (result ->> 'leadsDeleted')::integer
    from retention_results where run_number = 2
  $$,
  $$ values (1, 1, 1, 1, 1, 1) $$,
  'second cleanup drains the final lead tree'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.leads),
      (select count(*)::integer from public.attribution_evidence),
      (select count(*)::integer from public.attribution_touches),
      (select count(*)::integer from public.consent_receipts where receipt_type = 'website_lead'),
      (select count(*)::integer from public.revenue_outcomes),
      (select count(*)::integer from public.ingest_idempotency)
  $$,
  $$ values (0, 0, 0, 0, 0, 0) $$,
  'one-month retention removes evidence younger than thirteen months with its lead'
);

select is(
  (
    select count(*)
    from public.consent_receipts
    where receipt_type = 'provider_import'
  )::bigint,
  1::bigint,
  'lead cleanup does not remove provider import consent receipts'
);

select isnt(
  (select (result ->> 'hasMore')::boolean from retention_results where run_number = 2),
  true,
  'second cleanup terminates after all actionable work is drained'
);

insert into retention_results (run_number, result)
values (
  3,
  public.run_retention_cleanup(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T12:00:00Z'
  )
);

select results_eq(
  $$
    select
      (result ->> 'attributionEvidenceDeleted')::integer,
      (result ->> 'attributionTouchesDeleted')::integer,
      (result ->> 'consentReceiptsDeleted')::integer,
      (result ->> 'revenueOutcomesDeleted')::integer,
      (result ->> 'ingestIdempotencyDeleted')::integer,
      (result ->> 'leadsDeleted')::integer
    from retention_results where run_number = 3
  $$,
  $$ values (0, 0, 0, 0, 0, 0) $$,
  'repeat cleanup performs no impossible lead work'
);

select isnt(
  (select (result ->> 'hasMore')::boolean from retention_results where run_number = 3),
  true,
  'repeat cleanup keeps has more false'
);

select is(
  (
    select count(*)
    from public.audit_events
    where action = 'retention.completed'
  )::bigint,
  3::bigint,
  'each cleanup pass writes one aggregate retention audit event'
);

insert into public.leads (
  id,
  tenant_id,
  site_id,
  external_event_id,
  name_ciphertext,
  email_ciphertext,
  email_lookup_hash,
  notes_ciphertext,
  declared_source,
  budget_range,
  timeline_range,
  occurred_at,
  last_activity_at
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'dddddddd-eeee-eeee-eeee-eeeeeeeeeeee',
  'dense-name-ciphertext',
  'dense-email-ciphertext',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  'dense-notes-ciphertext',
  'google',
  '5k-10k',
  '1-2-months',
  '2026-06-15T12:00:00Z',
  '2026-06-15T12:00:00Z'
);

insert into public.ingest_idempotency (
  tenant_id,
  site_id,
  idempotency_key,
  body_digest,
  lead_id,
  accepted_at
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000001',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '2026-06-15T12:00:00Z'
);

insert into public.attribution_evidence (
  id,
  tenant_id,
  lead_id,
  occurred_at,
  declared_source,
  click_ids,
  landing_origin,
  landing_path,
  offer_id,
  created_at
)
select
  md5('dense-evidence-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '2026-06-15T12:00:00Z',
  'google',
  '{}'::jsonb,
  'https://retention.example.test',
  '/contact',
  'retention-offer',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.attribution_touches (
  id,
  tenant_id,
  lead_id,
  evidence_id,
  touch_type,
  normalized_source,
  confidence,
  state,
  created_at
)
select
  md5('dense-touch-' || series)::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  md5('dense-evidence-' || series)::uuid,
  'unresolved',
  'google',
  'medium',
  'attributed',
  '2026-06-15T12:00:00Z'
from generate_series(1, 501) series;

insert into public.revenue_outcomes (
  tenant_id,
  lead_id,
  amount_minor,
  currency,
  confirmed_on,
  confirmed_by
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  10000,
  'USD',
  '2026-06-15',
  '11111111-1111-1111-1111-111111111111'
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'website_lead',
  'privacy-2026-08-09',
  'contact_request',
  '{"necessary":true,"analytics":false,"marketing":false,"preferences":false}',
  'contact-form',
  '2026-06-15T12:00:00Z'
);

set constraints all immediate;
set constraints all deferred;

insert into retention_results (run_number, result)
values (
  4,
  public.run_retention_cleanup(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T12:00:00Z'
  )
);

select results_eq(
  $$
    select
      (result ->> 'attributionEvidenceDeleted')::integer,
      (result ->> 'attributionTouchesDeleted')::integer,
      (result ->> 'consentReceiptsDeleted')::integer,
      (result ->> 'revenueOutcomesDeleted')::integer,
      (result ->> 'ingestIdempotencyDeleted')::integer,
      (result ->> 'leadsDeleted')::integer
    from retention_results where run_number = 4
  $$,
  $$ values (500, 500, 0, 0, 0, 0) $$,
  'dense lead first pass drains only independently bounded evidence and touches'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.leads),
      (select count(*)::integer from public.attribution_evidence),
      (select count(*)::integer from public.attribution_touches),
      (select count(*)::integer from public.consent_receipts where receipt_type = 'website_lead'),
      (select count(*)::integer from public.revenue_outcomes),
      (select count(*)::integer from public.ingest_idempotency)
  $$,
  $$ values (1, 1, 1, 1, 1, 1) $$,
  'dense lead keeps terminal children until evidence and touches are drained'
);

select lives_ok(
  $$ set constraints all immediate $$,
  'intermediate dense lead remains consent complete'
);
set constraints all deferred;

insert into retention_results (run_number, result)
values (
  5,
  public.run_retention_cleanup(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T12:00:00Z'
  )
);

select results_eq(
  $$
    select
      (result ->> 'attributionEvidenceDeleted')::integer,
      (result ->> 'attributionTouchesDeleted')::integer,
      (result ->> 'consentReceiptsDeleted')::integer,
      (result ->> 'revenueOutcomesDeleted')::integer,
      (result ->> 'ingestIdempotencyDeleted')::integer,
      (result ->> 'leadsDeleted')::integer,
      (result ->> 'hasMore')::boolean
    from retention_results where run_number = 5
  $$,
  $$ values (1, 1, 1, 1, 1, 1, false) $$,
  'dense lead final pass drains terminal children and then deletes the parent'
);

select results_eq(
  $$
    select
      (select count(*)::integer from public.leads),
      (select count(*)::integer from public.attribution_evidence),
      (select count(*)::integer from public.attribution_touches),
      (select count(*)::integer from public.consent_receipts where receipt_type = 'website_lead'),
      (select count(*)::integer from public.revenue_outcomes),
      (select count(*)::integer from public.ingest_idempotency)
  $$,
  $$ values (0, 0, 0, 0, 0, 0) $$,
  'dense lead cleanup terminates with no dependent rows'
);

select * from finish();
rollback;
