-- Defense-in-depth: FORCE row level security on every public table so RLS
-- applies even to the table owner, not just to non-owner roles.
--
-- The service_role and postgres roles keep the BYPASSRLS attribute, so the CRM's
-- SECURITY DEFINER RPCs (owned by postgres) and service_role reads continue to
-- work unchanged. FORCE only adds protection in the event a table is ever
-- re-owned to a non-bypass role or a permissive policy is later added. The
-- primary access control remains the grant model: no anon/authenticated grants,
-- and function EXECUTE limited to service_role.

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end $$;
