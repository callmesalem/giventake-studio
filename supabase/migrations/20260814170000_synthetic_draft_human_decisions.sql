-- Phase 5: local human review decisions for synthetic CRO drafts only.
alter table public.operator_approvals
  add column if not exists rejected_at timestamptz,
  add column if not exists decided_by text,
  add column if not exists decision_reason text;

alter table public.operator_approvals add constraint operator_approvals_one_decision
  check (num_nonnulls(approved_at,rejected_at) <= 1);
alter table public.operator_approvals add constraint operator_approvals_decision_metadata
  check ((approved_at is null and rejected_at is null and decided_by is null and decision_reason is null)
      or (num_nonnulls(approved_at,rejected_at)=1 and length(trim(decided_by))>6 and length(trim(decision_reason))>0));

create function public.operator_decide_synthetic_draft(
  p_id uuid, p_expected_hash text, p_actor text, p_reason text, p_decision text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run_id uuid; v_operator text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if p_expected_hash !~ '^[0-9a-f]{64}$' then raise exception 'exact payload hash required'; end if;
  if trim(coalesce(p_actor,'')) !~ '^local:[A-Za-z0-9][A-Za-z0-9._-]{0,119}$' then raise exception 'explicit local human actor required'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'decision reason required'; end if;

  select a.run_id,r.operator_key into v_run_id,v_operator
  from operator_approvals a join operator_runs r on r.id=a.run_id
  cross join operator_system_control s
  join operator_controls c on c.operator_key='giventake-cro-pipeline'
  where a.id=p_id and a.action='draft' and a.payload_hash=p_expected_hash
    and a.payload->>'kind'='synthetic_cro_draft'
    and a.payload#>>'{draft,sendAuthorized}'='false'
    and r.mode='synthetic' and r.status='awaiting_approval'
    and a.expires_at>now() and a.revoked_at is null and a.consumed_at is null
    and a.approved_at is null and a.rejected_at is null
    and s.id='global' and s.operators_enabled and c.enabled and 'synthetic'=any(c.allowed_modes)
  for update of a,r;
  if not found then return false; end if;

  if p_decision='approved' then
    update operator_approvals set approved_at=now(),decided_by=trim(p_actor),decision_reason=trim(p_reason)
      where id=p_id and approved_at is null and rejected_at is null;
    if not found then return false; end if;
    update operator_runs set status='completed',finished_at=now()
      where id=v_run_id and status='awaiting_approval';
  else
    update operator_approvals set rejected_at=now(),decided_by=trim(p_actor),decision_reason=trim(p_reason)
      where id=p_id and approved_at is null and rejected_at is null;
    if not found then return false; end if;
    update operator_runs set status='blocked',finished_at=now() where id=v_run_id and status='awaiting_approval';
  end if;
  insert into operator_audit_events(run_id,operator_key,event_type,details)
    values(v_run_id,'giventake-cro-pipeline','human_draft_'||p_decision,
      jsonb_build_object('synthetic',true,'approvalId',p_id,'payloadHash',p_expected_hash,
                         'actor',trim(p_actor),'reason',trim(p_reason),'sendAuthorized',false));
  return true;
end $$;

create function public.operator_approve_synthetic_draft(p_id uuid,p_expected_hash text,p_actor text,p_reason text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
  select operator_decide_synthetic_draft(p_id,p_expected_hash,p_actor,p_reason,'approved') $$;
create function public.operator_reject_synthetic_draft(p_id uuid,p_expected_hash text,p_actor text,p_reason text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
  select operator_decide_synthetic_draft(p_id,p_expected_hash,p_actor,p_reason,'rejected') $$;

create or replace function public.operator_dashboard_snapshot() returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
 select jsonb_build_object(
 'system',(select to_jsonb(s) from operator_system_control s where id='global'),
 'operators',coalesce((select jsonb_agg(to_jsonb(c)) from operator_controls c),'[]'),
 'runs',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (select r.*,to_jsonb(l) as lead from operator_runs r left join leads l on l.id=r.lead_id where r.mode='synthetic' order by r.started_at desc limit 100) x),'[]'),
 'approvals',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('status','pending')) from operator_approvals a join operator_runs r on r.id=a.run_id where a.action='draft' and r.mode='synthetic' and r.status='awaiting_approval' and a.approved_at is null and a.rejected_at is null and a.revoked_at is null and a.consumed_at is null and a.expires_at>now()),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from operator_audit_events order by id desc limit 200) e),'[]')) $$;

revoke all on function public.operator_decide_synthetic_draft(uuid,text,text,text,text),public.operator_approve_synthetic_draft(uuid,text,text,text),public.operator_reject_synthetic_draft(uuid,text,text,text) from public;
grant execute on function public.operator_approve_synthetic_draft(uuid,text,text,text),public.operator_reject_synthetic_draft(uuid,text,text,text) to service_role;
