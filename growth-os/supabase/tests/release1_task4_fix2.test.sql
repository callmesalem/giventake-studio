begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'fix2-owner@example.test',
  'test'
);

insert into public.tenants (id, slug, display_name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fix2-a', 'Fix 2 Tenant A');

insert into public.memberships (tenant_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client_owner');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok(
  $$
    create temp table fix2_no_port_result as
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'No Port Tenant',
      '  https://cdn.example.com/no-port.svg  ',
      '0057B8',
      'F4B400',
      'FFFFFF',
      'No Port Report',
      'aaaaaaaa-2000-0000-0000-000000000001'
    ) as value
  $$,
  'brand RPC accepts an HTTPS URL without an explicit port'
);
select is(
  (select value ->> 'logo_url' from fix2_no_port_result),
  'https://cdn.example.com/no-port.svg',
  'no-port URL is returned trimmed and canonical'
);

select lives_ok(
  $$
    create temp table fix2_max_port_result as
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Maximum Port Tenant',
      '  https://cdn.example.com:65535/max-port.svg  ',
      '0057B8',
      'F4B400',
      'FFFFFF',
      'Maximum Port Report',
      'aaaaaaaa-2000-0000-0000-000000000002'
    ) as value
  $$,
  'brand RPC accepts the maximum valid explicit URL port'
);
select is(
  (select value ->> 'logo_url' from fix2_max_port_result),
  'https://cdn.example.com:65535/max-port.svg',
  'maximum-port URL is returned trimmed and canonical'
);
select is(
  (select logo_url from public.brands where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'https://cdn.example.com:65535/max-port.svg',
  'maximum valid explicit port is stored'
);

select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Invalid Port', 'https://cdn.example.com:65536/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Invalid Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects port 65536'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Invalid Port', 'https://cdn.example.com:99999/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Invalid Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects port 99999'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Empty Port', 'https://cdn.example.com:/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Empty Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects an empty explicit port'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Negative Port', 'https://cdn.example.com:-1/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Negative Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects a negative explicit port'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Text Port', 'https://cdn.example.com:invalid/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Text Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects a nonnumeric explicit port'
);
select throws_ok(
  $$
    select public.update_tenant_brand(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Zero Port', 'https://cdn.example.com:0/logo.svg',
      '0057b8', 'f4b400', 'ffffff', 'Zero Port Report', gen_random_uuid()
    )
  $$,
  '22023',
  null,
  'brand RPC rejects explicit port zero under the shared 1-65535 policy'
);

select is(
  (select logo_url from public.brands where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'https://cdn.example.com:65535/max-port.svg',
  'invalid port calls roll back without changing the brand'
);
select is(
  (select count(*)::integer from public.audit_events where action = 'brand.updated'),
  2,
  'invalid port calls write no brand audit events'
);

select * from finish();
rollback;
