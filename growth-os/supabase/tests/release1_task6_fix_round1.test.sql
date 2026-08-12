begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

select has_column('public', 'leads', 'preterminal_status', 'leads retain the immediate preterminal status');
select has_column('public', 'revenue_outcomes', 'superseded_at', 'revenue outcomes expose current vs history state');
select has_function(
  'public', 'amount_minor_text', array['public.revenue_outcomes'],
  'bigint revenue has a text transport function'
);
select ok(
  position('current_setting' in pg_get_functiondef('public.enforce_lead_status_transaction()'::regprocedure)) = 0
  and position('set_config' in pg_get_functiondef('public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure)) = 0
  and position('current_setting' in pg_get_functiondef('public.enforce_revenue_transaction()'::regprocedure)) = 0
  and position('set_config' in pg_get_functiondef('public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure)) = 0,
  'transaction authorization contains no custom GUC trust'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.enforce_lead_status_transaction()'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'public.enforce_revenue_transaction()'::regprocedure),
  'write guards run as invokers and observe the unforgeable definer role boundary'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'round1-owner-a@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'round1-owner-b@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  );

insert into public.tenants (id, slug, display_name) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task6-fix-a', 'Task 6 Fix A'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'task6-fix-b', 'Task 6 Fix B');

insert into public.memberships (tenant_id, user_id, role) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', 'client_owner'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c2222222-2222-4222-8222-222222222222', 'client_owner');

insert into public.sites (id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at) values
  ('ca100000-0000-4000-8000-000000000001', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://task6-fix-a.example.com', 'task6-fix-a', 'v1.fixture.a', now()),
  ('cb100000-0000-4000-8000-000000000001', 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://task6-fix-b.example.com', 'task6-fix-b', 'v1.fixture.b', now());

insert into public.leads (
  id, tenant_id, site_id, external_event_id, status,
  name_ciphertext, email_ciphertext, email_lookup_hash, notes_ciphertext,
  declared_source, budget_range, timeline_range, occurred_at
) values
  ('ca200000-0000-4000-8000-000000000001', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca100000-0000-4000-8000-000000000001', 'ca300000-0000-4000-8000-000000000001', 'new', 'v1.name.1', 'v1.email.1', repeat('1', 64), 'v1.notes.1', 'direct', '5k-10k', '1-2-months', now()),
  ('ca200000-0000-4000-8000-000000000002', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca100000-0000-4000-8000-000000000001', 'ca300000-0000-4000-8000-000000000002', 'qualified', 'v1.name.2', 'v1.email.2', repeat('2', 64), 'v1.notes.2', 'google', '5k-10k', '1-2-months', now()),
  ('ca200000-0000-4000-8000-000000000003', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca100000-0000-4000-8000-000000000001', 'ca300000-0000-4000-8000-000000000003', 'booked', 'v1.name.3', 'v1.email.3', repeat('3', 64), 'v1.notes.3', 'referral', '10k-25k', '1-2-months', now()),
  ('cb200000-0000-4000-8000-000000000001', 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cb100000-0000-4000-8000-000000000001', 'cb300000-0000-4000-8000-000000000001', 'qualified', 'v1.name.b', 'v1.email.b', repeat('4', 64), 'v1.notes.b', 'direct', '5k-10k', '1-2-months', now());

insert into public.consent_receipts (
  tenant_id, lead_id, receipt_type, policy_version, processing_basis, categories, source, recorded_at
)
select tenant_id, id, 'website_lead', 'privacy-2026-08-08', 'contact_request',
  '{"necessary":true,"analytics":false,"marketing":false,"preferences":false,"contact_requested":true,"gpc":false}',
  'contact-form', occurred_at
from public.leads
where id in (
  'ca200000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000002',
  'ca200000-0000-4000-8000-000000000003',
  'cb200000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('request.headers', '{}', true);
select set_config('app.lead_status_transaction', 'true', true);
select set_config('app.lead_status_write_authorized', 'true', true);

select throws_ok(
  $$ update public.leads set status = 'lost' where id = 'ca200000-0000-4000-8000-000000000001' $$,
  '42501', 'lead status changes require transaction function',
  'old and invented status GUCs cannot bypass direct authenticated validation'
);
select is(
  (select status::text from public.leads where id = 'ca200000-0000-4000-8000-000000000001'),
  'new', 'failed direct status bypass changes no row'
);
select lives_ok(
  $$ update public.leads set status = 'won' where id = 'cb200000-0000-4000-8000-000000000001' $$,
  'hidden cross-tenant status update still affects zero visible rows'
);

select set_config('app.revenue_transaction', 'true', true);
select set_config('app.revenue_write_authorized', 'true', true);
select throws_ok(
  $$ insert into public.revenue_outcomes (
       tenant_id, lead_id, amount_minor, currency, confirmed_on, confirmed_by
     ) values (
       'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000001',
       1, 'USD', current_date, 'c1111111-1111-4111-8111-111111111111'
     ) $$,
  '42501', 'revenue changes require transaction function',
  'old and invented revenue GUCs cannot bypass direct authenticated validation'
);
select is(
  (select count(*)::integer from public.revenue_outcomes), 0,
  'failed direct revenue bypass inserts no row'
);

select is(
  public.change_lead_status('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000001', 'lost', 'ca400000-0000-4000-8000-000000000001') ->> 'status',
  'lost', 'new lead can become lost'
);
select is(
  (select preterminal_status::text from public.leads where id = 'ca200000-0000-4000-8000-000000000001'),
  'new', 'new is retained as the actual preterminal status'
);
select is(
  public.reopen_lead('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000001', 'Customer restarted this conversation.', 'ca400000-0000-4000-8000-000000000002') ->> 'status',
  'new', 'new to lost reopens to new'
);

select is(
  public.change_lead_status('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000002', 'lost', 'ca400000-0000-4000-8000-000000000003') ->> 'status',
  'lost', 'qualified lead can become lost'
);
select is(
  public.reopen_lead('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000002', 'Customer restored the qualified opportunity.', 'ca400000-0000-4000-8000-000000000004') ->> 'status',
  'qualified', 'qualified to lost reopens to qualified'
);

select is(
  public.change_lead_status('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003', 'won', 'ca400000-0000-4000-8000-000000000005') ->> 'status',
  'won', 'booked lead can become won'
);
select is(
  (select preterminal_status::text from public.leads where id = 'ca200000-0000-4000-8000-000000000003'),
  'booked', 'booked is retained as the actual preterminal status'
);
select is(
  public.record_lead_revenue(
    'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003',
    9007199254740993, 'USD', current_date, null,
    'ca400000-0000-4000-8000-000000000006'
  ) ->> 'amount_minor',
  '9007199254740993', 'revenue above Number.MAX_SAFE_INTEGER returns exact text'
);
select is(
  (select public.amount_minor_text(outcome) from public.revenue_outcomes outcome where outcome.lead_id = 'ca200000-0000-4000-8000-000000000003' and outcome.superseded_at is null),
  '9007199254740993', 'computed database boundary preserves above-safe-integer text'
);
select is(
  public.record_lead_revenue(
    'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003',
    9223372036854775807, 'BHD', current_date, 'v1.encrypted.note',
    'ca400000-0000-4000-8000-000000000007'
  ) ->> 'amount_minor',
  '9223372036854775807', 'near-max PostgreSQL bigint returns exact text'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003'),
  2, 'recording replacement revenue preserves immutable history'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003' and superseded_at is null),
  1, 'exactly one replacement revenue outcome is current'
);
select is(
  (select public.amount_minor_text(outcome) from public.revenue_outcomes outcome where outcome.lead_id = 'ca200000-0000-4000-8000-000000000003' and outcome.superseded_at is null),
  '9223372036854775807', 'current outcome is the newly inserted near-max value'
);

select is(
  public.reopen_lead('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003', 'Customer needs another booked-stage review.', 'ca400000-0000-4000-8000-000000000008') ->> 'status',
  'booked', 'booked to won reopens to booked'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003' and superseded_at is null),
  0, 'reopened non-won lead exposes no current confirmed revenue'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003' and superseded_at is not null),
  2, 'reopen preserves all historical confirmed revenue'
);
select throws_ok(
  $$ select public.record_lead_revenue(
    'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003',
    500, 'USD', current_date, null, 'ca400000-0000-4000-8000-000000000009'
  ) $$,
  'P0002', 'lead not found', 'revenue remains denied until the reopened lead wins again'
);

select is(
  public.change_lead_status('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003', 'won', 'ca400000-0000-4000-8000-000000000010') ->> 'status',
  'won', 'reopened booked lead can win again'
);
select is(
  public.record_lead_revenue(
    'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ca200000-0000-4000-8000-000000000003',
    1234, 'JPY', current_date, null, 'ca400000-0000-4000-8000-000000000011'
  ) ->> 'amount_minor',
  '1234', 're-won lead accepts a new current outcome'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003'),
  3, 're-win appends rather than overwrites revenue history'
);
select is(
  (select count(*)::integer from public.revenue_outcomes where lead_id = 'ca200000-0000-4000-8000-000000000003' and superseded_at is null),
  1, 're-win still has exactly one current outcome'
);
select is(
  (select public.amount_minor_text(outcome) from public.revenue_outcomes outcome where outcome.lead_id = 'ca200000-0000-4000-8000-000000000003' and outcome.superseded_at is null),
  '1234', 're-win current outcome has exact decimal text'
);
select is(
  (
    select count(*)::integer
    from public.revenue_outcomes outcome
    join public.leads lead on lead.tenant_id = outcome.tenant_id and lead.id = outcome.lead_id
    where lead.status = 'lost' and outcome.superseded_at is null
  ),
  0, 'lost leads expose no current ledger values'
);

reset role;
select ok(
  not exists (
    select 1 from public.audit_events
    where action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded')
      and metadata ?| array['reason', 'amount_minor', 'note', 'note_ciphertext']
  )
  and not exists (
    select 1 from public.audit_events
    where action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded')
      and not public.is_sanitized_lead_operation_metadata(action, metadata)
  ),
  'every lifecycle audit uses finite status/date/count/change fields without free text or values'
);
select ok(
  position('FOR UPDATE' in upper(pg_get_functiondef('public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure))) > 0
  and position('FOR UPDATE' in upper(pg_get_functiondef('public.reopen_lead(uuid,uuid,text,uuid)'::regprocedure))) > 0
  and position('FOR UPDATE' in upper(pg_get_functiondef('public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure))) > 0,
  'status, reopen, and revenue transactions serialize on the lead row'
);
select is(
  (
    select count(*)::integer from pg_indexes
    where schemaname = 'public' and indexname = 'revenue_outcomes_one_current_per_lead_idx'
      and indexdef ilike '%where (superseded_at is null)%'
  ),
  1, 'partial unique index enforces one current outcome under concurrent writes'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'attribution_touches_tenant_lead_fkey'
      and pg_get_constraintdef(oid) ilike 'FOREIGN KEY (tenant_id, lead_id) REFERENCES leads(tenant_id, id)%'
  ),
  'attribution touches retain tenant-scoped lead integrity'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'consent_receipts_tenant_lead_fkey'
      and pg_get_constraintdef(oid) ilike 'FOREIGN KEY (tenant_id, lead_id) REFERENCES leads(tenant_id, id)%'
  ),
  'consent receipts retain tenant-scoped lead integrity'
);

select * from finish();
rollback;
