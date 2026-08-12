begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

select has_function(
  'public',
  'change_lead_status',
  array['uuid', 'uuid', 'public.lead_status', 'uuid'],
  'status changes use one database transaction function'
);
select has_function(
  'public',
  'reopen_lead',
  array['uuid', 'uuid', 'text', 'uuid'],
  'terminal lead reopen is a separate transaction function'
);
select has_function(
  'public',
  'record_lead_revenue',
  array['uuid', 'uuid', 'bigint', 'text', 'date', 'text', 'uuid'],
  'confirmed revenue uses one database transaction function'
);
select ok(
  public.is_iso_4217_currency('XCG'),
  'database currency allowlist accepts current ISO 4217 codes'
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
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'support@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  );

insert into public.tenants (id, slug, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'task6-a', 'Task 6 Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'task6-b', 'Task 6 Tenant B');

insert into public.memberships (tenant_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client_owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'client_owner');

insert into public.platform_admins (user_id, granted_by)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

insert into public.sites (
  id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'https://task6-a.example.com', 'task6-site-key-a', 'v1.fixture.secret.a', now()
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'https://task6-b.example.com', 'task6-site-key-b', 'v1.fixture.secret.b', now()
  );

insert into public.leads (
  id, tenant_id, site_id, external_event_id, status,
  name_ciphertext, email_ciphertext, email_lookup_hash, phone_ciphertext,
  phone_lookup_hash, company_ciphertext, notes_ciphertext, declared_source,
  budget_range, timeline_range, occurred_at
)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001', 'qualified',
    'v1.fixture.name.a1', 'v1.fixture.email.a1', repeat('a', 64), null, null,
    null, 'v1.fixture.notes.a1', 'google', '5k-10k', '1-2-months', now() - interval '3 days'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a1000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000002', 'lost',
    'v1.fixture.name.a2', 'v1.fixture.email.a2', repeat('b', 64), null, null,
    null, 'v1.fixture.notes.a2', 'direct', '10k-25k', '3-6-months', now() - interval '2 days'
  ),
  (
    'b2000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'b1000000-0000-0000-0000-000000000001',
    'b3000000-0000-0000-0000-000000000001', 'qualified',
    'v1.fixture.name.b1', 'v1.fixture.email.b1', repeat('c', 64), null, null,
    null, 'v1.fixture.notes.b1', 'referral', '5k-10k', '1-2-months', now() - interval '1 day'
  );

insert into public.consent_receipts (
  tenant_id, lead_id, receipt_type, policy_version, processing_basis,
  categories, source, recorded_at
)
select
  tenant_id, id, 'website_lead', 'privacy-2026-08-08', 'contact_request',
  '{"necessary":true,"analytics":false,"marketing":false,"preferences":false,"contact_requested":true,"gpc":false}',
  'contact-form', occurred_at
from public.leads
where id in (
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.headers', '{}', true);

select is(
  public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    'won',
    'a4000000-0000-0000-0000-000000000001'
  ) ->> 'status',
  'won',
  'qualified lead can become won without revenue'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'a2000000-0000-0000-0000-000000000001'),
  0,
  'won transition does not invent revenue'
);
select is(
  (select action::text from public.audit_events where request_id = 'a4000000-0000-0000-0000-000000000001'),
  'lead.status_changed',
  'status transition writes its audit event'
);
select is(
  (select metadata ->> 'previous_status' from public.audit_events where request_id = 'a4000000-0000-0000-0000-000000000001'),
  'qualified',
  'status audit records the prior finite status'
);

select throws_ok(
  $$ select public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    'lost',
    'a4000000-0000-0000-0000-000000000002'
  ) $$,
  '22023',
  'lead status transition is not allowed',
  'terminal status cannot use the ordinary transition function'
);

select is(
  public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'b2000000-0000-0000-0000-000000000001',
    'won',
    'a4000000-0000-0000-0000-000000000003'
  ),
  null::jsonb,
  'cross-tenant lead is indistinguishable from unknown'
);
select is(
  public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'f2000000-0000-0000-0000-000000000001',
    'won',
    'a4000000-0000-0000-0000-000000000004'
  ),
  null::jsonb,
  'unknown lead has the same not-found result'
);

select is(
  public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    350000,
    'USD',
    current_date,
    'v1.encrypted.internal.revenue.note',
    'a4000000-0000-0000-0000-000000000005'
  ) ->> 'amount_minor',
  '350000',
  'positive confirmed revenue is recorded for won lead'
);
select is(
  (select note_ciphertext from public.revenue_outcomes where lead_id = 'a2000000-0000-0000-0000-000000000001'),
  'v1.encrypted.internal.revenue.note',
  'optional revenue note remains encrypted at rest'
);
select is(
  (select action::text from public.audit_events where request_id = 'a4000000-0000-0000-0000-000000000005'),
  'revenue.recorded',
  'revenue transaction writes its audit event'
);
select ok(
  not exists (
    select 1 from public.audit_events
    where request_id = 'a4000000-0000-0000-0000-000000000005'
      and metadata::text ~* '(note|cipher|350000)'
  ),
  'revenue note ciphertext and amount never enter audit metadata'
);

