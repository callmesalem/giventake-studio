begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

select ok(
  position(
    'old.preterminal_status is distinct from new.preterminal_status'
    in lower(pg_get_functiondef('public.enforce_lead_status_transaction()'::regprocedure))
  ) > 0,
  'the lifecycle guard owns status and preterminal status together'
);
select has_function(
  'public', 'sanitize_lead_operation_metadata', array['public.audit_action', 'jsonb'],
  'upgrade cleanup has a deterministic metadata sanitizer'
);

create function pg_temp.call_lead_operation_sanitizer(
  event_action public.audit_action,
  event_metadata jsonb
)
returns jsonb
language plpgsql
as $$
declare
  sanitized jsonb;
begin
  execute 'select public.sanitize_lead_operation_metadata($1, $2)'
  into sanitized
  using event_action, event_metadata;
  return sanitized;
exception when undefined_function then
  return event_metadata;
end;
$$;

create temporary table task6_legacy_audit_fixture (
  id uuid primary key,
  tenant_id uuid not null,
  actor_user_id uuid not null,
  actor_kind text not null,
  action public.audit_action not null,
  target_type text not null,
  target_id uuid not null,
  request_id uuid not null,
  metadata jsonb not null,
  created_at timestamptz not null
);

insert into task6_legacy_audit_fixture values (
  'd2600000-0000-4000-8000-000000000001',
  'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'd2111111-1111-4111-8111-111111111111',
  'user',
  'lead.reopened',
  'lead',
  'd2200000-0000-4000-8000-000000000001',
  'd2400000-0000-4000-8000-000000000001',
  '{"previous_status":"won","current_status":"qualified","reason":"Customer returned with private details."}',
  '2026-08-10T14:30:00Z'
);

create temporary table task6_legacy_audit_identity as
select id, tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, created_at
from task6_legacy_audit_fixture;

update task6_legacy_audit_fixture
set metadata = pg_temp.call_lead_operation_sanitizer(action, metadata);

select ok(
  coalesce(not (select metadata ? 'reason' from task6_legacy_audit_fixture), false),
  'upgrade cleanup removes legacy reopen reason free text'
);
select is(
  (select metadata from task6_legacy_audit_fixture),
  '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":0}'::jsonb,
  'upgrade cleanup preserves statuses and adds finite canonical change and count fields'
);
select is(
  (
    select row(id, tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, created_at)::text
    from task6_legacy_audit_fixture
  ),
  (
    select row(id, tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, created_at)::text
    from task6_legacy_audit_identity
  ),
  'upgrade cleanup preserves audit identity, timestamp, target, and actor'
);

create temporary table task6_sanitized_once as
select metadata from task6_legacy_audit_fixture;
update task6_legacy_audit_fixture
set metadata = pg_temp.call_lead_operation_sanitizer(action, metadata);
select is(
  (select metadata from task6_legacy_audit_fixture),
  (select metadata from task6_sanitized_once),
  'upgrade cleanup is idempotent in effect'
);
select ok(
  coalesce((
    select convalidated
    from pg_constraint
    where conrelid = 'public.audit_events'::regclass
      and conname = 'audit_events_lead_operation_metadata_check'
  ), false),
  'the strict lifecycle audit constraint is validated after cleanup'
);
select ok(
  coalesce(not has_function_privilege(
    'authenticated',
    to_regprocedure('public.sanitize_lead_operation_metadata(public.audit_action,jsonb)'),
    'execute'
  ), false),
  'authenticated callers cannot execute the migration sanitizer'
);
select ok(
  coalesce(not has_function_privilege(
    'service_role',
    to_regprocedure('public.sanitize_lead_operation_metadata(public.audit_action,jsonb)'),
    'execute'
  ), false),
  'service callers cannot execute the migration sanitizer'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    'd2111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'round2-owner-a@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'round2-owner-b@example.com', 'fixture', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  );

