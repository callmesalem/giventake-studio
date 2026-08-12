begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'attribution_touches', 'is_manual', 'touches identify manual overlays');
select has_column(
  'public', 'attribution_touches', 'original_computed_touch_id',
  'manual overlays retain their original computed touch'
);
select has_column(
  'public', 'attribution_touches', 'campaign_external_id',
  'touches retain accepted campaign evidence independently of provider rows'
);
select has_function(
  'public', 'apply_attribution_recomputation',
  array['uuid', 'uuid', 'uuid', 'jsonb', 'uuid', 'jsonb', 'uuid'],
  'recomputation and audit use one transaction function'
);
select has_function(
  'public', 'correct_attribution',
  array['uuid', 'uuid', 'uuid', 'text', 'text', 'public.attribution_confidence', 'text', 'uuid'],
  'manual correction and audit use one owner transaction function'
);
select has_function(
  'public', 'get_growth_overview',
  array['uuid', 'date', 'date', 'text'],
  'overview calculations execute inside the tenant database boundary'
);
select has_table(
  'public', 'attribution_recompute_jobs',
  'accepted attribution evidence creates durable retry work'
);
select has_function(
  'public', 'record_attribution_recompute_failure',
  array['uuid', 'uuid', 'uuid'],
  'recomputation failures are recorded through a controlled helper'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-a@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-b@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  );

insert into public.tenants (id, slug, display_name, timezone, currency)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'task7-a', 'Task 7 Tenant A',
    'America/New_York', 'USD'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'task7-b', 'Task 7 Tenant B',
    'America/Los_Angeles', 'USD'
  );

insert into public.memberships (tenant_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client_owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'client_owner');

insert into public.sites (id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://task7-a.example.com', 'task7-site-key-a', 'v1.fixture.secret.a', now()
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'https://task7-b.example.com', 'task7-site-key-b', 'v1.fixture.secret.b', now()
  );

insert into public.leads (
  id, tenant_id, site_id, external_event_id, status,
  name_ciphertext, email_ciphertext, email_lookup_hash, notes_ciphertext,
  declared_source, budget_range, timeline_range, occurred_at
)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'won',
    'v1.fixture.name.a1', 'v1.fixture.email.a1', repeat('a', 64), 'v1.fixture.notes.a1',
    'referral', '5k-10k', '1-2-months', '2026-08-08 18:00:00+00'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000002', 'qualified',
    'v1.fixture.name.a2', 'v1.fixture.email.a2', repeat('b', 64), 'v1.fixture.notes.a2',
    'meta', '5k-10k', '1-2-months', '2026-08-08 19:00:00+00'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000003', 'new',
    'v1.fixture.name.a3', 'v1.fixture.email.a3', repeat('c', 64), 'v1.fixture.notes.a3',
    'direct', '5k-10k', '1-2-months', '2026-08-09 03:30:00+00'
  ),
  (
    'a2000000-0000-0000-0000-000000000004',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000004', 'won',
    'v1.fixture.name.a4', 'v1.fixture.email.a4', repeat('d', 64), 'v1.fixture.notes.a4',
    'google', '5k-10k', '1-2-months', '2026-08-08 20:00:00+00'
  ),
  (
    'b2000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b1000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000001', 'won',
    'v1.fixture.name.b1', 'v1.fixture.email.b1', repeat('e', 64), 'v1.fixture.notes.b1',
    'google', '5k-10k', '1-2-months', '2026-08-08 20:00:00+00'
  );

