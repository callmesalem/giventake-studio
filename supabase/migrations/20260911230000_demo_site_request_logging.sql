-- Make demo_site_request log, per charter §9.
--
-- 20260911223000_demo_sites.sql says "the app layer is responsible for logging
-- it and honouring the kill switch before calling this". The app can honour the
-- kill switch — that gate is pure and lives in src/lib/crm-guards.ts — but it
-- CANNOT log. 20260817120000_website_lead_capture.sql revokes agent_log from
-- service_role and records why: "Charter §9 agent activity log. Written via
-- SECURITY DEFINER RPCs only; no direct role grants." So the app was asked for
-- something it has no grant to do, and a requirement nobody can satisfy is one
-- that silently does not happen.
--
-- The log therefore moves inside the definer, which is where every other log in
-- this schema is written (capture_website_lead and its two successors). That
-- also makes it atomic: the row and its log entry commit together, so there is
-- no window in which a public site was queued and nothing recorded it. An app
-- that logged separately could always crash between the two.
--
-- The signature is unchanged, deliberately. Sami's half of the contract
-- (demo_requests_pending / demo_site_set_result) is untouched, and
-- `create or replace` preserves the function's existing ACL — the same property
-- docs/operations/operator-control/agent-capabilities.md relies on — so the
-- service_role grant from the previous migration survives without restating.

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
  v_name text;
begin
  if p_company_id is null and p_deal_id is null then
    raise exception 'demo_site_request: one of company_id or deal_id is required';
  end if;

  v_name := btrim(coalesce(p_business_name, ''));
  if v_name = '' then
    raise exception 'demo_site_request: business_name is required';
  end if;

  insert into demo_sites (company_id, deal_id, business_name, address, vertical, requested_by)
  values (p_company_id, p_deal_id, v_name, p_address, p_vertical, p_requested_by)
  returning id into v_id;

  -- agent_log has no deal/company columns (its FKs are lead_id and client_id),
  -- so the record of WHICH record this was requested from lives in payload.
  -- outcome is 'demo_site_queued' and not 'demo_site_built': at this point
  -- nothing has been built, and a log line claiming otherwise would be the
  -- system asserting a deployment that has not happened.
  insert into agent_log(operator, sop, step, trigger, payload, outcome, escalated, synthetic)
  values ('crm-demo-sites', '02-sales-pipeline', 'demo_site_request', 'operator_request',
          jsonb_build_object('demoSiteId', v_id,
                             'companyId', p_company_id,
                             'dealId', p_deal_id,
                             'businessName', v_name,
                             'vertical', nullif(btrim(coalesce(p_vertical, '')), ''),
                             'requestedBy', p_requested_by),
          'demo_site_queued', false, false);

  return v_id;
end;
$$;

comment on function public.demo_site_request(uuid, uuid, text, text, text, uuid) is
  'Queue a demo site build and record it in agent_log (charter §9). Does not build or deploy anything; the VPS agent polls demo_requests_pending.';
