-- Security fix: lock all public RPCs to service_role only.
--
-- Supabase grants EXECUTE to anon/authenticated on public functions via default
-- privileges, so the prior `revoke ... from public` was NOT sufficient: 30 of the
-- CRM's SECURITY DEFINER functions were reachable with the public anon key, which
-- would let an unauthenticated caller read leads/contacts (PII) and even write to
-- the CRM or approval queue. The definer functions bypass table RLS, so this was a
-- real data-exposure and integrity hole.
--
-- This app never calls Supabase from the browser (no anon key is shipped; all
-- access is server-side with the service-role key), so revoking anon/authenticated
-- EXECUTE breaks nothing and closes the hole. Applies to every existing public
-- function and sets default privileges so future functions are not auto-exposed.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Stop future functions (created by the migration owner) from being auto-granted
-- to anon/authenticated in this schema.
alter default privileges in schema public revoke execute on functions from anon, authenticated;