insert into public.attribution_evidence (
  id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
  landing_origin, landing_path, offer_id
)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001', '2026-08-08 17:55:00+00',
    'referral', '{"gclid":"g-1"}', 'https://task7-a.example.com', '/', 'brief'
  ),
  (
    'a4000000-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001', '2026-08-08 17:59:00+00',
    'google', '{"gclid":"g-2"}', 'https://task7-a.example.com', '/', 'brief'
  ),
  (
    'a4000000-0000-0000-0000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002', '2026-08-08 18:59:00+00',
    'meta', '{"fbclid":"f-1"}', 'https://task7-a.example.com', '/', 'brief'
  ),
  (
    'a4000000-0000-0000-0000-000000000004',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000003', '2026-08-09 03:29:00+00',
    'direct', '{}', 'https://task7-a.example.com', '/', 'brief'
  ),
  (
    'a4000000-0000-0000-0000-000000000005',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000004', '2026-08-08 19:59:00+00',
    'google', '{"gclid":"g-4"}', 'https://task7-a.example.com', '/', 'brief'
  ),
  (
    'b4000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b2000000-0000-0000-0000-000000000001', '2026-08-08 19:59:00+00',
    'google', '{"gclid":"g-b"}', 'https://task7-b.example.com', '/', 'brief'
  );

insert into public.connections (
  id, tenant_id, provider, credential_envelope_ciphertext, granted_scopes,
  selected_external_account_id, selected_external_account_name, currency, timezone,
  health, last_success_at
)
values
  (
    'a5000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'google_ads', 'v1.fixture.credential',
    array['read'], 'account-a', 'Account A', 'USD', 'America/New_York',
    'healthy', '2026-08-09 10:00:00+00'
  ),
  (
    'b5000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'google_ads', 'v1.fixture.credential',
    array['read'], 'account-b', 'Account B', 'USD', 'America/Los_Angeles',
    'healthy', '2026-08-09 10:00:00+00'
  );

insert into public.campaign_metrics_daily (
  tenant_id, connection_id, metric_date, currency, spend_minor,
  provider_conversion_value_minor, is_complete
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a5000000-0000-0000-0000-000000000001', '2026-08-08', 'USD', 100000, 999999, true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a5000000-0000-0000-0000-000000000001', '2026-08-09', 'USD', 900000, 999999, false
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a5000000-0000-0000-0000-000000000001', '2026-08-07', 'USD', 700000, 999999, true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b5000000-0000-0000-0000-000000000001', '2026-08-08', 'USD', 800000, 999999, true
  );

insert into public.revenue_outcomes (
  tenant_id, lead_id, amount_minor, currency, confirmed_on, confirmed_by, superseded_at
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001', 999999, 'USD', '2026-08-08',
    '11111111-1111-1111-1111-111111111111', '2026-08-08 21:00:00+00'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001', 60000, 'USD', '2026-08-08',
    '11111111-1111-1111-1111-111111111111', null
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000004', 300000, 'USD', '2026-08-08',
    '11111111-1111-1111-1111-111111111111', null
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b2000000-0000-0000-0000-000000000001', 888888, 'USD', '2026-08-08',
    '22222222-2222-2222-2222-222222222222', null
  );

select is(
  (select status from public.attribution_recompute_jobs
   where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and lead_id = 'a2000000-0000-0000-0000-000000000001'),
  'pending',
  'accepted evidence durably queues recomputation before the immediate attempt'
);

set local role service_role;

