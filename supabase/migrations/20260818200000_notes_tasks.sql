-- Notes and tasks. Activity attached to prospecting records (imported from Attio,
-- extendable later). Idempotent via (source, source_record_id). Same security
-- model: RLS on, no anon/authenticated grants, access only via security-definer
-- RPCs granted to service_role.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete set null,
  title text,
  content text,
  source text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_record_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete set null,
  content text,
  is_completed boolean not null default false,
  deadline_at timestamptz,
  source text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_record_id)
);

alter table public.notes enable row level security;
alter table public.tasks enable row level security;
revoke all on table public.notes, public.tasks from anon, authenticated;

create function public.note_upsert(
  p_source text, p_source_record_id text, p_company_id uuid, p_title text, p_content text, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into notes(source,source_record_id,company_id,title,content,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_title, p_content, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, title=excluded.title, content=excluded.content,
      metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.task_upsert(
  p_source text, p_source_record_id text, p_company_id uuid, p_content text, p_is_completed boolean, p_deadline_at timestamptz, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into tasks(source,source_record_id,company_id,content,is_completed,deadline_at,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_content, coalesce(p_is_completed,false), p_deadline_at, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, content=excluded.content, is_completed=excluded.is_completed,
      deadline_at=excluded.deadline_at, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.activity_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'notes', (select count(*) from notes),
    'tasks', (select count(*) from tasks),
    'openTasks', (select count(*) from tasks where not is_completed)
  ) $$;

revoke all on function
  public.note_upsert(text,text,uuid,text,text,jsonb),
  public.task_upsert(text,text,uuid,text,boolean,timestamptz,jsonb),
  public.activity_snapshot() from public;
grant execute on function
  public.note_upsert(text,text,uuid,text,text,jsonb),
  public.task_upsert(text,text,uuid,text,boolean,timestamptz,jsonb),
  public.activity_snapshot() to service_role;
