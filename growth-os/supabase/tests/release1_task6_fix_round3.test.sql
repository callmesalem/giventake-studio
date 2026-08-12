begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

select has_function(
  'private', 'write_lead_status_changed_audit',
  array['uuid', 'uuid', 'uuid', 'public.lead_status', 'public.lead_status', 'uuid'],
  'status audit insertion has an owner-private fixed-action helper'
);
select has_function(
  'private', 'write_lead_reopened_audit',
  array['uuid', 'uuid', 'uuid', 'public.lead_status', 'public.lead_status', 'integer', 'uuid'],
  'reopen audit insertion has an owner-private fixed-action helper'
);
select has_function(
  'private', 'write_revenue_recorded_audit',
  array['uuid', 'uuid', 'uuid', 'date', 'integer', 'uuid'],
  'revenue audit insertion has an owner-private fixed-action helper'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.write_audit_event(uuid,public.audit_action,text,uuid,uuid,jsonb,uuid)',
    'execute'
  ),
  'service role retains the generic audit writer for non-lifecycle work'
);
select ok(
  not has_function_privilege(
    'service_role',
    to_regprocedure('private.write_lead_status_changed_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,uuid)'),
    'execute'
  ),
  'service role cannot execute the private status audit helper'
);
select ok(
  not has_function_privilege(
    'service_role',
    to_regprocedure('private.write_lead_reopened_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,integer,uuid)'),
    'execute'
  ),
  'service role cannot execute the private reopen audit helper'
);
select ok(
  not has_function_privilege(
    'service_role',
    to_regprocedure('private.write_revenue_recorded_audit(uuid,uuid,uuid,date,integer,uuid)'),
    'execute'
  ),
  'service role cannot execute the private revenue audit helper'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'private.write_lead_status_changed_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'private.write_lead_reopened_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,integer,uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'private.write_revenue_recorded_audit(uuid,uuid,uuid,date,integer,uuid)'::regprocedure),
  'private helpers run as invokers and observe the lifecycle RPC owner context'
);
select ok(
  not has_function_privilege('authenticated', 'private.write_lead_status_changed_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.write_lead_reopened_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,integer,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.write_revenue_recorded_audit(uuid,uuid,uuid,date,integer,uuid)', 'execute'),
  'authenticated callers cannot execute any private lifecycle helper'
);
select ok(
  not has_function_privilege('anon', 'private.write_lead_status_changed_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,uuid)', 'execute')
  and not has_function_privilege('anon', 'private.write_lead_reopened_audit(uuid,uuid,uuid,public.lead_status,public.lead_status,integer,uuid)', 'execute')
  and not has_function_privilege('anon', 'private.write_revenue_recorded_audit(uuid,uuid,uuid,date,integer,uuid)', 'execute'),
  'anonymous callers cannot execute any private lifecycle helper'
);
select ok(
  position('private.write_lead_status_changed_audit' in pg_get_functiondef('public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure)) > 0
  and position('public.write_audit_event' in pg_get_functiondef('public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure)) = 0
  and position('private.write_lead_reopened_audit' in pg_get_functiondef('public.reopen_lead(uuid,uuid,text,uuid)'::regprocedure)) > 0
  and position('public.write_audit_event' in pg_get_functiondef('public.reopen_lead(uuid,uuid,text,uuid)'::regprocedure)) = 0
  and position('private.write_revenue_recorded_audit' in pg_get_functiondef('public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure)) > 0
  and position('public.write_audit_event' in pg_get_functiondef('public.record_lead_revenue(uuid,uuid,bigint,text,date,text,uuid)'::regprocedure)) = 0,
  'each lifecycle RPC uses only its corresponding fixed-action helper'
);

select ok(
  public.is_sanitized_lead_operation_metadata(
    'lead.status_changed',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won"}'
  ),
  'exact status metadata is accepted'
);
select ok(
  not public.is_sanitized_lead_operation_metadata(
    'lead.status_changed',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won","provider":"google_analytics"}'
  ),
  'status metadata rejects an otherwise allowlisted extra key'
);
select ok(
  public.is_sanitized_lead_operation_metadata(
    'lead.reopened',
    '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":1}'
  ),
  'exact reopen metadata is accepted'
);
select ok(
  not public.is_sanitized_lead_operation_metadata(
    'lead.reopened',
    '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":1,"reason":"private text"}'
  ),
  'reopen metadata rejects reason free text'
);
select ok(
  not public.is_sanitized_lead_operation_metadata(
    'lead.reopened',
    '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":"1"}'
  ),
  'reopen metadata requires a numeric count'
);
select ok(
  public.is_sanitized_lead_operation_metadata(
    'revenue.recorded',
    '{"change_code":"revenue_recorded","recorded_on":"2026-08-12","superseded_count":0}'
  ),
  'exact revenue metadata is accepted'
);
select ok(
  not public.is_sanitized_lead_operation_metadata(
    'revenue.recorded',
    '{"change_code":"revenue_recorded","recorded_on":"2026-08-12","superseded_count":0,"amount_minor":500}'
  ),
  'revenue metadata rejects amount values'
);
select ok(
  not public.is_sanitized_lead_operation_metadata(
    'revenue.recorded',
    '{"change_code":"revenue_recorded","recorded_on":"2026-08-12","superseded_count":0,"provider":"google_analytics"}'
  ),
  'revenue metadata rejects arbitrary allowlisted extras'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  'e3111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'round3-owner@example.com', 'fixture', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);

insert into public.tenants (id, slug, display_name) values
  ('e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task6-round3', 'Task 6 Round 3');
insert into public.memberships (tenant_id, user_id, role) values
  ('e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3111111-1111-4111-8111-111111111111', 'client_owner');
insert into public.sites (id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at) values
  (
    'e3100000-0000-4000-8000-000000000001', 'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'https://task6-round3.example.com', 'task6-round3', 'v1.fixture', now()
  );
insert into public.leads (
  id, tenant_id, site_id, external_event_id, status,
  name_ciphertext, email_ciphertext, email_lookup_hash, notes_ciphertext,
  declared_source, budget_range, timeline_range, occurred_at
) values (
  'e3200000-0000-4000-8000-000000000001', 'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'e3100000-0000-4000-8000-000000000001', 'e3300000-0000-4000-8000-000000000001',
  'qualified', 'v1.name', 'v1.email', repeat('3', 64), 'v1.notes',
  'direct', '5k-10k', '1-2-months', now()
);

set local role service_role;
select throws_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lead.status_changed', 'lead',
    'e3200000-0000-4000-8000-000000000001', 'e3400000-0000-4000-8000-000000000001',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won"}', null
  ) $$,
  '42501', 'lifecycle audit actions require lifecycle transaction function',
  'service role cannot fabricate status events through the generic writer'
);
select throws_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lead.reopened', 'lead',
    'e3200000-0000-4000-8000-000000000001', 'e3400000-0000-4000-8000-000000000002',
    '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":0}', null
  ) $$,
  '42501', 'lifecycle audit actions require lifecycle transaction function',
  'service role cannot fabricate reopen events through the generic writer'
);
select throws_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'revenue.recorded', 'lead',
    'e3200000-0000-4000-8000-000000000001', 'e3400000-0000-4000-8000-000000000003',
    '{"change_code":"revenue_recorded","recorded_on":"2026-08-12","superseded_count":0}', null
  ) $$,
  '42501', 'lifecycle audit actions require lifecycle transaction function',
  'service role cannot fabricate revenue events through the generic writer'
);
select lives_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'retention.completed', 'tenant',
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3400000-0000-4000-8000-000000000004',
    '{"lead_rows_deleted":0,"audit_rows_deleted":0,"has_more":false}', null
  ) $$,
  'service role retains generic retention audit writes'
);
select lives_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'connector.synced', 'connection',
    null, 'e3400000-0000-4000-8000-000000000005',
    '{"provider":"google_analytics","rows_processed":0}', null
  ) $$,
  'service role retains generic connector audit writes'
);

