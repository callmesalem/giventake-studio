-- Security boundary hardening for the local synthetic operator feature.
-- Runtime has RPC execution only. service_role is intentionally modelled as BYPASSRLS,
-- so grants, not RLS, are the direct-table boundary.

-- Generic schema tables may hold other application data later, but every operator RPC
-- below is synthetic-only. No operator RPC accepts shadow mode or non-synthetic records.

create or replace function public.operator_jsonb_exact_keys(p_value jsonb, p_keys text[])
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select p_value is not null and jsonb_typeof(p_value)='object'
    and not exists(select 1 from jsonb_object_keys(p_value) k where not (k=any(p_keys)))
    and not exists(select 1 from unnest(p_keys) k where not (p_value ? k))
$$;

create or replace function public.operator_safe_synthetic_text(p_value text, p_max integer)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select p_value is not null and length(trim(p_value)) between 1 and p_max
   and p_value !~* '(social security|ssn|credit card|bank account|routing number|medical|patient|health record|passport|driver.?s license|@[[:alnum:].-]+\.(com|net|org|gov|edu)\b|\+?1?[ .-]?\(?[0-9]{3}\)?[ .-][0-9]{3}[ .-][0-9]{4})'
$$;

create or replace function public.operator_create_synthetic_lead_run(p_idempotency_key text,p_lead jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run uuid; v_lead uuid; v_dataset uuid; v_existing operator_runs%rowtype; v_email text;
begin
 if not operator_jsonb_exact_keys(p_lead,array['synthetic','fixtureKind','id','email','contactName','businessName','category','offerSlug','observedNeed'])
    or p_lead->>'synthetic'<>'true' or p_lead->>'fixtureKind'<>'local-synthetic' then raise exception 'strict synthetic fixture required'; end if;
 if p_lead->>'id' !~ '^fixture-[a-z0-9-]{3,80}$' then raise exception 'controlled fixture id required'; end if;
 v_email:=lower(trim(p_lead->>'email'));
 if v_email !~ '^[a-z0-9._+-]+@[a-z0-9.-]+\.invalid$' then raise exception 'synthetic .invalid email required'; end if;
 if p_lead->>'category' not in ('electrical-contractor','plumbing-contractor','hvac-contractor','landscaping-contractor','public-adjuster') then raise exception 'controlled category required'; end if;
 if p_lead->>'offerSlug' not in ('business-automation','marketing-site') then raise exception 'controlled offer required'; end if;
 if not operator_safe_synthetic_text(p_lead->>'contactName',80) or not operator_safe_synthetic_text(p_lead->>'businessName',120)
    or not operator_safe_synthetic_text(p_lead->>'observedNeed',180) then raise exception 'unsafe fixture text'; end if;
 if p_lead->>'contactName' !~* '(fixture|sample|synthetic|test)' or p_lead->>'businessName' !~* '(fixture|sample|synthetic|test)'
    or p_lead->>'observedNeed' !~* '(fixture|sample|synthetic|test)' then raise exception 'explicit synthetic markers required'; end if;
 if p_idempotency_key !~ '^[A-Za-z0-9:_-]{8,128}$' then raise exception 'invalid idempotency key'; end if;
 if not check_operator_control('giventake-cfo-compliance','synthetic') or not check_operator_control('giventake-cro-pipeline','synthetic') then raise exception 'required operator disabled'; end if;
 select * into v_existing from operator_runs where idempotency_key=p_idempotency_key for update;
 if found then return jsonb_build_object('runId',v_existing.id,'leadId',v_existing.lead_id,'duplicate',true,'status',v_existing.status,'resumable',v_existing.status='running'); end if;
 -- Store only the controlled fixture fields, never unrestricted source text.
 insert into synthetic_datasets(name,data) values('run:'||p_idempotency_key,p_lead) returning id into v_dataset;
 insert into leads(email,name,synthetic) values(v_email,trim(p_lead->>'contactName'),true) returning id into v_lead;
 insert into operator_runs(operator_key,mode,dataset_id,idempotency_key,lead_id) values('giventake-cro-pipeline','synthetic',v_dataset,p_idempotency_key,v_lead) returning id into v_run;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(v_run,'giventake-cro-pipeline','synthetic_lead_persisted',jsonb_build_object('synthetic',true,'fixtureId',p_lead->>'id'));
 return jsonb_build_object('runId',v_run,'leadId',v_lead,'duplicate',false,'status','running','resumable',true);
exception when unique_violation then
 select * into v_existing from operator_runs where idempotency_key=p_idempotency_key;
 if found then return jsonb_build_object('runId',v_existing.id,'leadId',v_existing.lead_id,'duplicate',true,'status',v_existing.status,'resumable',v_existing.status='running'); end if; raise;
end $$;

create or replace function public.operator_record_synthetic_cfo(p_run_id uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_decision text; v_status operator_run_status; v_category text;
begin
 if not check_operator_control('giventake-cfo-compliance','synthetic') then raise exception 'cfo disabled'; end if;
 if not operator_jsonb_exact_keys(p_result,array['operator','decision','blocks','escalations','flags','sendAuthorized'])
   or p_result->>'operator'<>'giventake-cfo-compliance' or p_result->>'sendAuthorized'<>'false'
   or jsonb_typeof(p_result->'blocks')<>'array' or jsonb_typeof(p_result->'escalations')<>'array' or jsonb_typeof(p_result->'flags')<>'array' then raise exception 'invalid cfo result'; end if;
 select d.data->>'category' into v_category from operator_runs r join synthetic_datasets d on d.id=r.dataset_id where r.id=p_run_id and r.mode='synthetic' for update of r;
 if not found then raise exception 'run unavailable'; end if;
 v_decision:=p_result->>'decision';
 if v_category='public-adjuster' and (v_decision<>'escalate' or not (p_result->'escalations' ? 'salem_human_review')) then raise exception 'forged cfo pass'; end if;
 if v_category<>'public-adjuster' and v_decision<>'pass' and jsonb_array_length(p_result->'blocks')=0 and jsonb_array_length(p_result->'escalations')=0 then raise exception 'unsupported cfo claim'; end if;
 if v_decision not in ('pass','block','escalate') then raise exception 'invalid decision'; end if;
 v_status:=case when v_decision='pass' then 'running'::operator_run_status else 'blocked'::operator_run_status end;
 update operator_runs set compliance_result=p_result,status=v_status,finished_at=case when v_status='blocked' then now() else null end where id=p_run_id and mode='synthetic' and (compliance_result is null or (status='running' and compliance_result=p_result));
 if not found then raise exception 'run unavailable'; end if;
 if not exists(select 1 from operator_audit_events where run_id=p_run_id and event_type='cfo_compliance_decision') then insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,'giventake-cfo-compliance','cfo_compliance_decision',p_result||jsonb_build_object('synthetic',true)); end if;
 return jsonb_build_object('runId',p_run_id,'decision',v_decision,'status',v_status);
end $$;

create or replace function public.operator_record_synthetic_draft_approval(p_run_id uuid,p_draft jsonb,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_payload jsonb; v_hash text; v_approval uuid; v_existing operator_approvals%rowtype; v_text text;
begin
 if not check_operator_control('giventake-cro-pipeline','synthetic') then raise exception 'cro disabled'; end if;
 if not operator_jsonb_exact_keys(p_draft,array['operator','status','leadId','offerSlug','draft','wordCount','compliance','sendAuthorized','sideEffects'])
   or p_draft->>'operator'<>'giventake-cro-pipeline' or p_draft->>'status'<>'awaiting_human_review'
   or p_draft->>'sendAuthorized'<>'false' or p_draft->>'sideEffects'<>'0' then raise exception 'invalid draft'; end if;
 v_text:=p_draft->>'draft';
 if not operator_safe_synthetic_text(v_text,1200) or v_text ~* '(free website|risk[- ]free|click here|guarantee|limited[- ]time|act now|our team of|save[sd]? [0-9]+ (hours?|%))' then raise exception 'prohibited draft content'; end if;
 if position('This message was sent automatically by GivenTake Devs.' in v_text)=0 or position('Reply and a person will read it.' in v_text)=0 then raise exception 'automated disclosure required'; end if;
 if p_draft#>>'{compliance,decision}'<>'pass' or p_draft#>>'{compliance,sendAuthorized}'<>'false' then raise exception 'authoritative cfo pass required'; end if;
 if p_expires_at<=now() or p_expires_at>now()+interval '48 hours' then raise exception 'invalid expiry'; end if;
 select * into v_existing from operator_approvals where run_id=p_run_id and action='draft';
 if found then return jsonb_build_object('runId',p_run_id,'approvalId',v_existing.id,'payload',v_existing.payload,'payloadHash',v_existing.payload_hash,'status','pending'); end if;
 perform 1 from operator_runs where id=p_run_id and mode='synthetic' and status='running' and compliance_result->>'decision'='pass' and compliance_result=(p_draft->'compliance') and draft_result is null for update;
 if not found then raise exception 'run unavailable'; end if;
 v_payload:=jsonb_build_object('kind','synthetic_cro_draft','runId',p_run_id,'draft',p_draft);
 v_hash:=encode(digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
 update operator_runs set draft_result=p_draft,status='awaiting_approval' where id=p_run_id;
 insert into operator_approvals(run_id,action,payload,payload_hash,expires_at) values(p_run_id,'draft',v_payload,v_hash,p_expires_at) returning id into v_approval;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,'giventake-cro-pipeline','cro_draft_created',jsonb_build_object('synthetic',true,'payloadHash',v_hash)),(p_run_id,'giventake-cro-pipeline','human_approval_queued',jsonb_build_object('synthetic',true,'approvalId',v_approval,'payloadHash',v_hash,'status','pending'));
 return jsonb_build_object('runId',p_run_id,'approvalId',v_approval,'payload',v_payload,'payloadHash',v_hash,'status','pending');
end $$;

create or replace function public.append_operator_audit_event(p_run_id uuid,p_operator_key text,p_event_type text,p_details jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$ declare v_id bigint; begin
 if p_run_id is null or not exists(select 1 from operator_runs where id=p_run_id and operator_key=p_operator_key and mode='synthetic') then raise exception 'operator/run mismatch'; end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or p_details->>'synthetic'<>'true' then raise exception 'synthetic object details required'; end if;
 insert into operator_audit_events(run_id,operator_key,event_type,details) values(p_run_id,p_operator_key,p_event_type,p_details) returning id into v_id; return v_id; end $$;

create or replace function public.operator_protect_approval() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
   if new.payload_hash<>encode(digest(convert_to(new.payload::text,'UTF8'),'sha256'),'hex') then raise exception 'canonical payload hash mismatch'; end if;
 else
   if new.run_id<>old.run_id or new.action<>old.action or new.payload<>old.payload or new.payload_hash<>old.payload_hash or new.requested_at<>old.requested_at or new.expires_at<>old.expires_at then raise exception 'protected approval fields immutable'; end if;
 end if; return new;
end $$;
drop trigger if exists operator_approval_protect on public.operator_approvals;
create trigger operator_approval_protect before insert or update on public.operator_approvals for each row execute function public.operator_protect_approval();

-- Explicitly remove every direct privilege, including from BYPASSRLS service_role.
revoke all privileges on all tables in schema public from anon,authenticated,service_role;
revoke all privileges on all sequences in schema public from anon,authenticated,service_role;
revoke execute on all functions in schema public from public,anon,authenticated,service_role;
grant execute on function public.operator_get_controls(text),public.operator_is_suppressed(text),public.operator_get_approval(uuid),public.operator_dashboard_snapshot(),public.operator_create_synthetic_lead_run(text,jsonb),public.operator_record_synthetic_cfo(uuid,jsonb),public.operator_record_synthetic_draft_approval(uuid,jsonb,timestamptz),public.operator_approve_synthetic_draft(uuid,text,text,text),public.operator_reject_synthetic_draft(uuid,text,text,text) to service_role;