select is(
  public.apply_attribution_recomputation(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"medium","state":"ambiguous","reason_codes":["declared_source:referral","click_id:gclid"]}',
    'a4000000-0000-0000-0000-000000000002',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:google_ads"]}',
    'a6000000-0000-0000-0000-000000000001'
  ) ->> 'changed',
  'true',
  'first recomputation appends deterministic first and last touches'
);
select is(
  (select count(*)::integer from public.attribution_touches
   where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and lead_id = 'a2000000-0000-0000-0000-000000000001'
     and touch_type in ('first', 'last')),
  2,
  'recomputation stores both selected models'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id = 'a6000000-0000-0000-0000-000000000001'
     and action = 'attribution.recomputed'),
  2,
  'each changed visible model is audited atomically'
);
select is(
  (select status from public.attribution_recompute_jobs
   where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and lead_id = 'a2000000-0000-0000-0000-000000000001'),
  'succeeded',
  'successful recomputation completes its durable retry work'
);
select ok(
  not exists (
    select 1 from public.audit_events
    where request_id = 'a6000000-0000-0000-0000-000000000001'
      and metadata::text ~* '(email|phone|name|note|click-id-value|g-1|g-2)'
  ),
  'recomputation audit metadata contains no contact or raw evidence values'
);
select is(
  public.apply_attribution_recomputation(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"medium","state":"ambiguous","reason_codes":["declared_source:referral","click_id:gclid"]}',
    'a4000000-0000-0000-0000-000000000002',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:google_ads"]}',
    'a6000000-0000-0000-0000-000000000002'
  ) ->> 'changed',
  'false',
  'identical recomputation is idempotent'
);
select is(
  (select count(*)::integer from public.attribution_touches
   where lead_id = 'a2000000-0000-0000-0000-000000000001'
     and touch_type in ('first', 'last')),
  2,
  'idempotent recomputation appends no duplicate history'
);
select is(
  public.apply_attribution_recomputation(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b2000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
    'b4000000-0000-0000-0000-000000000001',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
    'a6000000-0000-0000-0000-000000000003'
  ) ->> 'found',
  'false',
  'cross-tenant recomputation is indistinguishable from unknown'
);

select public.apply_attribution_recomputation(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a2000000-0000-0000-0000-000000000002',
  'a4000000-0000-0000-0000-000000000003',
  '{"source":"meta_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:fbclid"]}',
  'a4000000-0000-0000-0000-000000000003',
  '{"source":"meta_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:fbclid"]}',
  'a6000000-0000-0000-0000-000000000004'
);
select public.apply_attribution_recomputation(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a2000000-0000-0000-0000-000000000003',
  'a4000000-0000-0000-0000-000000000004',
  '{"source":null,"campaign_external_id":null,"confidence":"low","state":"unattributed","reason_codes":["direct_or_unknown"]}',
  'a4000000-0000-0000-0000-000000000004',
  '{"source":null,"campaign_external_id":null,"confidence":"low","state":"unattributed","reason_codes":["direct_or_unknown"]}',
  'a6000000-0000-0000-0000-000000000005'
);
select ok(
  public.record_attribution_recompute_failure(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000004',
    'a6000000-0000-0000-0000-000000000099'
  ),
  'a failed immediate recomputation records durable retry state'
);
select results_eq(
  $$ select status, sanitized_failure_code, last_request_id::text
     from public.attribution_recompute_jobs
     where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and lead_id = 'a2000000-0000-0000-0000-000000000004' $$,
  $$ values (
       'failed'::text,
       'RECOMPUTE_FAILED'::text,
       'a6000000-0000-0000-0000-000000000099'::text
     ) $$,
  'retry observability stores only canonical identifiers and a fixed failure code'
);
select public.apply_attribution_recomputation(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a2000000-0000-0000-0000-000000000004',
  'a4000000-0000-0000-0000-000000000005',
  '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
  'a4000000-0000-0000-0000-000000000005',
  '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
  'a6000000-0000-0000-0000-000000000006'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.headers', '{}', true);

select throws_ok(
  $$ insert into public.attribution_touches (
       tenant_id, lead_id, touch_type, normalized_source, confidence, state
     ) values (
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'a2000000-0000-0000-0000-000000000001',
       'first', 'forged', 'high', 'attributed'
     ) $$,
  '42501', null,
  'owners cannot forge attribution history directly'
);
select throws_ok(
  $$ update public.attribution_touches set normalized_source = 'forged'
     where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501', null,
  'owners cannot overwrite computed attribution history'
);
select throws_ok(
  $$ delete from public.attribution_touches
     where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501', null,
  'owners cannot delete attribution history'
);

select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,spend_minor}',
  '100000',
  'overview sums only complete metric rows inside the date range'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,confirmed_revenue_minor}',
  '360000',
  'overview uses only current human-confirmed revenue outcomes'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,paid_revenue_minor}',
  '300000',
  'first-touch paid revenue excludes ambiguous referral revenue'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'last_touch'
  ) #>> '{facts,paid_revenue_minor}',
  '360000',
  'last-touch paid revenue follows the selected deterministic model'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,total_leads}',
  '4',
  'tenant timezone includes the lead that is still on the prior local date'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,ambiguous_leads}',
  '1',
  'ambiguous first-touch leads remain visible'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,unattributed_leads}',
  '1',
  'unattributed leads remain visible'
);
select ok(
  jsonb_typeof(
    public.get_growth_overview(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
    ) #> '{facts,confirmed_revenue_minor}'
  ) = 'string',
  'overview bigint amounts cross RPC as JSON strings'
);
select is(
  public.get_growth_overview(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-08-08', '2026-08-08', 'first_touch'
  ),
  null::jsonb,
  'cross-tenant overview is indistinguishable from unavailable'
);