reset role;
select is(
  (select count(*)::integer from public.audit_events where request_id in (
    'e3400000-0000-4000-8000-000000000004', 'e3400000-0000-4000-8000-000000000005'
  )),
  2, 'both permitted non-lifecycle generic events commit'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'e3111111-1111-4111-8111-111111111111', true);
select set_config('request.headers', '{}', true);
select throws_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lead.status_changed', 'lead',
    'e3200000-0000-4000-8000-000000000001', 'e3400000-0000-4000-8000-000000000006',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won"}',
    'e3111111-1111-4111-8111-111111111111'
  ) $$,
  '42501', null, 'authenticated callers cannot invoke the generic writer'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.write_audit_event(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lead.status_changed', 'lead',
    'e3200000-0000-4000-8000-000000000001', 'e3400000-0000-4000-8000-000000000007',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won"}', null
  ) $$,
  '42501', null, 'anonymous callers cannot invoke the generic writer'
);

reset role;
set local role authenticated;
select is(
  public.change_lead_status(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3200000-0000-4000-8000-000000000001',
    'won', 'e3400000-0000-4000-8000-000000000010'
  ) ->> 'status',
  'won', 'legitimate status RPC still commits'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id = 'e3400000-0000-4000-8000-000000000010' and action = 'lead.status_changed'),
  1, 'legitimate status RPC creates exactly one matching event'
);
select is(
  public.record_lead_revenue(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3200000-0000-4000-8000-000000000001',
    500, 'USD', current_date, null, 'e3400000-0000-4000-8000-000000000011'
  ) ->> 'amount_minor',
  '500', 'legitimate revenue RPC still commits'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id = 'e3400000-0000-4000-8000-000000000011' and action = 'revenue.recorded'),
  1, 'legitimate revenue RPC creates exactly one matching event'
);
select is(
  public.reopen_lead(
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3200000-0000-4000-8000-000000000001',
    'Customer returned for another qualified review.', 'e3400000-0000-4000-8000-000000000012'
  ) ->> 'status',
  'qualified', 'legitimate reopen RPC still commits'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id = 'e3400000-0000-4000-8000-000000000012' and action = 'lead.reopened'),
  1, 'legitimate reopen RPC creates exactly one matching event'
);
select is(
  (select count(*)::integer from public.audit_events
   where request_id in (
     'e3400000-0000-4000-8000-000000000010',
     'e3400000-0000-4000-8000-000000000011',
     'e3400000-0000-4000-8000-000000000012'
   )),
  3, 'lifecycle transactions emit no duplicate audit events'
);

