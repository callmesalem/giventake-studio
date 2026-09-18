-- service_role_grants_reconciliation: make service_role's table privileges a
-- written-down allowlist instead of an accident of when each table was created.
--
-- How it got this way. 20260814180000_operator_security_hardening.sql:115 revoked
-- every table privilege from service_role, once, for the tables that existed that
-- day. This project's default privileges then handed service_role (and anon, and
-- authenticated) arwdDxtm on every table created afterwards, and each later
-- migration revoked only from anon and authenticated. Measured in production on
-- 2026-09-18:
--
--   * too open: service_role held SELECT, INSERT, UPDATE, DELETE and TRUNCATE on
--     24 tables, among them deals, approval_queue, documents and
--     document_signatures. It has BYPASSRLS, so a leaked key or a server bug could
--     write any of them without passing a guarded RPC or leaving an audit row.
--   * too closed: service_role was denied on leads, touchpoints, agent_log,
--     clients, projects and invoices, which the app and the giventake-mcp function
--     read directly. Four of the seven MCP tools fail on that today.
--
-- A freshly created Supabase project (a branch, a local stack) has different
-- default privileges from this one, so nothing below depends on defaults: it
-- revokes everything, then grants by name. The end state is the same wherever it
-- runs.
--
-- What this grants: SELECT on the 19 tables the code reads without an RPC. The list
-- was traced call site by call site from src/server/crm/read.ts, src/lib/crm-data.ts,
-- src/server/approvals/deps.ts, src/server/documents/deal-access.ts,
-- src/server/demo-sites/access.ts and supabase/functions/giventake-mcp/index.ts.
-- Every other table is reached through SECURITY DEFINER functions only and gets
-- nothing.
--
-- Two of the 19 reverse an earlier explicit decision and should be read as such:
-- 20260817120000_website_lead_capture.sql:75 locked invoices and agent_log away
-- from service_role on purpose. The Clients page reads invoices and the lead
-- timeline and recent_activity read agent_log, so both have been failing. SELECT
-- only; nothing here lets service_role write either table.
--
-- What this does NOT grant: any INSERT, UPDATE or DELETE. The direct writes in
-- src/server/crm/actions.ts (assign, linkDealToLead, setLeadStatus, createClient,
-- createProject, createInvoice) are handled by the migration that follows this
-- one. Apply the two together: between them, those six methods are refused.
--
-- The whole file must apply atomically (the CLI and the MCP tool both run a file
-- as one implicit transaction), or reads fail between the revoke and the grants.

-- 1. Start from nothing.
revoke all privileges on all tables in schema public from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema public from public, anon, authenticated, service_role;

-- 2. The read allowlist.
grant select on table
  public.leads,
  public.companies,
  public.contacts,
  public.deals,
  public.notes,
  public.tasks,
  public.touchpoints,
  public.agent_log,
  public.pipeline_stages,
  public.deal_stage_events,
  public.approval_queue,
  public.referral_partners,
  public.referrals,
  public.clients,
  public.projects,
  public.invoices,
  public.campaigns,
  public.newsletter_subscribers,
  public.reviews
to service_role;

-- 3. Stop the next table from repeating this. New tables, sequences and functions
--    created by the migration role start with no grant to the API roles; a
--    migration that wants one has to say so.
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 4. FORCE row level security everywhere, again. 20260819140000_force_rls.sql ran
--    before pipeline_stages, deal_stage_events, documents, document_signatures and
--    agent_capabilities existed, and none of them forces it.
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end $$;

-- 5. The one function the Supabase linter still flags for a mutable search_path.
alter function public.deny_audit_mutation() set search_path = public, pg_temp;

-- 6. Refuse to finish in any other state. If a table was added between writing
--    this and applying it, or a grant above was mistyped, the migration fails here
--    and rolls back rather than leaving a half-reconciled database.
do $$
declare
  v_allow constant text[] := array[
    'leads','companies','contacts','deals','notes','tasks','touchpoints','agent_log',
    'pipeline_stages','deal_stage_events','approval_queue','referral_partners',
    'referrals','clients','projects','invoices','campaigns','newsletter_subscribers',
    'reviews'
  ];
  v_bad text;
begin
  select string_agg(format('%s:%s:%s', c.relname, r.rolname, p.priv), ', ' order by c.relname, r.rolname, p.priv)
    into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (select rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
  cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
  where n.nspname = 'public' and c.relkind in ('r','p')
    and has_table_privilege(r.rolname, c.oid, p.priv);
  if v_bad is not null then
    raise exception 'API role still holds a table write privilege: %', v_bad;
  end if;

  select string_agg(format('%s:%s', c.relname, r.rolname), ', ' order by c.relname, r.rolname)
    into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (select rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
  where n.nspname = 'public' and c.relkind in ('r','p')
    and has_table_privilege(r.rolname, c.oid, 'SELECT')
    and not (r.rolname = 'service_role' and c.relname = any (v_allow));
  if v_bad is not null then
    raise exception 'SELECT held outside the allowlist: %', v_bad;
  end if;

  select string_agg(t, ', ' order by t) into v_bad
  from unnest(v_allow) t
  where to_regclass('public.' || t) is null
     or not has_table_privilege('service_role', to_regclass('public.' || t), 'SELECT');
  if v_bad is not null then
    raise exception 'allowlisted table missing or not readable by service_role: %', v_bad;
  end if;

  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p')
    and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;
end $$;
