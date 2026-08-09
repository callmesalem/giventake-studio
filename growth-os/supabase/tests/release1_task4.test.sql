begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-task4@example.com',
    'test'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-task4@example.com',
    'test'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ordinary-task4@example.com',
    'test'
  );

insert into public.tenants (id, slug, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'task4-a', 'Task 4 Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'task4-b', 'Task 4 Tenant B');

insert into public.memberships (tenant_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client_owner');

insert into public.platform_admins (user_id, granted_by)
values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$
    select public.write_audit_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'brand.updated',
      'brand',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-1000-0000-0000-000000000001',
      '{"arbitrary_key":"value"}'::jsonb,
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  '22023',
  null,
  'database audit sanitizer rejects unsupported metadata keys'
);
select throws_ok(
  $$
    select public.write_audit_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'brand.updated',
      'brand',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-1000-0000-0000-000000000006',
      '{"reason_code":"private lead notes belong here"}'::jsonb,
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  '22023',
  null,
  'database audit sanitizer rejects free text in supported code fields'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Task 4 Tenant A',
      'https://cdn.example.com/task4-a.svg',
      '0057b8',
      'f4b400',
      'ffffff',
      'Task 4 Growth Report',
      'aaaaaaaa-1000-0000-0000-000000000002'
    )
  $$,
  'owner can update its active tenant brand transactionally'
);
select is(
  (select display_name from public.brands where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Task 4 Tenant A',
  'brand mutation is persisted'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and action = 'brand.updated'
  ),
  1,
  'brand mutation persists its audit proof in the same call'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Low Contrast Tenant',
      'https://cdn.example.com/low-contrast.svg',
      'ffffff',
      'f4b400',
      '777777',
      'Low Contrast Report',
      'aaaaaaaa-1000-0000-0000-000000000007'
    )
  $$,
  '22023',
  null,
  'database brand mutation rejects contrast below 4.5 to 1'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Forbidden Tenant',
      'https://cdn.example.com/forbidden.svg',
      '0057b8',
      'f4b400',
      'ffffff',
      'Forbidden Report',
      'aaaaaaaa-1000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  'owner cannot update another tenant brand'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Rolled Back Name',
      'https://cdn.example.com/rollback.svg',
      '0057b8',
      'f4b400',
      'ffffff',
      'Rolled Back Report',
      null
    )
  $$,
  '22004',
  null,
  'audit failure aborts the brand mutation'
);
select is(
  (select display_name from public.brands where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Task 4 Tenant A',
  'failed audit leaves branding unchanged'
);

reset role;
select throws_ok(
  $$
    select public.start_support_session(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '33333333-3333-3333-3333-333333333333',
      'Investigating a reported dashboard discrepancy.',
      now() + interval '30 minutes'
    )
  $$,
  '42501',
  null,
  'ordinary user cannot start support'
);
select throws_ok(
  $$
    select public.start_support_session(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      '',
      now() + interval '30 minutes'
    )
  $$,
  '22023',
  null,
  'support start requires a reason'
);
select throws_ok(
  $$
    select public.start_support_session(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      'Investigating a reported dashboard discrepancy.',
      now() + interval '61 minutes'
    )
  $$,
  '22023',
  null,
  'support duration cannot exceed 60 minutes'
);

create temp table task4_support_sessions as
select public.start_support_session(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'Investigating the first reported dashboard discrepancy.',
  now() + interval '30 minutes'
) as id
union all
select public.start_support_session(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'Investigating the second reported dashboard discrepancy.',
  now() + interval '30 minutes'
) as id;

select is(
  (
    select count(*)::integer
    from public.audit_events
    where action = 'support.started'
      and target_id in (select id from task4_support_sessions)
  ),
  2,
  'every support start has persisted audit proof'
);
select lives_ok(
  $$
    select public.end_support_session(
      (select id from task4_support_sessions order by id limit 1),
      '22222222-2222-2222-2222-222222222222',
      'aaaaaaaa-1000-0000-0000-000000000004'
    )
  $$,
  'support end revokes the exact active session'
);
select is(
  (
    select count(*)::integer
    from public.support_sessions
    where id = (select id from task4_support_sessions order by id limit 1)
      and revoked_at is not null
  ),
  1,
  'selected support session is revoked'
);
select is(
  (
    select count(*)::integer
    from public.support_sessions
    where id = (select id from task4_support_sessions order by id desc limit 1)
      and revoked_at is null
  ),
  1,
  'another tenant support session remains active'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where action = 'support.ended'
      and target_id = (select id from task4_support_sessions order by id limit 1)
  ),
  1,
  'support end writes audit proof for the exact session'
);
select throws_ok(
  $$
    select public.end_support_session(
      (select id from task4_support_sessions order by id limit 1),
      '33333333-3333-3333-3333-333333333333',
      'aaaaaaaa-1000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  'ordinary user cannot end support'
);
select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in ('start_support_session', 'end_support_session')
      and grantee = 'authenticated'
  ),
  0,
  'support mutation functions are not executable by authenticated clients'
);

select * from finish();
rollback;
