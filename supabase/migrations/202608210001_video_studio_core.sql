create schema if not exists video_studio;

create type video_studio.membership_role as enum ('operator', 'reviewer', 'viewer');
create type video_studio.campaign_status as enum (
  'draft',
  'planned',
  'awaiting_storyboard_approval',
  'approved_for_generation',
  'rendering',
  'awaiting_edit_approval',
  'exported',
  'handed_off',
  'archived',
  'failed'
);
create type video_studio.approval_kind as enum ('storyboard', 'edit', 'handoff');
create type video_studio.render_status as enum (
  'queued',
  'submitted',
  'rendering',
  'completed',
  'failed',
  'cancelled'
);
create type video_studio.export_profile as enum ('vertical', 'square', 'landscape');
create type video_studio.export_status as enum ('ready', 'handed_off');

create function video_studio.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function video_studio.is_safe_audit_metadata(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and coalesce(
      (
        select bool_and(
          key ~ '^[a-z][a-z0-9_]{0,79}$'
          and jsonb_typeof(item) in ('string', 'number', 'boolean', 'null')
          and (jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') <= 500)
        )
        from jsonb_each(value) as entry(key, item)
      ),
      true
    );
$$;

create table video_studio.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, slug)
);

create table video_studio.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role video_studio.membership_role not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);

create table video_studio.brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  website text not null check (char_length(website) between 3 and 255),
  call_to_action text not null check (char_length(call_to_action) between 1 and 500),
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table video_studio.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  brand_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  goal text not null check (char_length(goal) between 1 and 1000),
  offer text not null check (char_length(offer) between 1 and 1000),
  audience text not null check (char_length(audience) between 1 and 1000),
  call_to_action text not null check (char_length(call_to_action) between 1 and 500),
  budget_cents integer not null check (budget_cents > 0 and budget_cents <= 5000000),
  status video_studio.campaign_status not null default 'draft',
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint campaigns_tenant_brand_fkey
    foreign key (tenant_id, brand_id)
    references video_studio.brands (tenant_id, id)
    on delete restrict
);

create table video_studio.campaign_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  campaign_id uuid not null,
  number integer not null check (number > 0),
  brief jsonb not null check (jsonb_typeof(brief) = 'object'),
  storyboard jsonb not null check (jsonb_typeof(storyboard) = 'array'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, id),
  unique (tenant_id, campaign_id, number),
  constraint campaign_revisions_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references video_studio.campaigns (tenant_id, id)
    on delete cascade
);

alter table video_studio.campaigns
  add constraint campaigns_tenant_current_revision_fkey
  foreign key (tenant_id, current_revision_id)
  references video_studio.campaign_revisions (tenant_id, id)
  on delete set null;

create table video_studio.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  campaign_id uuid not null,
  revision_id uuid not null,
  kind video_studio.approval_kind not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, campaign_id, revision_id, kind, actor_user_id),
  constraint approvals_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references video_studio.campaigns (tenant_id, id)
    on delete cascade,
  constraint approvals_tenant_revision_fkey
    foreign key (tenant_id, campaign_id, revision_id)
    references video_studio.campaign_revisions (tenant_id, campaign_id, id)
    on delete cascade
);

create table video_studio.render_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  campaign_id uuid not null,
  revision_id uuid not null,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,78}$'),
  model text not null check (char_length(model) between 3 and 120),
  requested_budget_cents integer not null check (requested_budget_cents > 0),
  reserved_cents integer not null check (reserved_cents >= 0),
  idempotency_key uuid not null,
  worker_job_id text unique check (worker_job_id is null or char_length(worker_job_id) between 8 and 128),
  status video_studio.render_status not null default 'queued',
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_cents <= requested_budget_cents),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, idempotency_key),
  constraint render_jobs_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references video_studio.campaigns (tenant_id, id)
    on delete restrict,
  constraint render_jobs_tenant_revision_fkey
    foreign key (tenant_id, campaign_id, revision_id)
    references video_studio.campaign_revisions (tenant_id, campaign_id, id)
    on delete restrict
);

create table video_studio.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  render_job_id uuid,
  storage_key text not null check (char_length(storage_key) between 1 and 500),
  media_type text not null check (media_type in ('video', 'image', 'audio', 'caption')),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, storage_key),
  unique (tenant_id, id),
  constraint assets_tenant_render_job_fkey
    foreign key (tenant_id, render_job_id)
    references video_studio.render_jobs (tenant_id, id)
    on delete set null
);

