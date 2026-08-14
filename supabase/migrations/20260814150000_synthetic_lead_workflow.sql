-- Phase 4: local synthetic-only lead persistence and exact-payload approval queue.
alter table public.operator_runs add column if not exists lead_id uuid references public.leads;
alter table public.operator_runs add column if not exists compliance_result jsonb;
alter table public.operator_runs add column if not exists draft_result jsonb;

create unique index if not exists operator_runs_lead_idx on public.operator_runs(lead_id) where lead_id is not null;

create function public.operator_create_synthetic_lead_run(p_idempotency_key text, p_lead jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run uuid; v_lead uuid; v_dataset uuid; v_existing operator_runs%rowtype; v_email text;
begin
  if p_lead is null or jsonb_typeof(p_lead)<>'object' or p_lead->>'synthetic'<>'true' or p_lead->>'fixtureKind'<>'local-synthetic' then raise exception 'synthetic fixture required'; end if;
  v_email:=lower(trim(coalesce(p_lead->>'email','')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$' then raise exception 'synthetic .invalid email required'; end if;
  if coalesce(p_lead->>'contactName','') !~* '(fixture|sample|synthetic|test)'
     or coalesce(p_lead->>'businessName','') !~* '(fixture|sample|synthetic|test)'
     or coalesce(p_lead->>'observedNeed','') !~* '(fixture|sample|synthetic|test)'
  then raise exception 'explicit synthetic markers required'; end if;
  if length(coalesce(p_idempotency_key,''))<8 then raise exception 'invalid idempotency key'; end if;
  if not check_operator_control('giventake-cfo-compliance','synthetic') or not check_operator_control('giventake-cro-pipeline','synthetic') then raise exception 'required operator disabled'; end if;
  select * into v_existing from operator_runs where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('runId',v_existing.id,'leadId',v_existing.lead_id,'duplicate',true,'status',v_existing.status); end if;
  insert into synthetic_datasets(name,data) values('run:'||p_idempotency_key,p_lead) returning id into v_dataset;
  insert into leads(email,name,synthetic) values(v_email,nullif(trim(p_lead->>'contactName'),''),true) returning id into v_lead;
  insert into operator_runs(operator_key,mode,dataset_id,idempotency_key,lead_id) values('giventake-cro-pipeline','synthetic',v_dataset,p_idempotency_key,v_lead) returning id into v_run;
  insert into operator_audit_events(run_id,operator_key,event_type,details) values(v_run,'giventake-cro-pipeline','synthetic_lead_persisted',jsonb_build_object('synthetic',true,'leadId',v_lead,'email',v_email));
  return jsonb_build_object('runId',v_run,'leadId',v_lead,'duplicate',false,'status','running');
exception when unique_violation then
  select * into v_existing from operator_runs where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('runId',v_existing.id,'leadId',v_existing.lead_id,'duplicate',true,'status',v_existing.status); end if;
  raise;
end $$;

create function public.operator_record_synthetic_cfo(p_run_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_decision text; v_status operator_run_status;
begin
 if not check_operator_control('giventake-cfo-compliance','synthetic') then raise exception 'cfo disabled'; end if;
 if p_result is null or jsonb_typeof(p_result)<>'object' then raise exception 'result required'; end if;
 if coalesce(p_result->>'sendAuthorized','')<>'false' then raise exception 'send authority prohibited'; end if;
 v_decision:=p_result->>'decision'; if v_decision not in ('pass','block','escalate') then raise exception 'invalid decision'; end if;
 v_status:=case when v_decision='pass' then 'running'::operator_run_status else 'blocked'::operator_run_status end;
 update operator_runs set compliance_result=p_result,status=v_status,finished_at=case when v_status='blocked' then now() else null end where id=p_run_id and mode='synthetic' and compliance_result is null;
 if not found then raise exception 'run unavailable'; end if;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,'cfo','cfo_compliance_decision',p_result||jsonb_build_object('synthetic',true));
 return jsonb_build_object('runId',p_run_id,'decision',v_decision,'status',v_status);
end $$;

create function public.operator_record_synthetic_draft_approval(p_run_id uuid,p_draft jsonb,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payload jsonb; v_hash text; v_approval uuid;
begin
 if not check_operator_control('giventake-cro-pipeline','synthetic') then raise exception 'cro disabled'; end if;
 if p_draft is null or jsonb_typeof(p_draft)<>'object' or coalesce(p_draft->>'sendAuthorized','')<>'false' or coalesce(p_draft->>'status','')<>'awaiting_human_review' then raise exception 'invalid draft'; end if;
 if p_expires_at<=now() then raise exception 'invalid expiry'; end if;
 perform 1 from operator_runs where id=p_run_id and mode='synthetic' and status='running' and compliance_result->>'decision'='pass' and draft_result is null for update;
 if not found then raise exception 'run unavailable'; end if;
 v_payload:=jsonb_build_object('kind','synthetic_cro_draft','runId',p_run_id,'draft',p_draft);
 v_hash:=encode(digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
 update operator_runs set draft_result=p_draft,status='awaiting_approval' where id=p_run_id;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,'cro','cro_draft_created',jsonb_build_object('synthetic',true,'payloadHash',v_hash));
 insert into operator_approvals(run_id,action,payload,payload_hash,expires_at) values(p_run_id,'draft',v_payload,v_hash,p_expires_at) returning id into v_approval;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,'cro','human_approval_queued',jsonb_build_object('synthetic',true,'approvalId',v_approval,'payloadHash',v_hash,'status','pending'));
 return jsonb_build_object('runId',p_run_id,'approvalId',v_approval,'payload',v_payload,'payloadHash',v_hash,'status','pending');
end $$;

create or replace function public.operator_dashboard_snapshot() returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
 select jsonb_build_object(
 'system',(select to_jsonb(s) from operator_system_control s where id='global'),
 'operators',coalesce((select jsonb_agg(to_jsonb(c)) from operator_controls c),'[]'),
 'runs',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (select r.*,to_jsonb(l) as lead from operator_runs r left join leads l on l.id=r.lead_id where r.mode='synthetic' order by r.started_at desc limit 100) x),'[]'),
 'approvals',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('status','pending')) from operator_approvals a where approved_at is null and revoked_at is null and consumed_at is null and expires_at>now()),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from operator_audit_events order by id desc limit 200) e),'[]')) $$;

revoke all on function public.operator_create_synthetic_lead_run(text,jsonb),public.operator_record_synthetic_cfo(uuid,jsonb),public.operator_record_synthetic_draft_approval(uuid,jsonb,timestamptz) from public;
grant execute on function public.operator_create_synthetic_lead_run(text,jsonb),public.operator_record_synthetic_cfo(uuid,jsonb),public.operator_record_synthetic_draft_approval(uuid,jsonb,timestamptz) to service_role;
