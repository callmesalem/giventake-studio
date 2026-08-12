begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fix1-owner@example.test',
    'test'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fix1-admin@example.test',
    'test'
  );

insert into public.tenants (id, slug, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fix1-a', 'Fix 1 Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'fix1-b', 'Fix 1 Tenant B');

insert into public.memberships (tenant_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client_owner');

insert into public.platform_admins (user_id, granted_by)
values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

insert into public.sites (id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://fix1-a.example.test',
    'fix1-site-a',
    'ciphertext-a',
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'https://fix1-b.example.test',
    'fix1-site-b',
    'ciphertext-b',
    now()
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
  occurred_at
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-1000-0000-0000-000000000004',
    'name-a',
    'email-a',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'notes-a',
    'declared-a',
    '5k-10k',
    '1-2-months',
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-1000-0000-0000-000000000004',
    'name-b',
    'email-b',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'notes-b',
    'declared-b',
    '5k-10k',
    '1-2-months',
    now()
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
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-0000-0000-000000000004',
    'website_lead',
    'privacy-2026-08-09',
    'contact_request',
    '{"necessary":true}',
    'contact-form',
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-0000-0000-000000000004',
    'website_lead',
    'privacy-2026-08-09',
    'contact_request',
    '{"necessary":true}',
    'contact-form',
    now()
  );

select throws_ok(
  $$select public.write_audit_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'brand.updated', 'brand',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(),
    '{"reason_code":"sk_live_encoded_secret"}', '11111111-1111-1111-1111-111111111111'
  )$$,
  '22023',
  null,
  'reason codes use a finite value allowlist'
);
select throws_ok(
  $$select public.write_audit_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'brand.updated', 'brand',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(),
    '{"change_code":"customer_email"}', '11111111-1111-1111-1111-111111111111'
  )$$,
  '22023',
  null,
  'change codes use a finite value allowlist'
);
select throws_ok(
  $$select public.write_audit_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lead.status_changed', 'lead',
    'aaaaaaaa-0000-0000-0000-000000000004', gen_random_uuid(),
    '{"status":"private_notes"}', '11111111-1111-1111-1111-111111111111'
  )$$,
  '42501',
  'lifecycle audit actions require lifecycle transaction function',
  'generic audit writes cannot reach lifecycle status metadata'
);
select throws_ok(
  $$select public.write_audit_event(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'privacy.restricted', 'privacy_request',
    null, gen_random_uuid(), '{"request_type":"subject_email","matched_count":1}',
    '11111111-1111-1111-1111-111111111111'
  )$$,
  '22023',
  null,
  'privacy request types use their domain allowlist'
);

