-- crm_write_rpcs: the six dashboard writes that used to go to tables directly.
--
-- 20260814180000_operator_security_hardening.sql set the rule: "Runtime has RPC
-- execution only." src/server/crm/actions.ts later grew six methods that PATCH and
-- POST through PostgREST instead, because no RPC carried what they needed:
-- ownership, the lead a deal came from, a lead's status, and new clients, projects
-- and invoices. 20260918120000_service_role_grants_reconciliation.sql leaves
-- service_role with no write privilege on any table, so those six need a way in.
-- These are it, and src/server/crm/actions.ts now calls them.
--
-- Apply together with 20260918120000. In production four of the six were already
-- being refused (service_role has had no privilege on leads, clients, projects or
-- invoices since 2026-08-14), so for those this is a repair, not a change.
--
-- Deliberately NOT granted to crm_agent or agent_sami, and deliberately without
-- the agent_require guard the ten agent write functions carry. These are human
-- writes made from the dashboard behind requireCrmSession and, for all but
-- lead conversion, requireAdmin. Nothing an agent does should reach them; an
-- agent that wants one of these outcomes proposes it through approval_request.
--
-- Every function: SECURITY DEFINER, search_path pinned, refused to public, anon
-- and authenticated, granted to service_role alone. None touches `synthetic`,
-- `id` or `created_at`, so a caller cannot forge any of the three.

-- 1. Ownership. One function for ten tables, which is only safe because the
--    table and column are matched against a literal list before either reaches
--    format(). The list is src/lib/crm-guards.ts ASSIGNABLE, copied, and
--    tests/crm-grants.integration.test.mjs fails if a pair outside it is accepted.
--    The TypeScript copy saves a round trip; this copy is the one that cannot be
--    skipped.
create or replace function public.crm_assign(p_table text, p_column text, p_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  if (p_table, p_column) not in (
    ('leads', 'owner_id'), ('leads', 'assigned_to'),
    ('deals', 'owner_id'), ('deals', 'assigned_to'),
    ('tasks', 'owner_id'), ('tasks', 'assigned_to'),
    ('companies', 'owner_id'),
    ('contacts', 'owner_id'),
    ('notes', 'owner_id'),
    ('clients', 'owner_id'),
    ('projects', 'owner_id'),
    ('invoices', 'owner_id'),
    ('referrals', 'owner_id')
  ) then
    raise exception 'that record cannot be assigned: %.%', coalesce(p_table, '?'), coalesce(p_column, '?');
  end if;
  if p_id is null then
    raise exception 'record not found';
  end if;

  -- %I quotes the two identifiers; the values travel as parameters. p_user_id may
  -- be null, which is how an owner is cleared.
  execute format('update public.%I set %I = $1 where id = $2', p_table, p_column)
    using p_user_id, p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'record not found: % %', p_table, p_id;
  end if;
end $$;

-- 2. The lead a deal came from. deal_upsert carries no lead_id, and this is the
--    only column it can ever write.
create or replace function public.deal_link_lead(p_deal_id uuid, p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update deals set lead_id = p_lead_id, updated_at = now() where id = p_deal_id;
  if not found then
    raise exception 'deal not found: %', p_deal_id;
  end if;
end $$;

-- 3. A lead's status. leads.status has never had a vocabulary in the database
--    ('new' and 'suppressed' come from capture_website_lead, 'converted' from the
--    dashboard), and this is not the place to invent one. It does refuse anything
--    that is not a short lowercase word, so the column cannot be used to store
--    free text.
create or replace function public.lead_set_status(p_lead_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status is null or p_status !~ '^[a-z][a-z_]{0,39}$' then
    raise exception 'lead status must be a short lowercase word';
  end if;
  update leads set status = p_status where id = p_lead_id;
  if not found then
    raise exception 'lead not found: %', p_lead_id;
  end if;
end $$;

-- 4. A won deal becomes a client.
create or replace function public.client_create(
  p_name text,
  p_lead_id uuid,
  p_deal_id uuid,
  p_ai_processing_allowed boolean,
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'client name is required';
  end if;
  insert into clients (name, lead_id, deal_id, ai_processing_allowed, owner_id)
    values (btrim(p_name), p_lead_id, p_deal_id, coalesce(p_ai_processing_allowed, false), p_owner_id)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.project_create(p_client_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'project name is required';
  end if;
  insert into projects (client_id, name)
    values (p_client_id, btrim(p_name))
    returning id into v_id;
  return v_id;
end $$;

-- 5. An invoice, in cents. invoices is the table 20260817120000 locked away from
--    service_role by name; this keeps it locked and still lets a human raise one.
--    Currency is stored lowercase because the column default and convert_won_deal
--    both write 'usd'; the dashboard sends 'USD', and one table should not hold
--    both spellings of the same currency.
create or replace function public.invoice_create(
  p_project_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_status text,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_currency text := lower(coalesce(nullif(btrim(p_currency), ''), 'usd'));
  v_status text := coalesce(nullif(btrim(p_status), ''), 'draft');
begin
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invoice amount must be zero or more cents';
  end if;
  if v_currency !~ '^[a-z]{3}$' then
    raise exception 'invoice currency must be a three-letter code';
  end if;
  if v_status !~ '^[a-z][a-z_]{0,39}$' then
    raise exception 'invoice status must be a short lowercase word';
  end if;
  insert into invoices (project_id, amount_cents, currency, status, due_at)
    values (p_project_id, p_amount_cents, v_currency, v_status, p_due_at)
    returning id into v_id;
  return v_id;
end $$;

revoke all on function
  public.crm_assign(text, text, uuid, uuid),
  public.deal_link_lead(uuid, uuid),
  public.lead_set_status(uuid, text),
  public.client_create(text, uuid, uuid, boolean, uuid),
  public.project_create(uuid, text),
  public.invoice_create(uuid, bigint, text, text, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.crm_assign(text, text, uuid, uuid),
  public.deal_link_lead(uuid, uuid),
  public.lead_set_status(uuid, text),
  public.client_create(text, uuid, uuid, boolean, uuid),
  public.project_create(uuid, text),
  public.invoice_create(uuid, bigint, text, text, timestamptz)
to service_role;