insert into public.tenants (id, slug, display_name) values
  ('d2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task6-round2-a', 'Task 6 Round 2 A'),
  ('d2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'task6-round2-b', 'Task 6 Round 2 B');

insert into public.memberships (tenant_id, user_id, role) values
  ('d2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd2111111-1111-4111-8111-111111111111', 'client_owner'),
  ('d2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'd2222222-2222-4222-8222-222222222222', 'client_owner');

insert into public.sites (id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at) values
  ('d2100000-0000-4000-8000-000000000001', 'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://task6-round2-a.example.com', 'task6-round2-a', 'v1.fixture.a', now()),
  ('d2100000-0000-4000-8000-000000000002', 'd2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://task6-round2-b.example.com', 'task6-round2-b', 'v1.fixture.b', now());

insert into public.leads (
  id, tenant_id, site_id, external_event_id, status, preterminal_status,
  name_ciphertext, email_ciphertext, email_lookup_hash, notes_ciphertext,
  declared_source, budget_range, timeline_range, occurred_at
) values
  (
    'd2200000-0000-4000-8000-000000000001', 'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'd2100000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001',
    'qualified', null, 'v1.name.1', 'v1.email.1', repeat('1', 64), 'v1.notes.1',
    'direct', '5k-10k', '1-2-months', now()
  ),
  (
    'd2200000-0000-4000-8000-000000000002', 'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'd2100000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000002',
    'won', 'booked', 'v1.name.2', 'v1.email.2', repeat('2', 64), 'v1.notes.2',
    'referral', '10k-25k', '1-2-months', now()
  ),
  (
    'd2200000-0000-4000-8000-000000000003', 'd2bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'd2100000-0000-4000-8000-000000000002', 'd2300000-0000-4000-8000-000000000003',
    'lost', 'new', 'v1.name.3', 'v1.email.3', repeat('3', 64), 'v1.notes.3',
    'google', '5k-10k', '1-2-months', now()
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'd2111111-1111-4111-8111-111111111111', true);
select set_config('request.headers', '{}', true);

select throws_ok(
  $$ update public.leads set preterminal_status = 'new' where id = 'd2200000-0000-4000-8000-000000000001' $$,
  '42501', 'lead status changes require transaction function',
  'same-tenant direct preterminal forgery is denied on a nonterminal lead'
);
reset role;
update public.leads set preterminal_status = null where id = 'd2200000-0000-4000-8000-000000000001';
set local role authenticated;

select throws_ok(
  $$ update public.leads set preterminal_status = 'new' where id = 'd2200000-0000-4000-8000-000000000002' $$,
  '42501', 'lead status changes require transaction function',
  'same-tenant direct preterminal forgery is denied on a terminal lead'
);
reset role;
update public.leads set preterminal_status = 'booked' where id = 'd2200000-0000-4000-8000-000000000002';
set local role authenticated;

select throws_ok(
  $$ update public.leads set status = 'lost', preterminal_status = 'new' where id = 'd2200000-0000-4000-8000-000000000001' $$,
  '42501', 'lead status changes require transaction function',
  'combined direct status and preterminal writes are denied'
);
reset role;
update public.leads set status = 'qualified', preterminal_status = null where id = 'd2200000-0000-4000-8000-000000000001';
set local role authenticated;

select set_config('app.lead_status_transaction', 'true', true);
select set_config('app.lead_status_write_authorized', 'true', true);
select set_config('app.preterminal_status_write_authorized', 'true', true);
select throws_ok(
  $$ update public.leads set preterminal_status = 'booked' where id = 'd2200000-0000-4000-8000-000000000001' $$,
  '42501', 'lead status changes require transaction function',
  'spoofed old and invented GUCs cannot authorize preterminal writes'
);
reset role;
update public.leads set preterminal_status = null where id = 'd2200000-0000-4000-8000-000000000001';
set local role authenticated;

select lives_ok(
  $$ update public.leads set preterminal_status = 'booked' where id = 'd2200000-0000-4000-8000-000000000003' $$,
  'cross-tenant hidden preterminal writes affect zero rows without throwing'
);
reset role;
select is(
  (select preterminal_status::text from public.leads where id = 'd2200000-0000-4000-8000-000000000003'),
  'new', 'cross-tenant hidden preterminal state remains unchanged'
);
set local role authenticated;

select is(
  public.change_lead_status(
    'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd2200000-0000-4000-8000-000000000001',
    'lost', 'd2400000-0000-4000-8000-000000000010'
  ) ->> 'status',
  'lost', 'the legitimate status RPC can update lifecycle-owned fields'
);
select is(
  (select preterminal_status::text from public.leads where id = 'd2200000-0000-4000-8000-000000000001'),
  'qualified', 'the legitimate status RPC stores the actual preterminal status'
);
select throws_ok(
  $$ update public.leads set preterminal_status = 'new' where id = 'd2200000-0000-4000-8000-000000000001' $$,
  '42501', 'lead status changes require transaction function',
  'a terminal lead preterminal value cannot be forged before reopening'
);
select is(
  public.reopen_lead(
    'd2aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd2200000-0000-4000-8000-000000000001',
    'Customer resumed the qualified opportunity.', 'd2400000-0000-4000-8000-000000000011'
  ) ->> 'status',
  'qualified', 'reopen restores lifecycle-owned state, not a client-supplied storage value'
);
select is(
  (select preterminal_status::text from public.leads where id = 'd2200000-0000-4000-8000-000000000001'),
  null, 'reopen clears lifecycle-owned preterminal storage'
);

select throws_ok(
  $$ update public.audit_events set metadata = '{}' where request_id = 'd2400000-0000-4000-8000-000000000010' $$,
  '42501', 'permission denied for table audit_events',
  'authenticated callers still cannot update audit rows'
);
select throws_ok(
  $$ delete from public.audit_events where request_id = 'd2400000-0000-4000-8000-000000000010' $$,
  '42501', 'permission denied for table audit_events',
  'authenticated callers still cannot delete audit rows'
);

reset role;
set local role service_role;
select throws_ok(
  $$ update public.audit_events set metadata = '{}' where request_id = 'd2400000-0000-4000-8000-000000000010' $$,
  '42501', 'permission denied for table audit_events',
  'service callers still cannot update audit rows'
);
select throws_ok(
  $$ delete from public.audit_events where request_id = 'd2400000-0000-4000-8000-000000000010' $$,
  '42501', 'permission denied for table audit_events',
  'service callers still cannot delete audit rows'
);

reset role;
select ok(
  not exists (
    select 1
    from public.audit_events
    where action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded')
      and not public.is_sanitized_lead_operation_metadata(action, metadata)
  ),
  'fresh lifecycle audit rows remain strictly sanitized'
);

select * from finish();
rollback;
