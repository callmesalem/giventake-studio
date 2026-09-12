-- Demo sites: the sales-facing "we already built you a demo" asset.
--
-- A rep, from a company or deal record, requests a custom demo website for that
-- business. The CRM cannot build it: the generator is a Python + headless
-- pipeline (Google Places photos/reviews -> static site -> Vercel deploy) that
-- lives on the VPS with the Maps + Vercel keys, and Cloudflare Workers can run
-- none of that. So this table is a REQUEST QUEUE and a RESULT store, nothing
-- more. The app writes a 'requested' row; the VPS agent (role crm_agent) polls,
-- builds, deploys, and writes back the live url. No generator secret ever
-- touches the Worker.
--
-- Same access posture as documents/e-signature and src/server/crm/read.ts: RLS
-- enabled with NO policies, so the table is unreachable directly; every path in
-- is a SECURITY DEFINER function granted to exactly one role. App-facing
-- functions go to service_role; the two the VPS agent needs go to crm_agent
-- (the execute-only role the CRM MCP connects as).

create table if not exists public.demo_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete cascade,
  deal_id uuid references public.deals on delete cascade,
  business_name text not null,
  address text,
  vertical text,
  status text not null default 'requested',
  url text,
  error text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A demo attached to neither belongs to nothing and cannot be surfaced again.
  check (company_id is not null or deal_id is not null),
  check (status in ('requested', 'building', 'live', 'failed', 'archived'))
);

create index if not exists demo_sites_company_idx on public.demo_sites (company_id) where company_id is not null;
create index if not exists demo_sites_deal_idx on public.demo_sites (deal_id) where deal_id is not null;
-- Partial index for the VPS poll: only the handful of unstarted requests.
create index if not exists demo_sites_pending_idx on public.demo_sites (created_at) where status = 'requested';

alter table public.demo_sites enable row level security;

-- Default ACL grants ALL on a new table to anon and authenticated. RLS with no
-- policies denies every row, but the grant must go too, matching every sibling
-- migration (see 20260902120000_documents_esignature.sql).
revoke all on table public.demo_sites from anon, authenticated;

-- Request a demo. App-facing (service_role). Pulls nothing itself; the caller
-- passes the business facts it already holds from the company/deal row. Returns
-- the new row id. This is the record that a public site is ABOUT to be built;
-- the app layer is responsible for logging it and honouring the kill switch
-- before calling this (deploying a public site is an external action).
create or replace function public.demo_site_request(
  p_company_id uuid,
  p_deal_id uuid,
  p_business_name text,
  p_address text,
  p_vertical text,
  p_requested_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_company_id is null and p_deal_id is null then
    raise exception 'demo_site_request: one of company_id or deal_id is required';
  end if;
  if coalesce(btrim(p_business_name), '') = '' then
    raise exception 'demo_site_request: business_name is required';
  end if;

  insert into demo_sites (company_id, deal_id, business_name, address, vertical, requested_by)
  values (p_company_id, p_deal_id, btrim(p_business_name), p_address, p_vertical, p_requested_by)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.demo_site_request(uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.demo_site_request(uuid, uuid, text, text, text, uuid) to service_role;

-- Surface demos on a record. App-facing (service_role). Two thin readers so the
-- detail-page card can ask by whichever id it has.
create or replace function public.demo_sites_for_deal(p_deal_id uuid)
returns setof public.demo_sites
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from demo_sites where deal_id = p_deal_id order by created_at desc;
$$;

create or replace function public.demo_sites_for_company(p_company_id uuid)
returns setof public.demo_sites
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from demo_sites where company_id = p_company_id order by created_at desc;
$$;

revoke all on function public.demo_sites_for_deal(uuid) from public;
revoke all on function public.demo_sites_for_company(uuid) from public;
grant execute on function public.demo_sites_for_deal(uuid) to service_role;
grant execute on function public.demo_sites_for_company(uuid) to service_role;

-- The VPS agent's poll. Granted to crm_agent (the execute-only MCP role), NOT to
-- the browser. Returns only the fields the builder needs, only for unstarted
-- requests, oldest first.
create or replace function public.demo_requests_pending()
returns table (id uuid, business_name text, address text, vertical text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select id, business_name, address, vertical
  from demo_sites
  where status = 'requested'
  order by created_at asc
  limit 25;
$$;

revoke all on function public.demo_requests_pending() from public;
grant execute on function public.demo_requests_pending() to service_role, crm_agent;

-- The VPS agent writes the outcome. Granted to crm_agent. Status is validated
-- here so a bad string cannot land a row in an impossible state, and updated_at
-- moves on every write so the card can show freshness.
create or replace function public.demo_site_set_result(
  p_id uuid,
  p_status text,
  p_url text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('building', 'live', 'failed', 'archived') then
    raise exception 'demo_site_set_result: status must be building, live, failed or archived, got %', p_status;
  end if;

  update demo_sites
     set status = p_status,
         url = coalesce(p_url, url),
         error = p_error,
         updated_at = now()
   where id = p_id;

  if not found then
    raise exception 'demo_site_set_result: no demo_site with id %', p_id;
  end if;
end;
$$;

revoke all on function public.demo_site_set_result(uuid, text, text, text) from public;
grant execute on function public.demo_site_set_result(uuid, text, text, text) to service_role, crm_agent;
