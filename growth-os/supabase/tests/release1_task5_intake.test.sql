begin;

create extension if not exists pgtap with schema extensions;
select plan(76);

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
    'name_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'email_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'email_lookup_hash', repeat('1', 64),
    'phone_ciphertext', null,
    'phone_lookup_hash', null,
    'company_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'notes_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
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
      now(), '{}'::jsonb, '{}'::jsonb,
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
        'name_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
        'email_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
        'email_lookup_hash', repeat('2', 64), 'phone_ciphertext', null,
        'phone_lookup_hash', null, 'company_ciphertext', null,
        'notes_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA', 'budget_range', '5k-10k',
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

create function pg_temp.task5_valid_encrypted_lead()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'name_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'email_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'email_lookup_hash', repeat('3', 64),
    'phone_ciphertext', null,
    'phone_lookup_hash', null,
    'company_ciphertext', null,
    'notes_ciphertext', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA',
    'budget_range', '5k-10k',
    'timeline_range', '1-2-months'
  );
$$;

create function pg_temp.task5_valid_attribution()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'declared_source', 'direct', 'source_detail', null, 'utm_source', null,
    'utm_medium', null, 'utm_campaign', null, 'utm_content', null,
    'utm_term', null, 'referrer_domain', null, 'click_ids', '{}'::jsonb,
    'landing_origin', 'https://task5-a.example.com', 'landing_path', '/contact',
    'offer_id', 'project-brief'
  );
$$;

create function pg_temp.task5_valid_consent()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'policy_version', 'privacy-2026-08-08', 'source', 'contact-form',
    'necessary', true, 'analytics', false, 'marketing', false,
    'preferences', false, 'contact_requested', true, 'gpc', false,
    'recorded_at', '2026-08-09T16:03:00.000Z'
  );
$$;

create function pg_temp.task5_consent_is_rejected(candidate jsonb)
returns boolean
language plpgsql
as $$
begin
  perform public.ingest_website_lead(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    gen_random_uuid(),
    repeat('b', 64),
    gen_random_uuid(),
    '2026-08-09T16:03:00.000Z',
    pg_temp.task5_valid_encrypted_lead(),
    pg_temp.task5_valid_attribution(),
    candidate,
    gen_random_uuid()
  );
  return false;
exception when sqlstate '22023' then
  return true;
end;
$$;

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{necessary}', 'null'::jsonb)), 'necessary rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'necessary'), 'necessary rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{necessary}', '"true"'::jsonb)), 'necessary rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{necessary}', '1'::jsonb)), 'necessary rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{necessary}', '{}'::jsonb)), 'necessary rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{analytics}', 'null'::jsonb)), 'analytics rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'analytics'), 'analytics rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{analytics}', '"false"'::jsonb)), 'analytics rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{analytics}', '0'::jsonb)), 'analytics rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{analytics}', '{}'::jsonb)), 'analytics rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{marketing}', 'null'::jsonb)), 'marketing rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'marketing'), 'marketing rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{marketing}', '"false"'::jsonb)), 'marketing rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{marketing}', '0'::jsonb)), 'marketing rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{marketing}', '{}'::jsonb)), 'marketing rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{preferences}', 'null'::jsonb)), 'preferences rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'preferences'), 'preferences rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{preferences}', '"false"'::jsonb)), 'preferences rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{preferences}', '0'::jsonb)), 'preferences rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{preferences}', '{}'::jsonb)), 'preferences rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{contact_requested}', 'null'::jsonb)), 'contact_requested rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'contact_requested'), 'contact_requested rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{contact_requested}', '"true"'::jsonb)), 'contact_requested rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{contact_requested}', '1'::jsonb)), 'contact_requested rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{contact_requested}', '{}'::jsonb)), 'contact_requested rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{gpc}', 'null'::jsonb)), 'gpc rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'gpc'), 'gpc rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{gpc}', '"false"'::jsonb)), 'gpc rejects a string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{gpc}', '0'::jsonb)), 'gpc rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{gpc}', '{}'::jsonb)), 'gpc rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{policy_version}', 'null'::jsonb)), 'policy_version rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'policy_version'), 'policy_version rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{policy_version}', '""'::jsonb)), 'policy_version rejects an empty string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{policy_version}', '1'::jsonb)), 'policy_version rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{policy_version}', '{}'::jsonb)), 'policy_version rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{source}', 'null'::jsonb)), 'source rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'source'), 'source rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{source}', '"other"'::jsonb)), 'source rejects an unrecognized string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{source}', '1'::jsonb)), 'source rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{source}', '{}'::jsonb)), 'source rejects an object');

select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{recorded_at}', 'null'::jsonb)), 'recorded_at rejects JSON null');
select ok(pg_temp.task5_consent_is_rejected(pg_temp.task5_valid_consent() - 'recorded_at'), 'recorded_at rejects a missing key');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{recorded_at}', '"not-a-timestamp"'::jsonb)), 'recorded_at rejects an invalid string');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{recorded_at}', '1'::jsonb)), 'recorded_at rejects a number');
select ok(pg_temp.task5_consent_is_rejected(jsonb_set(pg_temp.task5_valid_consent(), '{recorded_at}', '{}'::jsonb)), 'recorded_at rejects an object');

select is((select count(*)::integer from public.leads), 1, 'invalid consent creates no lead');
select is((select count(*)::integer from public.attribution_evidence), 1, 'invalid consent creates no evidence');
select is((select count(*)::integer from public.consent_receipts), 1, 'invalid consent creates no receipt');
select is((select count(*)::integer from public.ingest_idempotency), 1, 'invalid consent creates no idempotency reservation');
select is((select count(*)::integer from public.audit_events), 1, 'invalid consent creates no audit event');
select ok(
  position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef(
      'public.ingest_website_lead_unvalidated(uuid,uuid,uuid,text,uuid,timestamptz,jsonb,jsonb,jsonb,uuid)'::regprocedure
    )
  ) > 0,
  'duplicate and conflicting idempotency calls retain their transaction advisory lock'
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
