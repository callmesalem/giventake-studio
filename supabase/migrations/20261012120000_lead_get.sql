-- lead_get: one lead by id, for the approval executor.
--
-- leads is RPC-only for the service role (the security-hardening migration
-- revoked its direct grant), and leads_list caps at 200 newest rows, so an
-- executor resolving a send_email recipient needs a by-id read or an older
-- lead silently reads as "no address on record". Mirrors leads_list: security
-- definer, service_role only, never a browser role.

create or replace function public.lead_get(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'email', l.email,
    'company', l.company,
    'status', l.status,
    'owner_id', l.owner_id,
    'assigned_to', l.assigned_to
  )
  from public.leads l
  where l.id = p_id
    and not coalesce(l.synthetic, false)
$$;

revoke all on function public.lead_get(uuid) from public;
grant execute on function public.lead_get(uuid) to service_role;
