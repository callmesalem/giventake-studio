-- Asserted agent identity for the Worker's MCP gateway.
--
-- agent_require reads session_user, which is `authenticator` for everything the
-- app does through PostgREST, and that login is exempt because it is the human
-- dashboard path. The Worker's /mcp gateway is not a human. It acts for
-- Perplexity, and needs the same three things a direct agent login gets: the
-- global kill switch, the per-capability row, and an audit row under the
-- agent's own name.
--
-- The gateway therefore sends `x-agent-role: agent_perplexity` on every RPC.
-- PostgREST exposes request headers, lowercased, as request.headers. When the
-- caller is on the exempt list AND that header is present, the guard runs the
-- full checks under the asserted name. Without the header nothing changes.
--
-- Only holders of the service-role key reach these functions through PostgREST
-- (default privileges were revoked in 20260918120000), so only the app can
-- assert an agent. The app already has to be trusted with that key; this
-- widens the capability model's boundary by exactly one trusted asserter, the
-- Worker, and docs/operations/operator-control/agent-capabilities.md says so.
--
-- Design: docs/superpowers/specs/2026-09-24-perplexity-mcp-gateway-design.md §2.

-- ---------------------------------------------------------------------------
-- 1. The guard learns to read an asserted agent
-- ---------------------------------------------------------------------------
create or replace function public.agent_require(p_capability text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   text := session_user;
  v_asserted text;
  v_global   boolean;
  v_enabled  boolean;
  v_reason   text;
begin
  if v_caller in ('authenticator', 'postgres', 'supabase_admin', 'cli_login_postgres') then
    -- The app path. Exempt, unless the app says it is acting for an agent.
    v_asserted := nullif(current_setting('request.headers', true), '')::json ->> 'x-agent-role';
    if v_asserted is null then
      return;
    end if;
    if v_asserted !~ '^agent_[a-z_]{1,40}$'
       or v_asserted in ('authenticator', 'postgres', 'supabase_admin', 'cli_login_postgres') then
      raise warning 'agent_capability_denied caller=% capability=% reason=bad_assertion asserted=%',
        v_caller, p_capability, v_asserted;
      raise exception 'agent_capability_denied: bad_assertion (%, %)', v_asserted, p_capability
        using errcode = 'check_violation';
    end if;
    v_caller := v_asserted;
  end if;

  select operators_enabled into v_global
    from public.operator_system_control
    where id = 'global';
  if coalesce(v_global, false) is not true then
    v_reason := 'operators_disabled';
  else
    select enabled into v_enabled
      from public.agent_capabilities
      where agent_role = v_caller and capability = p_capability;
    if v_enabled is null then
      v_reason := 'capability_missing';
    elsif v_enabled is not true then
      v_reason := 'capability_disabled';
    end if;
  end if;

  if v_reason is null then
    insert into public.operator_audit_events(operator_key, event_type, details)
    values (v_caller, 'capability_allowed',
            jsonb_build_object('capability', p_capability));
    return;
  end if;

  raise warning 'agent_capability_denied caller=% capability=% reason=%',
    v_caller, p_capability, v_reason;
  raise exception 'agent_capability_denied: % (%, %)', v_reason, v_caller, p_capability
    using errcode = 'check_violation';
end $$;

comment on function public.agent_require(text) is
  'Capability guard for agent write paths. Reads session_user; an exempt app login may assert an agent through the x-agent-role request header, in which case the kill switch, the capability row and the audit apply under that name. Raises on refusal.';

-- ---------------------------------------------------------------------------
-- 2. Deciding an approval is now a capability
-- ---------------------------------------------------------------------------
-- The dashboard path is exempt as before. An agent (asserted or direct) needs
-- the approval_decide row on, which is the one switch that turns "execute on
-- Salem's direction" off without touching proposals.
create or replace function public.approval_decide(
  p_id uuid, p_decision text, p_decided_by text, p_reason text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_expires timestamptz;
begin
  perform public.agent_require('approval_decide');
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  select status, expires_at into v_status, v_expires from approval_queue where id=p_id for update;
  if v_status is null then raise exception 'approval not found'; end if;
  if v_status <> 'pending' then raise exception 'approval already decided (%).', v_status; end if;
  if v_expires is not null and v_expires <= now() then
    update approval_queue set status='expired', decided_at=now() where id=p_id;
    raise exception 'approval expired';
  end if;
  update approval_queue set status=p_decision, decided_at=now(), decided_by=p_decided_by, decision_reason=p_reason
    where id=p_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Perplexity's switches, all off until Salem turns them on
-- ---------------------------------------------------------------------------
insert into public.agent_capabilities (agent_role, capability, enabled, updated_by) values
  ('agent_perplexity', 'approval_request',        false, 'migration 20260924120000'),
  ('agent_perplexity', 'company_upsert',          false, 'migration 20260924120000'),
  ('agent_perplexity', 'contact_upsert',          false, 'migration 20260924120000'),
  ('agent_perplexity', 'deal_advance_stage',      false, 'migration 20260924120000'),
  ('agent_perplexity', 'deal_upsert',             false, 'migration 20260924120000'),
  ('agent_perplexity', 'note_upsert',             false, 'migration 20260924120000'),
  ('agent_perplexity', 'referral_partner_upsert', false, 'migration 20260924120000'),
  ('agent_perplexity', 'referral_record',         false, 'migration 20260924120000'),
  ('agent_perplexity', 'referral_set_status',     false, 'migration 20260924120000'),
  ('agent_perplexity', 'task_upsert',             false, 'migration 20260924120000'),
  ('agent_perplexity', 'approval_decide',         false, 'migration 20260924120000')
on conflict (agent_role, capability) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Let the app show which switches are on
-- ---------------------------------------------------------------------------
-- service_role cannot read agent_capabilities (and must not: it would be a
-- writable PostgREST endpoint). This is a read of one agent's rows, nothing more.
create or replace function public.agent_capabilities_for(p_agent text)
returns table(capability text, enabled boolean)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select c.capability, c.enabled
    from public.agent_capabilities c
   where c.agent_role = p_agent
   order by c.capability
$$;

revoke all on function public.agent_capabilities_for(text) from public, anon, authenticated;
grant execute on function public.agent_capabilities_for(text) to service_role;
