-- Wire the existing charter-§10 kill switch into the live crm-mcp agent tool
-- layer. check_operator_control and operator_get_controls already existed
-- (operator_control_foundation migration) but no live agent role had EXECUTE
-- on them, so nothing actually consulted the switch at runtime.
--
-- Purely additive: no DROP, no destructive ALTER. One new narrow read-only
-- function plus two GRANTs to the least-privilege crm_agent role.

-- operator_get_controls(p_operator_key) reports operators_enabled merged
-- with a single operator's own enabled/allowedModes row, but does not
-- surface outbound_enabled (the second global flag on
-- operator_system_control). Rather than change the shape of the existing,
-- already-relied-upon operator_get_controls function, add a small
-- additional read-only RPC that reports the raw global flags directly.
create function public.operator_get_system_control()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'operatorsEnabled', operators_enabled,
    'outboundEnabled', outbound_enabled,
    'reason', reason,
    'updatedAt', updated_at
  )
  from public.operator_system_control
  where id = 'global'
$$;

comment on function public.operator_get_system_control() is
  'Read-only report of the charter §10 global kill-switch flags (operators_enabled, outbound_enabled). Additive companion to operator_get_controls.';

revoke all on function public.operator_get_system_control() from public;
grant execute on function public.operator_get_system_control() to service_role, crm_agent;

-- Grant the least-privilege runtime role (crm_agent) EXECUTE on the two
-- pre-existing kill-switch RPCs so the crm-mcp tool layer can finally
-- consult them before any outbound/client-facing action.
grant execute on function public.check_operator_control(text, public.operator_mode) to crm_agent;
grant execute on function public.operator_get_controls(text) to crm_agent;
