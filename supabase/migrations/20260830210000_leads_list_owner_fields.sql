-- Add owner_id and assigned_to to the leads_list read RPC.
--
-- The dashboard now scopes reads by the signed-in user (admins see all; members
-- see only what they own or are assigned, plus the unassigned lead pool). The
-- server-side read layer (src/server/crm/read.ts) filters leads by owner_id /
-- assigned_to, but the leads_list RPC did not return those fields, so this
-- additive change exposes them. Signature and grants are unchanged, so nothing
-- that calls leads_list breaks; members simply gain the fields needed to scope.

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
        'score', (qualification ->> 'score'),
        'owner_id', owner_id,
        'assigned_to', assigned_to
      ) as row_obj
    from leads
    where not coalesce(synthetic, false)
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) s
$$;

revoke all on function public.leads_list(int) from public;
grant execute on function public.leads_list(int) to service_role;
