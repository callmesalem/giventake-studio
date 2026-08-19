-- Prospecting layer. Companies, contacts, and deals — the prospect-side CRM that
-- Piper works and that external CRMs (Attio) import into. Every row carries a
-- (source, source_record_id) so imports are idempotent (re-running never
-- duplicates). Same security model: RLS on, no anon/authenticated grants, access
-- only via security-definer RPCs granted to service_role.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  description text,
  categories jsonb not null default '[]' check (jsonb_typeof(categories)='array'),
  employee_range text,
  location text,
  socials jsonb not null default '{}' check (jsonb_typeof(socials)='object'),
  source text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_record_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete set null,
  name text,
  email text,
  phone text,
  job_title text,
  socials jsonb not null default '{}' check (jsonb_typeof(socials)='object'),
  source text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_record_id)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete set null,
  name text,
  stage text,
  value_usd numeric,
  source text not null default 'manual',
  source_record_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata)='object'),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_record_id)
);

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;

revoke all on table public.companies, public.contacts, public.deals from anon, authenticated;

-- Idempotent upserts keyed on (source, source_record_id). Service role only.

create function public.company_upsert(
  p_source text, p_source_record_id text, p_name text, p_domain text, p_description text,
  p_categories jsonb, p_employee_range text, p_location text, p_socials jsonb, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into companies(source,source_record_id,name,domain,description,categories,employee_range,location,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_name, p_domain, p_description,
           coalesce(p_categories,'[]'::jsonb), p_employee_range, p_location,
           coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      name=excluded.name, domain=excluded.domain, description=excluded.description,
      categories=excluded.categories, employee_range=excluded.employee_range,
      location=excluded.location, socials=excluded.socials, metadata=excluded.metadata,
      updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.contact_upsert(
  p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_email text,
  p_phone text, p_job_title text, p_socials jsonb, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into contacts(source,source_record_id,company_id,name,email,phone,job_title,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_email,
           p_phone, p_job_title, coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, email=excluded.email,
      phone=excluded.phone, job_title=excluded.job_title, socials=excluded.socials,
      metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.deal_upsert(
  p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_stage text,
  p_value_usd numeric, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into deals(source,source_record_id,company_id,name,stage,value_usd,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_stage,
           p_value_usd, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, stage=excluded.stage,
      value_usd=excluded.value_usd, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $$;

create function public.prospecting_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'companies', (select count(*) from companies),
    'contacts', (select count(*) from contacts),
    'deals', (select count(*) from deals)
  ) $$;

revoke all on function
  public.company_upsert(text,text,text,text,text,jsonb,text,text,jsonb,jsonb),
  public.contact_upsert(text,text,uuid,text,text,text,text,jsonb,jsonb),
  public.deal_upsert(text,text,uuid,text,text,numeric,jsonb),
  public.prospecting_snapshot() from public;
grant execute on function
  public.company_upsert(text,text,text,text,text,jsonb,text,text,jsonb,jsonb),
  public.contact_upsert(text,text,uuid,text,text,text,text,jsonb,jsonb),
  public.deal_upsert(text,text,uuid,text,text,numeric,jsonb),
  public.prospecting_snapshot() to service_role;
