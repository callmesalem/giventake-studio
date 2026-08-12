begin;
select no_plan();

select has_column(
  'public', 'attribution_recompute_jobs', 'generation',
  'attribution retry work carries a monotonic generation'
);
select has_column(
  'public', 'attribution_recompute_jobs', 'claim_token',
  'attribution retry work carries an opaque claim token'
);
select has_function(
  'public', 'claim_attribution_recompute_job', array['uuid', 'uuid', 'timestamp with time zone'],
  'immediate recomputation uses a controlled exact-job claim'
);
select has_function(
  'public', 'claim_attribution_recompute_jobs', array['integer', 'timestamp with time zone'],
  'workers use a bounded atomic batch claim'
);
select ok(
  not has_table_privilege('service_role', 'public.attribution_recompute_jobs', 'SELECT'),
  'service role cannot browse arbitrary attribution retry jobs'
);

insert into public.tenants (id, slug, display_name, timezone, currency) values
  ('a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'retry-a', 'Retry A', 'UTC', 'USD'),
  ('b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'retry-b', 'Retry B', 'UTC', 'USD');

insert into public.sites (
  id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
) values
  (
    'a1100000-0000-4000-8000-000000000001',
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://retry-a.example.com', 'retry-a-key', 'v1.fixture.secret', now()
  ),
  (
    'b1100000-0000-4000-8000-000000000001',
    'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'https://retry-b.example.com', 'retry-b-key', 'v1.fixture.secret', now()
  );

insert into public.leads (
  id, tenant_id, site_id, external_event_id, name_ciphertext, email_ciphertext,
  email_lookup_hash, notes_ciphertext, declared_source, budget_range, timeline_range,
  occurred_at, last_activity_at
) values
  (
    'a1200000-0000-4000-8000-000000000001',
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1100000-0000-4000-8000-000000000001',
    'a1300000-0000-4000-8000-000000000001',
    'v1.fixture.name', 'v1.fixture.email', repeat('1', 64), 'v1.fixture.notes',
    'referral', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  ),
  (
    'b1200000-0000-4000-8000-000000000001',
    'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b1100000-0000-4000-8000-000000000001',
    'b1300000-0000-4000-8000-000000000001',
    'v1.fixture.name', 'v1.fixture.email', repeat('2', 64), 'v1.fixture.notes',
    'google', '5k-10k', '1-2-months',
    '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
  );

insert into public.attribution_evidence (
  id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
  landing_origin, landing_path, offer_id
) values
  (
    'a1400000-0000-4000-8000-000000000001',
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1200000-0000-4000-8000-000000000001',
    '2026-08-09 14:00:00+00', 'referral', '{}'::jsonb,
    'https://retry-a.example.com', '/', 'brief'
  ),
  (
    'b1400000-0000-4000-8000-000000000001',
    'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b1200000-0000-4000-8000-000000000001',
    '2026-08-09 14:00:00+00', 'google', '{"gclid":"click-b"}'::jsonb,
    'https://retry-b.example.com', '/', 'brief'
  );

select is(
  (select generation::text from public.attribution_recompute_jobs
   where tenant_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and lead_id = 'a1200000-0000-4000-8000-000000000001'),
  '1',
  'the first evidence mutation creates generation one'
);

create temp table task7_claims (label text primary key, payload jsonb);
grant select, insert on task7_claims to service_role;
set local role service_role;
insert into task7_claims values (
  'stale',
  public.claim_attribution_recompute_job(
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1200000-0000-4000-8000-000000000001',
    '2030-01-01 00:00:00+00'
  )
);
reset role;

select is(
  (select payload ->> 'generation' from task7_claims where label = 'stale'),
  '1',
  'a claim is tied to the exact generation snapshot it returns'
);
select is(
  (select payload #>> '{evidence,0,id}' from task7_claims where label = 'stale'),
  'a1400000-0000-4000-8000-000000000001',
  'the controlled claim contains only accepted attribution evidence'
);

insert into public.attribution_evidence (
  id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
  landing_origin, landing_path, offer_id
) values (
  'a1400000-0000-4000-8000-000000000002',
  'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a1200000-0000-4000-8000-000000000001',
  '2026-08-09 15:00:00+00', 'meta', '{"fbclid":"click-a2"}'::jsonb,
  'https://retry-a.example.com', '/later', 'brief'
);

select results_eq(
  $$ select generation::text, status, attempt_count, claim_token::text
     from public.attribution_recompute_jobs
     where tenant_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'a1200000-0000-4000-8000-000000000001' $$,
  $$ values ('2'::text, 'pending'::text, 0, null::text) $$,
  'newer evidence advances generation and restores retry eligibility'
);

set local role service_role;
select is(
  public.apply_attribution_recomputation(
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1200000-0000-4000-8000-000000000001',
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'stale'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'stale'),
    'a1400000-0000-4000-8000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'a1400000-0000-4000-8000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'a1500000-0000-4000-8000-000000000001'
  ) ->> 'stale',
  'true',
  'an older claimed snapshot is rejected as stale'
);
reset role;

select results_eq(
  $$ select generation::text, status
     from public.attribution_recompute_jobs
     where tenant_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'a1200000-0000-4000-8000-000000000001' $$,
  $$ values ('2'::text, 'pending'::text) $$,
  'stale apply cannot complete or clear newer pending work'
);
set local role service_role;
select is(
  public.record_attribution_recompute_failure(
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1200000-0000-4000-8000-000000000001',
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'stale'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'stale'),
    'a1500000-0000-4000-8000-000000000007',
    '2030-01-01 00:00:00+00'
  ) ->> 'status',
  'stale',
  'stale failure reporting cannot alter a newer generation'
);
reset role;
select is(
  (select count(*)::integer from public.attribution_touches
   where tenant_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and lead_id = 'a1200000-0000-4000-8000-000000000001'),
  0,
  'stale apply is a no-op for append-only attribution history'
);

set local role service_role;
insert into task7_claims values (
  'tenant-b',
  public.claim_attribution_recompute_job(
    'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b1200000-0000-4000-8000-000000000001',
    '2030-01-01 00:00:00+00'
  )
);
select is(
  public.apply_attribution_recomputation(
    'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1200000-0000-4000-8000-000000000001',
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'tenant-b'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'tenant-b'),
    'a1400000-0000-4000-8000-000000000001',
    '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
    'a1400000-0000-4000-8000-000000000002',
    '{"source":"meta_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:fbclid"]}',
    'a1500000-0000-4000-8000-000000000006'
  ) ->> 'stale',
  'true',
  'a claim token from another tenant cannot apply or complete this tenant work'
);
select is(
  public.apply_attribution_recomputation(
    'b1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b1200000-0000-4000-8000-000000000001',
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'tenant-b'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'tenant-b'),
    'b1400000-0000-4000-8000-000000000001',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
    'b1400000-0000-4000-8000-000000000001',
    '{"source":"google_ads","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["click_id:gclid"]}',
    'b1500000-0000-4000-8000-000000000001'
  ) ->> 'completed',
  'true',
  'the matching tenant generation and token complete claimed work'
);
reset role;
select is(
  (select status from public.attribution_recompute_jobs
   where tenant_id = 'a1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and lead_id = 'a1200000-0000-4000-8000-000000000001'),
  'pending',
  'cross-tenant token misuse leaves the newer generation pending'
);

set local role service_role;
insert into task7_claims values (
  'retry-1',
  (public.claim_attribution_recompute_jobs(1, '2030-01-01 00:00:00+00') -> 0)
);
select is(
  public.record_attribution_recompute_failure(
    (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-1'),
    (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-1'),
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'retry-1'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'retry-1'),
    'a1500000-0000-4000-8000-000000000002',
    '2030-01-01 00:00:00+00'
  ) ->> 'status',
  'failed',
  'a claimed failure schedules a retry with a fixed state'
);
reset role;

select is(
  (select next_retry_at from public.attribution_recompute_jobs
   where tenant_id = (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-1')
     and lead_id = (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-1')),
  '2030-01-01 00:01:00+00'::timestamptz,
  'the first failed claimed attempt backs off for one minute'
);

set local role service_role;
insert into task7_claims values (
  'retry-2',
  public.claim_attribution_recompute_job(
    (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-1'),
    (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-1'),
    '2030-01-01 00:01:00+00'
  )
);
select public.record_attribution_recompute_failure(
  (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-2'),
  (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-2'),
  (select (payload ->> 'generation')::bigint from task7_claims where label = 'retry-2'),
  (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'retry-2'),
  'a1500000-0000-4000-8000-000000000003',
  '2030-01-01 00:01:00+00'
);
reset role;
select is(
  (select next_retry_at from public.attribution_recompute_jobs
   where tenant_id = (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-2')
     and lead_id = (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-2')),
  '2030-01-01 00:05:00+00'::timestamptz,
  'the second failed claimed attempt backs off for four minutes'
);

set local role service_role;
insert into task7_claims values (
  'retry-3',
  public.claim_attribution_recompute_job(
    (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-2'),
    (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-2'),
    '2030-01-01 00:05:00+00'
  )
);
select public.record_attribution_recompute_failure(
  (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-3'),
  (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-3'),
  (select (payload ->> 'generation')::bigint from task7_claims where label = 'retry-3'),
  (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'retry-3'),
  'a1500000-0000-4000-8000-000000000004',
  '2030-01-01 00:05:00+00'
);
reset role;
select is(
  (select next_retry_at from public.attribution_recompute_jobs
   where tenant_id = (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-3')
     and lead_id = (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-3')),
  '2030-01-01 00:21:00+00'::timestamptz,
  'the third failed claimed attempt backs off for sixteen minutes'
);

set local role service_role;
insert into task7_claims values (
  'retry-4',
  public.claim_attribution_recompute_job(
    (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-3'),
    (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-3'),
    '2030-01-01 00:21:00+00'
  )
);
select is(
  public.record_attribution_recompute_failure(
    (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-4'),
    (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-4'),
    (select (payload ->> 'generation')::bigint from task7_claims where label = 'retry-4'),
    (select (payload ->> 'claim_token')::uuid from task7_claims where label = 'retry-4'),
    'a1500000-0000-4000-8000-000000000005',
    '2030-01-01 00:21:00+00'
  ) ->> 'status',
  'exhausted',
  'the fourth failed claimed attempt exhausts the bounded generation'
);
reset role;

select results_eq(
  $$ select status, sanitized_failure_code, next_retry_at::text
     from public.attribution_recompute_jobs
     where tenant_id = (select (payload ->> 'tenant_id')::uuid from task7_claims where label = 'retry-4')
       and lead_id = (select (payload ->> 'lead_id')::uuid from task7_claims where label = 'retry-4') $$,
  $$ values ('exhausted'::text, 'RETRY_EXHAUSTED'::text, null::text) $$,
  'exhausted work is not retry eligible and contains no free-text failure'
);

select * from finish();
rollback;