create table video_studio.exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  campaign_id uuid not null,
  revision_id uuid not null,
  render_job_id uuid not null,
  asset_id uuid,
  profile video_studio.export_profile not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  status video_studio.export_status not null default 'ready',
  created_at timestamptz not null default now(),
  unique (tenant_id, render_job_id, profile),
  constraint exports_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references video_studio.campaigns (tenant_id, id)
    on delete restrict,
  constraint exports_tenant_revision_fkey
    foreign key (tenant_id, campaign_id, revision_id)
    references video_studio.campaign_revisions (tenant_id, campaign_id, id)
    on delete restrict,
  constraint exports_tenant_render_job_fkey
    foreign key (tenant_id, render_job_id)
    references video_studio.render_jobs (tenant_id, id)
    on delete restrict,
  constraint exports_tenant_asset_fkey
    foreign key (tenant_id, asset_id)
    references video_studio.assets (tenant_id, id)
    on delete set null
);

create table video_studio.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references video_studio.tenants(id) on delete cascade,
  campaign_id uuid,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_]{0,79}(\.[a-z][a-z0-9_]{0,79})?$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_]{0,79}$'),
  target_id uuid,
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (video_studio.is_safe_audit_metadata(metadata)),
  created_at timestamptz not null default now(),
  constraint audit_events_tenant_campaign_fkey
    foreign key (tenant_id, campaign_id)
    references video_studio.campaigns (tenant_id, id)
    on delete set null
);

create trigger tenants_touch_updated_at
before update on video_studio.tenants
for each row execute function video_studio.touch_updated_at();

create trigger brands_touch_updated_at
before update on video_studio.brands
for each row execute function video_studio.touch_updated_at();

create trigger campaigns_touch_updated_at
before update on video_studio.campaigns
for each row execute function video_studio.touch_updated_at();

create trigger render_jobs_touch_updated_at
before update on video_studio.render_jobs
for each row execute function video_studio.touch_updated_at();

create function video_studio.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'immutable studio record';
end;
$$;

create trigger campaign_revisions_immutable
before update or delete on video_studio.campaign_revisions
for each row execute function video_studio.reject_immutable_change();

create trigger approvals_immutable
before update or delete on video_studio.approvals
for each row execute function video_studio.reject_immutable_change();

create trigger audit_events_immutable
before update or delete on video_studio.audit_events
for each row execute function video_studio.reject_immutable_change();

create function video_studio.can_access_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from video_studio.memberships membership
    where membership.tenant_id = target_tenant
      and membership.user_id = (select auth.uid())
  );
$$;

create function video_studio.can_operate_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from video_studio.memberships membership
    where membership.tenant_id = target_tenant
      and membership.user_id = (select auth.uid())
      and membership.role = 'operator'
  );
$$;

create function video_studio.can_approve_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from video_studio.memberships membership
    where membership.tenant_id = target_tenant
      and membership.user_id = (select auth.uid())
      and membership.role in ('operator', 'reviewer')
  );
$$;

