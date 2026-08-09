begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

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
    '44444444-4444-4444-4444-444444444444',
    'authenticated',
    'authenticated',
    'inviter@example.test',
    crypt('inviter-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated',
    'authenticated',
    'invitee@example.test',
    crypt('invitee-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

insert into public.tenants (id, slug, display_name)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'auth-test', 'Auth Test');

insert into public.platform_admins (user_id, granted_by)
values (
  '44444444-4444-4444-4444-444444444444',
  '44444444-4444-4444-4444-444444444444'
);

insert into public.membership_invitations (
  id,
  tenant_id,
  email,
  invited_by,
  token_hash,
  expires_at,
  created_at
)
values (
  '66666666-6666-6666-6666-666666666666',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'invitee@example.test',
  '44444444-4444-4444-4444-444444444444',
  repeat('a', 64),
  now() - interval '1 hour',
  now() - interval '25 hours'
);

create temporary table prepared_invitation as
select public.prepare_membership_invitation(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'invitee@example.test',
  '44444444-4444-4444-4444-444444444444',
  repeat('b', 64),
  now() + interval '24 hours',
  '77777777-7777-7777-7777-777777777777'
) as id;

select ok(
  (select superseded_at is not null from public.membership_invitations where id = '66666666-6666-6666-6666-666666666666'),
  'expired pending invitation is superseded before reinvite'
);
select isnt(
  (select id from prepared_invitation),
  '66666666-6666-6666-6666-666666666666'::uuid,
  'reinvite creates a usable invitation'
);
select is(
  (
    select count(*)
    from public.membership_invitations
    where tenant_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and email = 'invitee@example.test'
      and accepted_at is null
      and superseded_at is null
  )::bigint,
  1::bigint,
  'only one current invitation remains'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'membership.invited'
      and target_id = (select id from prepared_invitation)
  )::bigint,
  1::bigint,
  'invitation preparation is audited transactionally'
);

select is(
  public.prepare_membership_invitation(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'invitee@example.test',
    '44444444-4444-4444-4444-444444444444',
    repeat('c', 64),
    now() + interval '24 hours',
    '88888888-8888-8888-8888-888888888888'
  ),
  (select id from prepared_invitation),
  'preparation retry reuses the current usable invitation'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'membership.invited'
      and target_id = (select id from prepared_invitation)
  )::bigint,
  1::bigint,
  'preparation retry does not duplicate its audit event'
);

insert into public.membership_invitations (
  id,
  tenant_id,
  email,
  invited_by,
  token_hash,
  expires_at
)
values (
  'aaaaaaaa-6666-6666-6666-666666666666',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'repair@example.test',
  '44444444-4444-4444-4444-444444444444',
  repeat('d', 64),
  now() + interval '24 hours'
);

select is(
  public.prepare_membership_invitation(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'repair@example.test',
    '44444444-4444-4444-4444-444444444444',
    repeat('e', 64),
    now() + interval '24 hours',
    'bbbbbbbb-7777-7777-7777-777777777777'
  ),
  'aaaaaaaa-6666-6666-6666-666666666666'::uuid,
  'retry reuses a durable pre-existing invitation'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'membership.invited'
      and target_id = 'aaaaaaaa-6666-6666-6666-666666666666'
  )::bigint,
  1::bigint,
  'retry repairs a missing invitation audit before email'
);

select ok(
  public.accept_membership_invitation(
    (select id from prepared_invitation),
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '55555555-5555-5555-5555-555555555555',
    'invitee@example.test',
    '99999999-9999-9999-9999-999999999999'
  ),
  'current invitation is accepted'
);
select is(
  (
    select count(*) from public.memberships
    where tenant_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and user_id = '55555555-5555-5555-5555-555555555555'
      and role = 'client_owner'
  )::bigint,
  1::bigint,
  'acceptance grants one client-owner membership'
);
select is(
  (
    select accepted_user_id
    from public.membership_invitations
    where id = (select id from prepared_invitation)
  ),
  '55555555-5555-5555-5555-555555555555'::uuid,
  'accepted invitation records its user'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'membership.changed'
      and target_id = (select id from prepared_invitation)
  )::bigint,
  1::bigint,
  'membership acceptance is audited transactionally'
);

select ok(
  public.accept_membership_invitation(
    (select id from prepared_invitation),
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '55555555-5555-5555-5555-555555555555',
    'invitee@example.test',
    'aaaaaaaa-7777-7777-7777-777777777777'
  ),
  'acceptance retry succeeds after a later cleanup failure'
);
select is(
  (
    select count(*) from public.memberships
    where tenant_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and user_id = '55555555-5555-5555-5555-555555555555'
  )::bigint,
  1::bigint,
  'acceptance retry does not duplicate membership'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action = 'membership.changed'
      and target_id = (select id from prepared_invitation)
  )::bigint,
  1::bigint,
  'acceptance retry does not duplicate its audit event'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_membership_invitation(uuid,text,uuid,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot prepare invitations'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.accept_membership_invitation(uuid,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot accept invitations directly'
);

select * from finish();
rollback;
