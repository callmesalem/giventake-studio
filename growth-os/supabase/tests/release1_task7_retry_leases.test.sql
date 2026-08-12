begin;
select no_plan();

insert into public.tenants (id, slug, display_name, timezone, currency) values
  ('e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lease-a', 'Lease A', 'UTC', 'USD'),
  ('f1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'lease-b', 'Lease B', 'UTC', 'USD');

insert into public.sites (
  id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
) values
  (
    'e1100000-0000-4000-8000-000000000001',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://lease-a.example.com', 'lease-a-key', 'v1.fixture.secret', now()
  ),
  (
    'f1100000-0000-4000-8000-000000000001',
    'f1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'https://lease-b.example.com', 'lease-b-key', 'v1.fixture.secret', now()
  );

insert into public.leads (
  id, tenant_id, site_id, external_event_id, name_ciphertext, email_ciphertext,
  email_lookup_hash, notes_ciphertext, declared_source, budget_range, timeline_range,
  occurred_at, last_activity_at
) values
  (
    'e1200000-0000-4000-8000-000000000001',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000001',
    'v1.fixture.name', 'v1.fixture.email', repeat('1', 64), 'v1.fixture.notes',
    'referral', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  ),
  (
    'e1200000-0000-4000-8000-000000000002',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000002',
    'v1.fixture.name', 'v1.fixture.email', repeat('2', 64), 'v1.fixture.notes',
    'referral', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  ),
  (
    'e1200000-0000-4000-8000-000000000003',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1100000-0000-4000-8000-000000000001',
    'e1300000-0000-4000-8000-000000000003',
    'v1.fixture.name', 'v1.fixture.email', repeat('3', 64), 'v1.fixture.notes',
    'referral', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  ),
  (
    'f1200000-0000-4000-8000-000000000001',
    'f1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'f1100000-0000-4000-8000-000000000001',
    'f1300000-0000-4000-8000-000000000001',
    'v1.fixture.name', 'v1.fixture.email', repeat('4', 64), 'v1.fixture.notes',
    'google', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  );

insert into public.attribution_evidence (
  id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
  landing_origin, landing_path, offer_id
) values
  (
    'e1400000-0000-4000-8000-000000000001',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000001',
    '2026-08-09 14:00:00+00', 'referral', '{}'::jsonb,
    'https://lease-a.example.com', '/', 'brief'
  ),
  (
    'e1400000-0000-4000-8000-000000000002',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000002',
    '2026-08-09 14:00:00+00', 'referral', '{}'::jsonb,
    'https://lease-a.example.com', '/', 'brief'
  ),
  (
    'e1400000-0000-4000-8000-000000000003',
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    '2026-08-09 14:00:00+00', 'referral', '{}'::jsonb,
    'https://lease-a.example.com', '/', 'brief'
  ),
  (
    'f1400000-0000-4000-8000-000000000001',
    'f1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'f1200000-0000-4000-8000-000000000001',
    '2026-08-09 14:00:00+00', 'google', '{"gclid":"lease-b-click"}'::jsonb,
    'https://lease-b.example.com', '/', 'brief'
  );

create temp table lease_claims (label text primary key, payload jsonb);
grant select, insert on lease_claims to service_role;

set local role service_role;
insert into lease_claims values
  (
    'expired-apply',
    public.claim_attribution_recompute_job(
      'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1200000-0000-4000-8000-000000000001',
      transaction_timestamp() - interval '5 minutes'
    )
  ),
  (
    'expired-failure',
    public.claim_attribution_recompute_job(
      'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1200000-0000-4000-8000-000000000002',
      transaction_timestamp() - interval '5 minutes'
    )
  ),
  (
    'valid-a',
    public.claim_attribution_recompute_job(
      'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1200000-0000-4000-8000-000000000003',
      transaction_timestamp()
    )
  ),
  (
    'valid-b',
    public.claim_attribution_recompute_job(
      'f1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'f1200000-0000-4000-8000-000000000001',
      transaction_timestamp()
    )
  );
reset role;

select is(
  public.apply_attribution_recomputation(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000001',
    (select (payload ->> 'generation')::bigint from lease_claims where label = 'expired-apply'),
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'expired-apply'),
    'e1400000-0000-4000-8000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1400000-0000-4000-8000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1500000-0000-4000-8000-000000000001'
  ) ->> 'stale',
  'true',
  'a lease equal to transaction time is expired and cannot authorize apply'
);
select is(
  (select count(*)::integer from public.attribution_touches
   where tenant_id = 'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and lead_id = 'e1200000-0000-4000-8000-000000000001'),
  0,
  'expired apply appends no attribution history'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id = 'e1500000-0000-4000-8000-000000000001'),
  0,
  'expired apply writes no recomputation audit'
);
select results_eq(
  $$ select status, claim_token::text, lease_expires_at
     from public.attribution_recompute_jobs
     where tenant_id = 'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'e1200000-0000-4000-8000-000000000001' $$,
  $$ select
       'processing'::text,
       payload ->> 'claim_token',
       transaction_timestamp()
     from lease_claims where label = 'expired-apply' $$,
  'expired apply leaves the job row unchanged'
);