create function video_studio.write_audit_event(
  target_tenant uuid,
  target_action text,
  event_target_type text,
  event_target_id uuid,
  event_request_id uuid,
  event_metadata jsonb default '{}'::jsonb,
  target_campaign_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if not video_studio.can_access_tenant(target_tenant) then
    raise exception using errcode = '42501', message = 'studio tenant access denied';
  end if;

  if target_action !~ '^[a-z][a-z0-9_]{0,79}(\.[a-z][a-z0-9_]{0,79})?$'
    or event_target_type !~ '^[a-z][a-z0-9_]{0,79}$' then
    raise exception using errcode = '22023', message = 'invalid studio audit action';
  end if;

  if event_request_id is null or not video_studio.is_safe_audit_metadata(event_metadata) then
    raise exception using errcode = '22023', message = 'invalid studio audit metadata';
  end if;

  if target_campaign_id is not null and not exists (
    select 1
    from video_studio.campaigns campaign
    where campaign.tenant_id = target_tenant and campaign.id = target_campaign_id
  ) then
    raise exception using errcode = '23503', message = 'studio campaign does not belong to tenant';
  end if;

  insert into video_studio.audit_events (
    tenant_id,
    campaign_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    request_id,
    metadata
  )
  values (
    target_tenant,
    target_campaign_id,
    auth.uid(),
    target_action,
    event_target_type,
    event_target_id,
    event_request_id,
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create index campaigns_tenant_updated_idx
on video_studio.campaigns (tenant_id, updated_at desc);
create index revisions_tenant_campaign_number_idx
on video_studio.campaign_revisions (tenant_id, campaign_id, number desc);
create index approvals_tenant_campaign_created_idx
on video_studio.approvals (tenant_id, campaign_id, created_at desc);
create index render_jobs_tenant_status_created_idx
on video_studio.render_jobs (tenant_id, status, created_at desc);
create index exports_tenant_campaign_created_idx
on video_studio.exports (tenant_id, campaign_id, created_at desc);
create index audit_events_tenant_created_idx
on video_studio.audit_events (tenant_id, created_at desc);
create index memberships_user_tenant_idx
on video_studio.memberships (user_id, tenant_id);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'tenants',
    'memberships',
    'brands',
    'campaigns',
    'campaign_revisions',
    'approvals',
    'render_jobs',
    'assets',
    'exports',
    'audit_events'
  ]
  loop
    execute format('alter table video_studio.%I enable row level security', target_table);
    execute format('alter table video_studio.%I force row level security', target_table);
  end loop;
end;
$$;

create policy tenants_select
on video_studio.tenants
for select to authenticated
using (video_studio.can_access_tenant(id));

create policy memberships_select
on video_studio.memberships
for select to authenticated
using (video_studio.can_access_tenant(tenant_id));

do $$
declare
  target_table text;
begin
  foreach target_table in array array['brands', 'campaigns', 'render_jobs', 'assets', 'exports']
  loop
    execute format(
      'create policy %I on video_studio.%I for select to authenticated using (video_studio.can_access_tenant(tenant_id))',
      target_table || '_select',
      target_table
    );
    execute format(
      'create policy %I on video_studio.%I for insert to authenticated with check (video_studio.can_operate_tenant(tenant_id))',
      target_table || '_operator_insert',
      target_table
    );
    execute format(
      'create policy %I on video_studio.%I for update to authenticated using (video_studio.can_operate_tenant(tenant_id)) with check (video_studio.can_operate_tenant(tenant_id))',
      target_table || '_operator_update',
      target_table
    );
    execute format(
      'create policy %I on video_studio.%I for delete to authenticated using (video_studio.can_operate_tenant(tenant_id))',
      target_table || '_operator_delete',
      target_table
    );
  end loop;
end;
$$;

create policy campaign_revisions_select
on video_studio.campaign_revisions
for select to authenticated
using (video_studio.can_access_tenant(tenant_id));

create policy campaign_revisions_operator_insert
on video_studio.campaign_revisions
for insert to authenticated
with check (video_studio.can_operate_tenant(tenant_id));

create policy approvals_select
on video_studio.approvals
for select to authenticated
using (video_studio.can_access_tenant(tenant_id));

create policy approvals_reviewer_insert
on video_studio.approvals
for insert to authenticated
with check (
  video_studio.can_approve_tenant(tenant_id)
  and actor_user_id = auth.uid()
);

create policy audit_events_select
on video_studio.audit_events
for select to authenticated
using (video_studio.can_access_tenant(tenant_id));

revoke all on schema video_studio from public, anon;
grant usage on schema video_studio to authenticated, service_role;

revoke all on all tables in schema video_studio from anon, authenticated;
grant select on video_studio.tenants, video_studio.memberships to authenticated;
grant select, insert, update, delete
on video_studio.brands, video_studio.campaigns, video_studio.render_jobs, video_studio.assets, video_studio.exports
to authenticated;
grant select, insert on video_studio.campaign_revisions, video_studio.approvals to authenticated;
grant select on video_studio.audit_events to authenticated;
grant all on all tables in schema video_studio to service_role;

revoke all on function video_studio.touch_updated_at() from public;
revoke all on function video_studio.reject_immutable_change() from public;
revoke all on function video_studio.is_safe_audit_metadata(jsonb) from public;
revoke all on function video_studio.can_access_tenant(uuid) from public;
revoke all on function video_studio.can_operate_tenant(uuid) from public;
revoke all on function video_studio.can_approve_tenant(uuid) from public;
revoke all on function video_studio.write_audit_event(uuid, text, text, uuid, uuid, jsonb, uuid) from public;

grant execute on function video_studio.can_access_tenant(uuid) to authenticated, service_role;
grant execute on function video_studio.can_operate_tenant(uuid) to authenticated, service_role;
grant execute on function video_studio.can_approve_tenant(uuid) to authenticated, service_role;
grant execute on function video_studio.write_audit_event(uuid, text, text, uuid, uuid, jsonb, uuid)
to authenticated, service_role;
