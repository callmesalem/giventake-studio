begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into public.tenants (id, slug, display_name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'task5-a', 'Task 5 Tenant A');

insert into public.sites (
  id,
  tenant_id,
  origin,
  key_id,
  signing_secret_ciphertext,
  rate_limit_per_minute,
  verified_at
)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://task5-a.example.com',
    'task5-site-key-a',
    'v1.encrypted.site.secret.a',
    120,
    now()
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://task5-b.example.com',
    'task5-site-key-b',
    'v1.encrypted.site.secret.b',
    120,
    now()
  );

create temporary table task5_accepted as
select public.ingest_website_lead(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
  repeat('a', 64),
  '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
  '2026-08-09T16:00:00.000Z',
  jsonb_build_object(
    'name_ciphertext', 'v1.name',
    'email_ciphertext', 'v1.email',
    'email_lookup_hash', repeat('1', 64),
    'phone_ciphertext', null,
    'phone_lookup_hash', null,
    'company_ciphertext', 'v1.company',
    'notes_ciphertext', 'v1.notes',
    'budget_range', '5k-10k',
    'timeline_range', '1-2-months'
  ),
  jsonb_build_object(
    'declared_source', 'google',
    'source_detail', null,
    'utm_source', 'google',
    'utm_medium', 'cpc',
    'utm_campaign', 'launch',
    'utm_content', null,
    'utm_term', null,
    'referrer_domain', 'google.com',
    'click_ids', '{}'::jsonb,
    'landing_origin', 'https://task5-a.example.com',
    'landing_path', '/contact',
    'offer_id', 'project-brief'
  ),
  jsonb_build_object(
    'policy_version', 'privacy-2026-08-08',
    'source', 'contact-form',
    'necessary', true,
    'analytics', false,
    'marketing', false,
    'preferences', false,
    'contact_requested', true,
    'gpc', false,
    'recorded_at', '2026-08-09T16:00:00.000Z'
  ),
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
) as result;

select is((select result ->> 'status' from task5_accepted), 'accepted', 'atomic intake accepts one lead');
select is((select count(*)::integer from public.leads), 1, 'atomic intake creates one lead');
select is((select count(*)::integer from public.attribution_evidence), 1, 'atomic intake creates evidence');
select is(
  (select touch_type::text from public.attribution_touches),
  'unresolved',
  'intake records unresolved attribution until Task 7'
);
select is((select count(*)::integer from public.consent_receipts), 1, 'intake creates a consent receipt');
select ok(
  (
    select categories = jsonb_build_object(
      'necessary', true,
      'analytics', false,
      'marketing', false,
      'preferences', false,
      'contact_requested', true,
      'gpc', false
    )
    from public.consent_receipts
  ),
  'receipt preserves every category when optional consent is false'
);
select is((select count(*)::integer from public.ingest_idempotency), 1, 'intake reserves idempotency');
select is(
  (select count(*)::integer from public.audit_events where action = 'lead.created'),
  1,
  'intake writes lead.created audit proof'
);
select ok(
  (
    select metadata ?& array['site_id', 'lead_id']
      and (select count(*) from jsonb_object_keys(metadata)) = 2
      and metadata::text !~* '(email|phone|name|note|cipher|secret|payload)'
    from public.audit_events
    where action = 'lead.created'
  ),
  'lead.created audit contains identifiers only'
);

create temporary table task5_duplicate as
select public.ingest_website_lead(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
  repeat('a', 64),
  '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
  '2026-08-09T16:00:00.000Z',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
) as result;

select is((select result ->> 'status' from task5_duplicate), 'duplicate', 'same request is a duplicate');
select is(
  (select result ->> 'lead_id' from task5_duplicate),
  (select result ->> 'lead_id' from task5_accepted),
  'duplicate returns the existing lead id'
);
select is((select count(*)::integer from public.leads), 1, 'duplicate creates no lead');
select is((select count(*)::integer from public.consent_receipts), 1, 'duplicate creates no receipt');
select is((select count(*)::integer from public.audit_events), 1, 'duplicate creates no audit event');

select throws_ok(
  $$
    select public.ingest_website_lead(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
      repeat('f', 64),
      '7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4',
      now(), '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
  $$,
  'P0001',
  'IDEMPOTENCY_CONFLICT',
  'same idempotency key with a different body conflicts'
);
select is((select count(*)::integer from public.leads), 1, 'conflict changes no lead data');

select throws_ok(
  $$
    select public.ingest_website_lead(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '99999999-9999-4999-8999-999999999999',
      repeat('9', 64),
      '99999999-9999-4999-8999-999999999999',
      '2026-08-09T16:01:00.000Z',
      jsonb_build_object(
        'name_ciphertext', 'v1.name.2', 'email_ciphertext', 'v1.email.2',
        'email_lookup_hash', repeat('2', 64), 'phone_ciphertext', null,
        'phone_lookup_hash', null, 'company_ciphertext', null,
        'notes_ciphertext', 'v1.notes.2', 'budget_range', '5k-10k',
        'timeline_range', '1-2-months'
      ),
      jsonb_build_object(
        'declared_source', 'direct', 'source_detail', null, 'utm_source', null,
        'utm_medium', null, 'utm_campaign', null, 'utm_content', null,
        'utm_term', null, 'referrer_domain', null, 'click_ids', '{}'::jsonb,
        'landing_origin', 'https://task5-a.example.com', 'landing_path', '/contact',
        'offer_id', 'project-brief'
      ),
      jsonb_build_object(
        'policy_version', 'privacy-2026-08-08', 'source', 'contact-form',
        'necessary', true, 'analytics', false, 'marketing', false,
        'preferences', false, 'contact_requested', true, 'gpc', false,
        'recorded_at', '2026-08-09T16:01:00.000Z'
      ),
      null
    )
  $$,
  '22004',
  null,
  'audit failure aborts the complete intake transaction'
);
select is(
  (select count(*)::integer from public.leads where external_event_id = '99999999-9999-4999-8999-999999999999'),
  0,
  'failed audit leaves no partial lead'
);

select ok(
  (
    select bool_and(public.consume_site_ingest_rate_limit(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '2026-08-09T16:02:00.000Z'
    ))
    from generate_series(1, 120)
  ),
  'the first 120 site attempts in a rolling minute are allowed'
);
select ok(
  not public.consume_site_ingest_rate_limit(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T16:02:00.000Z'
  ),
  'the 121st attempt for the same site is rate limited'
);
select ok(
  public.consume_site_ingest_rate_limit(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-08-09T16:02:00.000Z'
  ),
  'another site has an independent limit'
);
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ingest_rate_limit_attempts'
      and column_name ~* '(ip|device|fingerprint|latitude|longitude|coordinate|personal|payload|body)'
  ),
  0,
  'rate-limit storage has no prohibited identifying or request-content columns'
);
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.ingest_rate_limit_attempts'::regclass
  ),
  'site rate-limit rows preserve forced RLS'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_website_lead(uuid,uuid,uuid,text,uuid,timestamptz,jsonb,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  'browser-authenticated users cannot call atomic intake directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_site_ingest_rate_limit(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  'browser-authenticated users cannot consume site limits directly'
);

select * from finish();
rollback;
