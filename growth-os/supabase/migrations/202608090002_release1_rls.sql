create or replace function public.is_client_owner(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
      and m.role = 'client_owner'
  );
$$;

create or replace function public.has_active_support_session(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.support_sessions s
    join public.platform_admins a on a.user_id = s.admin_user_id
    where s.tenant_id = target_tenant
      and s.admin_user_id = (select auth.uid())
      and s.revoked_at is null
      and s.expires_at > now()
  );
$$;

create or replace function public.can_access_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.support_sessions s
    join public.platform_admins a on a.user_id = s.admin_user_id
    where s.tenant_id = target_tenant
      and s.admin_user_id = (select auth.uid())
      and s.revoked_at is null
      and s.expires_at > now()
  );
$$;

create or replace function public.write_audit_event(
  target_tenant uuid,
  event_action public.audit_action,
  event_target_type text,
  event_target_id uuid,
  event_request_id uuid,
  event_metadata jsonb,
  event_actor_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if not exists (select 1 from public.tenants where id = target_tenant) then
    raise exception using errcode = '23503', message = 'tenant not found';
  end if;

  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;

  if not public.is_sanitized_audit_metadata(coalesce(event_metadata, '{}'::jsonb)) then
    raise exception using errcode = '22023', message = 'audit metadata is not sanitized';
  end if;

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
    target_tenant,
    event_actor_user_id,
    case when event_actor_user_id is null then 'system' else 'user' end,
    event_action,
    event_target_type,
    event_target_id,
    event_request_id,
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'tenants',
    'platform_admins',
    'memberships',
    'brands',
    'membership_invitations',
    'support_sessions',
    'sites',
    'connections',
    'provider_accounts',
    'sync_runs',
    'sync_payloads',
    'campaigns',
    'leads',
    'ingest_idempotency',
    'attribution_evidence',
    'attribution_touches',
    'revenue_outcomes',
    'campaign_metrics_daily',
    'consent_receipts',
    'privacy_requests',
    'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
  end loop;
end;
$$;

create policy tenants_select
on public.tenants
for select
to authenticated
using (public.can_access_tenant(id));

create policy tenants_insert
on public.tenants
for insert
to authenticated
with check (false);

create policy tenants_update
on public.tenants
for update
to authenticated
using (public.is_client_owner(id))
with check (public.is_client_owner(id));

create policy tenants_delete
on public.tenants
for delete
to authenticated
using (false);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'memberships',
    'brands',
    'membership_invitations',
    'sites',
    'connections',
    'provider_accounts',
    'sync_runs',
    'sync_payloads',
    'campaigns',
    'leads',
    'ingest_idempotency',
    'attribution_touches',
    'revenue_outcomes',
    'campaign_metrics_daily',
    'consent_receipts',
    'privacy_requests'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_tenant(tenant_id))',
      target_table || '_tenant_select',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_client_owner(tenant_id))',
      target_table || '_owner_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_client_owner(tenant_id)) with check (public.is_client_owner(tenant_id))',
      target_table || '_owner_update',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_client_owner(tenant_id))',
      target_table || '_owner_delete',
      target_table
    );
  end loop;
end;
$$;

create policy attribution_evidence_tenant_select
on public.attribution_evidence
for select
to authenticated
using (public.can_access_tenant(tenant_id));

create policy attribution_evidence_owner_insert
on public.attribution_evidence
for insert
to authenticated
with check (public.is_client_owner(tenant_id));

create policy attribution_evidence_update_denied
on public.attribution_evidence
for update
to authenticated
using (false)
with check (false);

create policy attribution_evidence_delete_denied
on public.attribution_evidence
for delete
to authenticated
using (false);

create policy audit_events_tenant_select
on public.audit_events
for select
to authenticated
using (public.can_access_tenant(tenant_id));

create policy audit_events_insert_via_function
on public.audit_events
for insert
to authenticated
with check (false);

create policy support_sessions_select_denied
on public.support_sessions
for select
to authenticated
using (false);

create policy support_sessions_insert_denied
on public.support_sessions
for insert
to authenticated
with check (false);

create policy support_sessions_update_denied
on public.support_sessions
for update
to authenticated
using (false)
with check (false);

create policy support_sessions_delete_denied
on public.support_sessions
for delete
to authenticated
using (false);

create policy platform_admins_select_denied
on public.platform_admins
for select
to authenticated
using (false);

create policy platform_admins_insert_denied
on public.platform_admins
for insert
to authenticated
with check (false);

create policy platform_admins_update_denied
on public.platform_admins
for update
to authenticated
using (false)
with check (false);

create policy platform_admins_delete_denied
on public.platform_admins
for delete
to authenticated
using (false);

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete
on table
  public.tenants,
  public.memberships,
  public.brands,
  public.membership_invitations,
  public.sites,
  public.connections,
  public.provider_accounts,
  public.sync_runs,
  public.sync_payloads,
  public.campaigns,
  public.leads,
  public.ingest_idempotency,
  public.attribution_touches,
  public.revenue_outcomes,
  public.campaign_metrics_daily,
  public.consent_receipts,
  public.privacy_requests
to authenticated;

grant select, insert on public.attribution_evidence to authenticated;
grant select on public.audit_events to authenticated;

grant select, insert, update, delete
on table
  public.tenants,
  public.memberships,
  public.brands,
  public.membership_invitations,
  public.sites,
  public.connections,
  public.provider_accounts,
  public.sync_runs,
  public.sync_payloads,
  public.campaigns,
  public.leads,
  public.ingest_idempotency,
  public.attribution_touches,
  public.revenue_outcomes,
  public.campaign_metrics_daily,
  public.consent_receipts,
  public.privacy_requests
to service_role;

grant select, insert on public.attribution_evidence to service_role;
revoke all on public.audit_events from service_role;
grant select on public.audit_events to service_role;
grant select on public.platform_admins to service_role;
grant select, update on public.support_sessions to service_role;

revoke all on function public.is_client_owner(uuid) from public;
revoke all on function public.has_active_support_session(uuid) from public;
revoke all on function public.can_access_tenant(uuid) from public;
revoke all on function public.write_audit_event(
  uuid,
  public.audit_action,
  text,
  uuid,
  uuid,
  jsonb,
  uuid
) from public;

grant execute on function public.is_client_owner(uuid) to authenticated, service_role;
grant execute on function public.has_active_support_session(uuid) to authenticated, service_role;
grant execute on function public.can_access_tenant(uuid) to authenticated, service_role;
grant execute on function public.write_audit_event(
  uuid,
  public.audit_action,
  text,
  uuid,
  uuid,
  jsonb,
  uuid
) to service_role;