select lives_ok(
  $$select public.restrict_privacy_subject(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'deletion',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-1000-0000-0000-000000000010'
  )$$,
  'privacy restriction and its audit proof commit together after migration 005'
);
select ok(
  (select restricted_at is not null from public.leads where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  'privacy restriction updates the matched lead'
);
select is(
  (select count(*)::integer from public.privacy_requests where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'privacy restriction creates its request'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'privacy.restricted'),
  1,
  'privacy restriction creates its audit event'
);
select is(
  (select metadata ->> 'request_type' from public.audit_events where action = 'privacy.restricted'),
  'deletion',
  'privacy audit stores only the allowlisted request type'
);
select is(
  (select (metadata ->> 'matched_count')::integer from public.audit_events where action = 'privacy.restricted'),
  1,
  'privacy audit stores the nonnegative match count'
);

insert into public.support_sessions (id, tenant_id, admin_user_id, reason, started_at, expires_at, revoked_at)
values
  (
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Exact audited support session.',
    now() - interval '1 minute',
    now() + interval '30 minutes',
    null
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Concurrent tenant support session.',
    now() - interval '1 minute',
    now() + interval '30 minutes',
    null
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Unaudited support session.',
    now() - interval '1 minute',
    now() + interval '30 minutes',
    null
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Expired support session.',
    now() - interval '61 minutes',
    now() - interval '1 minute',
    null
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Revoked support session.',
    now() - interval '1 minute',
    now() + interval '30 minutes',
    now()
  );

insert into public.audit_events (
  tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'user',
    'support.started',
    'support_session',
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-1000-0000-0000-000000000011',
    '{"expires_at":"2099-01-01T00:00:00Z"}'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'user',
    'support.started',
    'support_session',
    '55555555-5555-5555-5555-555555555555',
    'bbbbbbbb-1000-0000-0000-000000000011',
    '{"expires_at":"2099-01-01T00:00:00Z"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select set_config('request.headers', '{}', true);
select is(
  (select count(*)::integer from public.leads),
  0,
  'support admin sees no tenant rows without session context'
);
select set_config('request.headers', '{"x-gt-support-session":"55555555-5555-5555-5555-555555555555"}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'a concurrent session for another tenant grants no access'
);
select set_config('request.headers', '{"x-gt-support-session":"44444444-4444-4444-4444-444444444444"}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'the exact active session with start audit grants reads'
);
select set_config('request.headers', '{"x-gt-support-session":"66666666-6666-6666-6666-666666666666"}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'an active session without support.started proof grants no access'
);
select set_config('request.headers', '{"x-gt-support-session":"77777777-7777-7777-7777-777777777777"}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'an expired exact session grants no access'
);
select set_config('request.headers', '{"x-gt-support-session":"88888888-8888-8888-8888-888888888888"}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'a revoked exact session grants no access'
);
select set_config('request.headers', '{"x-gt-support-session":"44444444-4444-4444-4444-444444444444"}', true);
select is_empty(
  $$update public.leads set status = 'won'
    where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning 1$$,
  'support access remains read-only'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.headers', '{}', true);
select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'ordinary owner access remains unchanged without support context'
);

create temp table fix1_brand_result as
select public.update_tenant_brand(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '  Canonical Tenant  ',
  '  https://cdn.example.com/brand/logo.svg  ',
  '0057B8',
  'F4B400',
  'FFFFFF',
  '  Canonical Growth Report  ',
  'aaaaaaaa-1000-0000-0000-000000000012'
) as value;

select pass('owner brand update accepts canonicalizable values');
select is(
  (select value from fix1_brand_result),
  jsonb_build_object(
    'display_name', 'Canonical Tenant',
    'logo_url', 'https://cdn.example.com/brand/logo.svg',
    'primary_color', '0057b8',
    'accent_color', 'f4b400',
    'on_primary_color', 'ffffff',
    'report_name', 'Canonical Growth Report'
  ),
  'brand RPC returns canonical values'
);
select is(
  (
    select jsonb_build_object(
      'display_name', display_name,
      'logo_url', logo_url,
      'primary_color', primary_color,
      'accent_color', accent_color,
      'on_primary_color', on_primary_color,
      'report_name', report_name
    )
    from public.brands
    where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  (select value from fix1_brand_result),
  'brand RPC stores the same canonical values it returns'
);
select throws_ok(
  $$select public.update_tenant_brand(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '   ', 'https://cdn.example.com/logo.svg',
    '0057b8', 'f4b400', 'ffffff', 'Report', gen_random_uuid()
  )$$,
  '22023',
  null,
  'brand RPC rejects whitespace-only display names'
);
select throws_ok(
  $$select public.update_tenant_brand(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant', 'https://cdn.example.com/logo.svg',
    '0057b8', 'f4b400', 'ffffff', E'\t  ', gen_random_uuid()
  )$$,
  '22023',
  null,
  'brand RPC rejects whitespace-only report names'
);
select throws_ok(
  $$select public.update_tenant_brand(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant', 'https://-bad..example.com/logo.svg',
    '0057b8', 'f4b400', 'ffffff', 'Report', gen_random_uuid()
  )$$,
  '22023',
  null,
  'brand RPC rejects malformed HTTPS-shaped URLs'
);
select throws_ok(
  $$select public.update_tenant_brand(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant', 'https://cdn.example.com/logo.svg',
    'ffffff', 'f4b400', '777777', 'Report', gen_random_uuid()
  )$$,
  '22023',
  null,
  'brand RPC rejects low contrast on canonical colors'
);
select throws_ok(
  $$select public.update_tenant_brand(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Must Roll Back', 'https://cdn.example.com/logo.svg',
    '0057b8', 'f4b400', 'ffffff', 'Must Roll Back', null
  )$$,
  '22004',
  null,
  'audit failure rolls back the canonical brand transaction'
);
select is(
  (select display_name from public.brands where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Canonical Tenant',
  'failed brand calls leave the canonical brand unchanged'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'brand.updated'),
  1,
  'only the successful brand transaction writes audit proof'
);

select * from finish();
rollback;
