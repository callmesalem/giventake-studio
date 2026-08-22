begin;

create extension if not exists pgtap with schema extensions;
set search_path = video_studio, public, extensions;

select plan(10);

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
    'operator-a@example.test',
    crypt('operator-a-password', gen_salt('bf')),
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
    'reviewer-a@example.test',
    crypt('reviewer-a-password', gen_salt('bf')),
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
    'operator-b@example.test',
    crypt('operator-b-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

insert into video_studio.tenants (id, slug, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tenant-a', 'Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tenant-b', 'Tenant B');

insert into video_studio.memberships (tenant_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'operator'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'reviewer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'operator');

insert into video_studio.brands (id, tenant_id, name, website, call_to_action)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000010',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Tenant A',
    'https://a.example.test',
    'Book a call'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000010',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Tenant B',
    'https://b.example.test',
    'Book a call'
  );

insert into video_studio.campaigns (
  id,
  tenant_id,
  brand_id,
  name,
  goal,
  offer,
  audience,
  call_to_action,
  budget_cents
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000020',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-0000-0000-000000000010',
    'Campaign A',
    'Create qualified inquiries',
    'Agentic development',
    'Owners',
    'Book a call',
    5000
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000020',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-0000-0000-000000000010',
    'Campaign B',
    'Create qualified inquiries',
    'Agentic development',
    'Owners',
    'Book a call',
    5000
  );

insert into video_studio.campaign_revisions (
  id,
  tenant_id,
  campaign_id,
  number,
  brief,
  storyboard,
  created_by
)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000030',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-0000-0000-000000000020',
    1,
    '{"name":"Campaign A"}',
    '[{"order":1,"durationSeconds":5,"purpose":"hook"}]',
    '11111111-1111-1111-1111-111111111111'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
  (select count(*) from video_studio.campaigns)::bigint,
  1::bigint,
  'operator sees only campaigns from own tenant'
);
select is_empty(
  $$
    select * from video_studio.campaigns
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  $$,
  'operator cannot query another tenant campaign'
);
select lives_ok(
  $$
    insert into video_studio.campaigns (
      tenant_id, brand_id, name, goal, offer, audience, call_to_action, budget_cents
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-0000-0000-000000000010',
      'Operator campaign',
      'Create qualified inquiries',
      'Agentic development',
      'Owners',
      'Book a call',
      100
    )
  $$,
  'operator can create a campaign for own tenant'
);
select lives_ok(
  $$
    select video_studio.write_audit_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'campaign.created',
      'campaign',
      'aaaaaaaa-0000-0000-0000-000000000020',
      'aaaaaaaa-0000-0000-0000-000000000040',
      '{"status":"draft"}'::jsonb
    )
  $$,
  'operator can append a sanitized audit event through the function'
);
select throws_ok(
  $$ insert into video_studio.audit_events (tenant_id, action, target_type, request_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tampered', 'campaign', 'aaaaaaaa-0000-0000-0000-000000000041') $$,
  '42501',
  null,
  'audit events cannot be inserted directly'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is(
  (select count(*) from video_studio.campaigns)::bigint,
  2::bigint,
  'reviewer can read tenant campaigns'
);
select throws_ok(
  $$
    insert into video_studio.campaigns (
      tenant_id, brand_id, name, goal, offer, audience, call_to_action, budget_cents
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-0000-0000-000000000010',
      'Forbidden reviewer campaign',
      'Create qualified inquiries',
      'Agentic development',
      'Owners',
      'Book a call',
      100
    )
  $$,
  '42501',
  null,
  'reviewer cannot create campaigns'
);
select lives_ok(
  $$
    insert into video_studio.approvals (tenant_id, campaign_id, revision_id, kind)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-0000-0000-000000000020',
      'aaaaaaaa-0000-0000-0000-000000000030',
      'storyboard'
    )
  $$,
  'reviewer can approve a tenant revision'
);
select throws_ok(
  $$ update video_studio.audit_events set action = 'tampered' $$,
  '42501',
  null,
  'audit events are immutable'
);
select is_empty(
  $$
    select * from video_studio.memberships
    where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  $$,
  'reviewer cannot read another tenant memberships'
);

select * from finish();
rollback;