reset role;
insert into public.connections (
  id, tenant_id, provider, credential_envelope_ciphertext, granted_scopes,
  selected_external_account_id, selected_external_account_name, currency, timezone,
  health, last_success_at
) values (
  'a5000000-0000-0000-0000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'meta_ads', 'v1.fixture.credential.meta',
  array['read'], 'account-meta-a', 'Meta Account A', 'EUR', 'America/New_York',
  'healthy', '2026-08-09 11:00:00+00'
);
insert into public.campaign_metrics_daily (
  tenant_id, connection_id, metric_date, currency, spend_minor, is_complete
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'a5000000-0000-0000-0000-000000000002', '2026-08-08', 'EUR', 50000, true
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,spend_minor}',
  null,
  'mixed paid-provider currencies fail closed instead of returning partial spend'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,confirmed_revenue_minor}',
  '360000',
  'mixed paid-provider currencies preserve confirmed revenue'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,total_leads}',
  '4',
  'mixed paid-provider currencies preserve lead totals'
);
select is(
  (
    select item ->> 'state'
    from jsonb_array_elements(public.get_growth_overview(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
    ) -> 'freshness') item
    where item ->> 'provider' = 'meta_ads'
  ),
  'stale',
  'unsafe paid-provider currency coverage cannot appear fresh'
);

select is(
  public.correct_attribution(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    (
      select id from public.attribution_touches
      where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        and lead_id = 'a2000000-0000-0000-0000-000000000001'
        and touch_type = 'first'
      order by created_at desc, id desc limit 1
    ),
    'google_ads', null, 'high',
    'Customer confirmed the paid Google source.',
    'a6000000-0000-0000-0000-000000000007'
  ) #>> '{correction,source}',
  'google_ads',
  'manual correction returns the effective overlay'
);
select ok(
  exists (
    select 1 from public.attribution_touches manual
    join public.attribution_touches original
      on original.tenant_id = manual.tenant_id
     and original.id = manual.original_computed_touch_id
    where manual.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and manual.lead_id = 'a2000000-0000-0000-0000-000000000001'
      and manual.is_manual
      and manual.touch_type = 'manual'
      and original.touch_type = 'first'
  ),
  'manual correction is a separate row linked to its original computation'
);
select is(
  (select count(*)::integer from public.attribution_evidence
   where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and lead_id = 'a2000000-0000-0000-0000-000000000001'),
  2,
  'manual correction never overwrites or deletes source evidence'
);
select is(
  (select action::text from public.audit_events
   where request_id = 'a6000000-0000-0000-0000-000000000007'),
  'attribution.corrected',
  'manual correction is audited in the same transaction'
);
select ok(
  not exists (
    select 1 from public.audit_events
    where request_id = 'a6000000-0000-0000-0000-000000000007'
      and (
        metadata::text ~* 'customer confirmed the paid google source'
        or metadata ?| array['email', 'phone', 'name', 'note', 'reason']
      )
  ),
  'manual reason and contact fields never enter correction audit metadata'
);
select is(
  public.get_lead_attribution(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001'
  ) #>> '{first_touch,original,source}',
  'referral',
  'attribution view preserves the original computed result'
);
select is(
  public.get_lead_attribution(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001'
  ) #>> '{first_touch,correction,source}',
  'google_ads',
  'attribution view displays the manual correction alongside the original'
);
select is(
  public.get_growth_overview(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-08', '2026-08-08', 'first_touch'
  ) #>> '{facts,paid_revenue_minor}',
  '360000',
  'ROI uses the current manual overlay without losing computed history'
);
select is(
  public.correct_attribution(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b2000000-0000-0000-0000-000000000001',
    gen_random_uuid(), 'google_ads', null, 'high',
    'This must not cross the tenant boundary.',
    'a6000000-0000-0000-0000-000000000008'
  ),
  null::jsonb,
  'cross-tenant correction is indistinguishable from unknown'
);