reset role;
select ok(
  not exists (
    select 1 from public.audit_events
    where action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded')
      and not public.is_sanitized_lead_operation_metadata(action, metadata)
  ),
  'all committed lifecycle metadata uses its exact action contract'
);

select throws_ok(
  $$ insert into public.audit_events (
    tenant_id, actor_user_id, actor_kind, action, target_type, target_id, request_id, metadata
  ) values (
    'e3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'e3111111-1111-4111-8111-111111111111', 'user',
    'lead.status_changed', 'lead', 'e3200000-0000-4000-8000-000000000001',
    'e3400000-0000-4000-8000-000000000013',
    '{"change_code":"lead_status_changed","previous_status":"qualified","current_status":"won","provider":"google_analytics"}'
  ) $$,
  '23514', null, 'exact lifecycle constraint rejects extras even for a privileged insert'
);

set local role service_role;
select throws_ok(
  $$ update public.audit_events set metadata = '{}' where request_id = 'e3400000-0000-4000-8000-000000000004' $$,
  '42501', 'permission denied for table audit_events',
  'service role still cannot update audit rows'
);
select throws_ok(
  $$ delete from public.audit_events where request_id = 'e3400000-0000-4000-8000-000000000004' $$,
  '42501', 'permission denied for table audit_events',
  'service role still cannot delete audit rows'
);

reset role;
select * from finish();
rollback;