select throws_ok(
  $$ select public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002',
    100, 'USD', current_date, null,
    'a4000000-0000-0000-0000-000000000006'
  ) $$,
  'P0002',
  'lead not found',
  'revenue is rejected unless the lead is won'
);
select throws_ok(
  $$ select public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    0, 'USD', current_date, null,
    'a4000000-0000-0000-0000-000000000007'
  ) $$,
  '22023',
  'revenue amount must be positive',
  'zero revenue is rejected'
);
select throws_ok(
  $$ select public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    -1, 'USD', current_date, null,
    'a4000000-0000-0000-0000-000000000008'
  ) $$,
  '22023',
  'revenue amount must be positive',
  'negative revenue is rejected'
);
select throws_ok(
  $$ select public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    100, 'ZZZ', current_date, null,
    'a4000000-0000-0000-0000-000000000009'
  ) $$,
  '22023',
  'currency must be a valid ISO 4217 code',
  'invalid ISO 4217 currency is rejected'
);
select throws_ok(
  $$ select public.record_lead_revenue(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000001',
    100, 'USD', current_date + 1, null,
    'a4000000-0000-0000-0000-000000000010'
  ) $$,
  '22023',
  'confirmation date cannot be in the future',
  'future confirmation date is rejected'
);

select throws_ok(
  $$ select public.reopen_lead(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002',
    'short',
    'a4000000-0000-0000-0000-000000000011'
  ) $$,
  '22023',
  'reopen reason must be 10-500 characters',
  'reopen requires a ten character reason'
);
select is(
  public.reopen_lead(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002',
    'Customer restarted the project discussion.',
    'a4000000-0000-0000-0000-000000000012'
  ) ->> 'status',
  'qualified',
  'lost lead reopens to qualified through the separate action'
);
select is(
  (select action::text from public.audit_events where request_id = 'a4000000-0000-0000-0000-000000000012'),
  'lead.reopened',
  'reopen writes its distinct audit action'
);
select is(
  (select metadata ->> 'reason' from public.audit_events where request_id = 'a4000000-0000-0000-0000-000000000012'),
  'Customer restarted the project discussion.',
  'reopen audit retains the required sanitized reason'
);

reset role;
create function public.task6_reject_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = 'task6 forced audit failure';
end;
$$;
create trigger task6_reject_audit
before insert on public.audit_events
for each row execute function public.task6_reject_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$ select public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002',
    'booked',
    'a4000000-0000-0000-0000-000000000013'
  ) $$,
  'P0001',
  'task6 forced audit failure',
  'audit failure aborts the status transaction'
);
select is(
  (select status::text from public.leads where id = 'a2000000-0000-0000-0000-000000000002'),
  'qualified',
  'failed audit rolls back the lead update'
);

reset role;
drop trigger task6_reject_audit on public.audit_events;
drop function public.task6_reject_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$ update public.leads
     set status = 'lost'
     where id = 'a2000000-0000-0000-0000-000000000002' $$,
  '42501',
  'lead status changes require transaction function',
  'owners cannot bypass the transactional status functions'
);
select throws_ok(
  $$ update public.revenue_outcomes
     set amount_minor = 1
     where lead_id = 'a2000000-0000-0000-0000-000000000001' $$,
  '42501',
  'revenue changes require transaction function',
  'owners cannot bypass the transactional revenue function'
);

reset role;
insert into public.support_sessions (
  id, tenant_id, admin_user_id, reason, started_at, expires_at
)
values (
  'a5000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'Reviewing the lead ledger for the tenant.',
  now(), now() + interval '30 minutes'
);
insert into public.audit_events (
  tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  'user', 'support.started', 'support_session',
  'a5000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000002',
  jsonb_build_object('expires_at', now() + interval '30 minutes')
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config(
  'request.headers',
  '{"x-gt-support-session":"a5000000-0000-0000-0000-000000000001"}',
  true
);

select is(
  (select count(*)::integer from public.leads where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'exact-session audited support can read only the selected tenant leads'
);
select throws_ok(
  $$ select public.change_lead_status(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'a2000000-0000-0000-0000-000000000002',
    'won',
    'a4000000-0000-0000-0000-000000000014'
  ) $$,
  '42501',
  'client owner required',
  'support remains read-only through the status RPC'
);

select * from finish();
rollback;
