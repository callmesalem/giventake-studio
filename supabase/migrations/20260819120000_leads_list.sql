-- Read-only leads list for the CRM dashboard.
--
-- `leads` is RLS-locked and its direct table grants were revoked from
-- service_role by the operator security-hardening migration, so service_role
-- cannot SELECT it directly. This security-definer function is the only read
-- path, granted to service_role only — matching the pattern used by every other
-- snapshot/list RPC. It never writes and returns only real (non-synthetic) leads.

create or replace function public.leads_list(p_limit int default 200)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(jsonb_agg(row_obj order by created_at desc), '[]'::jsonb)
  from (
    select
      created_at,
      jsonb_build_object(
        'id', id,
        'name', name,
        'email', email,
        'company', company,
        'status', status,
        'source', source,
        'budget', budget,
        'timeline', timeline,
        'created_at', created_at,
        'qualified_at', qualified_at,
        'score', (qualification ->> 'score')
      ) as row_obj
    from leads
    where not coalesce(synthetic, false)
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) s
$$;

revoke all on function public.leads_list(int) from public;
grant execute on function public.leads_list(int) to service_role;