select is(
  public.record_attribution_recompute_failure(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000002',
    (select (payload ->> 'generation')::bigint from lease_claims where label = 'expired-failure'),
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'expired-failure'),
    'e1500000-0000-4000-8000-000000000002',
    transaction_timestamp()
  ) ->> 'status',
  'stale',
  'an equality-expired lease cannot authorize failure recording'
);
select results_eq(
  $$ select status, claim_token::text, lease_expires_at
     from public.attribution_recompute_jobs
     where tenant_id = 'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'e1200000-0000-4000-8000-000000000002' $$,
  $$ select
       'processing'::text,
       payload ->> 'claim_token',
       transaction_timestamp()
     from lease_claims where label = 'expired-failure' $$,
  'expired failure recording leaves the job row unchanged'
);

select lives_ok(
  $$ select public.apply_attribution_recomputation(
       'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'e1200000-0000-4000-8000-000000000003',
       1, null,
       'e1400000-0000-4000-8000-000000000003',
       '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
       'e1400000-0000-4000-8000-000000000003',
       '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
       'e1500000-0000-4000-8000-000000000003'
     ) $$,
  'a null apply token is a no-op rather than an error'
);
select lives_ok(
  $$ select public.record_attribution_recompute_failure(
       'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'e1200000-0000-4000-8000-000000000003',
       1, null, 'e1500000-0000-4000-8000-000000000004', transaction_timestamp()
     ) $$,
  'a null failure token is a no-op rather than an error'
);
select is(
  public.apply_attribution_recomputation(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    1, 'e1600000-0000-4000-8000-000000000099',
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1500000-0000-4000-8000-000000000005'
  ) ->> 'stale',
  'true',
  'a stolen apply token is a no-op'
);
select is(
  public.record_attribution_recompute_failure(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    2,
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'valid-a'),
    'e1500000-0000-4000-8000-000000000006',
    transaction_timestamp()
  ) ->> 'status',
  'stale',
  'a stale generation is a no-op'
);
select is(
  public.apply_attribution_recomputation(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    (select (payload ->> 'generation')::bigint from lease_claims where label = 'valid-b'),
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'valid-b'),
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1500000-0000-4000-8000-000000000007'
  ) ->> 'stale',
  'true',
  'a cross-tenant claim token is a no-op'
);

select is(
  public.apply_attribution_recomputation(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    (select (payload ->> 'generation')::bigint from lease_claims where label = 'valid-a'),
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'valid-a'),
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1500000-0000-4000-8000-000000000008'
  ) ->> 'completed',
  'true',
  'a matching unexpired lease authorizes one apply'
);
select is(
  public.apply_attribution_recomputation(
    'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'e1200000-0000-4000-8000-000000000003',
    (select (payload ->> 'generation')::bigint from lease_claims where label = 'valid-a'),
    (select (payload ->> 'claim_token')::uuid from lease_claims where label = 'valid-a'),
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1400000-0000-4000-8000-000000000003',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'e1500000-0000-4000-8000-000000000009'
  ) ->> 'stale',
  'true',
  'a repeated completed token is a no-op'
);
select is(
  (select count(*)::integer from public.attribution_touches
   where tenant_id = 'e1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and lead_id = 'e1200000-0000-4000-8000-000000000003'),
  2,
  'invalid and repeated tokens append no extra touch history'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id in (
     'e1500000-0000-4000-8000-000000000003',
     'e1500000-0000-4000-8000-000000000004',
     'e1500000-0000-4000-8000-000000000005',
     'e1500000-0000-4000-8000-000000000006',
     'e1500000-0000-4000-8000-000000000007',
     'e1500000-0000-4000-8000-000000000009'
   )),
  0,
  'invalid and repeated tokens write no audit events'
);
select is(
  has_function_privilege(
    'service_role',
    'private.apply_claimed_attribution_recomputation(uuid,uuid,bigint,uuid,uuid,jsonb,uuid,jsonb,uuid)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass apply lease authorization through the private helper'
);
select is(
  has_function_privilege(
    'service_role',
    'private.complete_claimed_attribution_recompute_failure(uuid,uuid,bigint,uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass failure lease authorization through the private helper'
);

reset role;
select * from finish();
rollback;