select throws_ok(
  $$ select public.get_growth_overview(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-08-09', '2026-08-08', 'first_touch'
     ) $$,
  '22023', 'invalid overview date range',
  'overview rejects reversed date ranges'
);
select throws_ok(
  $$ select public.correct_attribution(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'a2000000-0000-0000-0000-000000000001',
       (select id from public.attribution_touches where touch_type = 'first' limit 1),
       'google_ads', null, 'high', 'short', gen_random_uuid()
     ) $$,
  '22023', 'correction reason must be 10-500 characters',
  'manual correction requires a bounded reason'
);

reset role;
select ok(
  not has_table_privilege('service_role', 'public.attribution_touches', 'INSERT')
    and not has_table_privilege('service_role', 'public.attribution_touches', 'UPDATE')
    and not has_table_privilege('service_role', 'public.attribution_touches', 'DELETE'),
  'service role has no direct attribution history write privileges'
);
select throws_ok(
  $$ insert into public.attribution_touches (
       tenant_id, lead_id, evidence_id, touch_type, normalized_source,
       confidence, state, reason_codes, manual_actor, manual_reason,
       original_computed_touch_id
     ) values (
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'a2000000-0000-0000-0000-000000000002',
       'a4000000-0000-0000-0000-000000000003',
       'manual', 'google_ads', 'high', 'attributed', array['manual_correction'],
       '11111111-1111-1111-1111-111111111111', 'Detached correction reason.', null
     ) $$,
  '23514', null,
  'manual history cannot exist without an original computed touch'
);
select throws_ok(
  $$ insert into public.attribution_touches (
       tenant_id, lead_id, evidence_id, touch_type, normalized_source,
       confidence, state, reason_codes, manual_actor, manual_reason,
       original_computed_touch_id
     ) values (
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'a2000000-0000-0000-0000-000000000002',
       'a4000000-0000-0000-0000-000000000003',
       'manual', 'google_ads', 'high', 'attributed', array['manual_correction'],
       '11111111-1111-1111-1111-111111111111', 'Wrong lead correction reason.',
       (select id from public.attribution_touches
        where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
          and lead_id = 'a2000000-0000-0000-0000-000000000001'
          and touch_type = 'first' order by created_at desc, id desc limit 1)
     ) $$,
  '23514', null,
  'manual history must reference a computed touch for the same lead and model'
);
select throws_ok(
  $$ update public.attribution_touches set normalized_source = 'forged'
     where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and touch_type = 'first' $$,
  '42501', null,
  'the database boundary rejects attribution history updates even for the table owner'
);
select throws_ok(
  $$ delete from public.attribution_touches
     where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and touch_type = 'first' $$,
  '42501', null,
  'the database boundary rejects attribution history deletes even for the table owner'
);

select * from finish();
rollback;
