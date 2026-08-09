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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'owner-a@example.test',
    crypt('owner-a-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'owner-b@example.test',
    crypt('owner-b-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'platform-admin@example.test',
    crypt('platform-admin-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

insert into public.tenants (id, slug, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tenant-a', 'Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tenant-b', 'Tenant B');

insert into public.memberships (tenant_id, user_id, role)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'client_owner'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'client_owner'
  );

insert into public.platform_admins (user_id, granted_by)
values (
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.sites (
  id,
  tenant_id,
  origin,
  key_id,
  signing_secret_ciphertext,
  verified_at
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://a.example.test',
    'site-a-key',
    'ciphertext-a',
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'https://b.example.test',
    'site-b-key',
    'ciphertext-b',
    now()
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
values
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'google_ads',
    'credential-a',
    array['https://www.googleapis.com/auth/adwords'],
    'account-a',
    'Account A',
    'USD',
    'America/New_York'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'google_ads',
    'credential-b',
    array['https://www.googleapis.com/auth/adwords'],
    'account-b',
    'Account B',
    'USD',
    'America/New_York'
  );

insert into public.campaigns (
  id,
  tenant_id,
  connection_id,
  provider_external_id,
  name,
  normalized_status
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'campaign-a',
    'Campaign A',
    'enabled'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'campaign-b',
    'Campaign B',
    'enabled'
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
    'hash-a',
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
    'hash-b',
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
    '{"necessary":true,"analytics":false,"marketing":false,"preferences":false}',
    'contact-form',
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-0000-0000-000000000004',
    'website_lead',
    'privacy-2026-08-09',
    'contact_request',
    '{"necessary":true,"analytics":false,"marketing":false,"preferences":false}',
    'contact-form',
    now()
  );

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
  'every seeded accepted lead has exactly one website lead consent receipt'
);

insert into public.campaign_metrics_daily (
  tenant_id,
  connection_id,
  campaign_id,
  metric_date,
  currency,
  impressions,
  clicks,
  spend_minor,
  is_complete
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000003',
  current_date,
  'USD',
  100,
  10,
  5000,
  true
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
  'bbbbbbbb-0000-0000-0000-000000000005',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-0000-0000-000000000002',
  current_date - 1,
  current_date,
  'succeeded',
  now() - interval '1 minute',
  now()
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
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000005',
  'provider_import',
  'privacy-2026-08-09',
  'account_authorization',
  '{"necessary":true}',
  'google_ads',
  now()
);

insert into public.privacy_requests (
  id,
  tenant_id,
  request_type,
  state,
  subject_lookup_hmac,
  requested_by,
  requested_at,
  verified_at,
  restricted_at
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000006',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'access',
    'restricted',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    now(),
    now(),
    now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000006',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'access',
    'restricted',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    now(),
    now(),
    now()
  );

insert into public.audit_events (
  tenant_id,
  actor_user_id,
  actor_kind,
  action,
  target_type,
  target_id,
  request_id,
  metadata
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'user',
  'lead.created',
  'lead',
  'bbbbbbbb-0000-0000-0000-000000000004',
  'bbbbbbbb-2000-0000-0000-000000000004',
  '{"status":"new"}'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$ select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true) $$,
  'tenant A owner identity is active'
);
select is(
  (select count(*) from public.leads)::bigint,
  1::bigint,
  'owner sees tenant A lead'
);
select is(
  (
    select count(*)
    from public.leads
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  )::bigint,
  0::bigint,
  'owner cannot see tenant B lead'
);
select is_empty(
  $$
    update public.leads
    set status = 'won'
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    returning 1
  $$,
  'owner cannot update tenant B lead'
);
select is(
  (
    select count(*)
    from public.audit_events
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  )::bigint,
  0::bigint,
  'owner cannot read tenant B audit'
);
select throws_ok(
  $$ update public.audit_events set action = 'brand.updated' $$,
  '42501',
  null,
  'audit events are immutable'
);
select throws_ok(
  $$
    insert into public.brands (
      tenant_id,
      display_name,
      logo_url,
      primary_color,
      accent_color,
      on_primary_color,
      report_name
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Tenant A',
      'https://a.example.test/logo.png',
      '112233',
      '445566',
      'ffffff',
      'Tenant A Growth Report'
    )
  $$,
  '42501',
  null,
  'owner cannot bypass the audited brand mutation function'
);
select throws_ok(
  $$
    insert into public.brands (
      tenant_id,
      display_name,
      logo_url,
      primary_color,
      accent_color,
      on_primary_color,
      report_name
    ) values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Tenant B',
      'https://b.example.test/logo.png',
      '112233',
      '445566',
      'ffffff',
      'Tenant B Growth Report'
    )
  $$,
  '42501',
  null,
  'owner cannot insert tenant B brand'
);
select is(
  (select count(*) from public.sites)::bigint,
  1::bigint,
  'owner selects only tenant A sites'
);
select is_empty(
  $$
    delete from public.connections
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    returning 1
  $$,
  'owner cannot delete tenant B connection'
);
select lives_ok(
  $$
    update public.campaigns
    set normalized_status = 'paused'
    where id = 'aaaaaaaa-0000-0000-0000-000000000003'
  $$,
  'owner can update tenant A campaign'
);
select is(
  (select count(*) from public.campaign_metrics_daily)::bigint,
  0::bigint,
  'owner cannot select tenant B campaign metrics'
);
select lives_ok(
  $$
    insert into public.revenue_outcomes (
      tenant_id,
      lead_id,
      amount_minor,
      currency,
      confirmed_on,
      confirmed_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-0000-0000-000000000004',
      250000,
      'USD',
      current_date,
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  'owner can insert tenant A revenue outcome'
);
select is_empty(
  $$
    update public.consent_receipts
    set policy_version = 'changed'
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    returning 1
  $$,
  'owner cannot update tenant B consent receipt'
);
select lives_ok(
  $$
    delete from public.privacy_requests
    where id = 'aaaaaaaa-0000-0000-0000-000000000006'
  $$,
  'owner can delete tenant A privacy request'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*) from public.leads)::bigint,
  0::bigint,
  'platform admin sees no tenant data without support access'
);

reset role;
select public.start_support_session(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'Investigating a client-reported dashboard discrepancy.',
  now() + interval '30 minutes'
);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$ select tenant_id from public.leads order by tenant_id $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) $$,
  'platform admin sees only the supported tenant during a valid session'
);

reset role;
update public.support_sessions
set
  started_at = now() - interval '61 minutes',
  expires_at = now() - interval '1 minute'
where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and admin_user_id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*) from public.leads)::bigint,
  0::bigint,
  'platform admin loses tenant access after support expiry'
);

select * from finish();
rollback;
