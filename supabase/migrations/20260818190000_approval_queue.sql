-- Approval queue. The human-facing decision inbox: an agent proposes an action,
-- it waits here until Salem approves or rejects. Nothing executes without an
-- explicit approval. Same security model: RLS on, no anon/authenticated grants,
-- access only via security-definer RPCs granted to service_role.

create table public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  action_type text not null,
  target_type text,
  target_id text,
  summary text not null,
  proposed_payload jsonb not null default '{}' check (jsonb_typeof(proposed_payload)='object'),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','executed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  decided_at timestamptz,
  decided_by text,
  decision_reason text,
  execution_result jsonb,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.approval_queue enable row level security;
revoke all on table public.approval_queue from anon, authenticated;

-- Agent proposes an action for human decision.
create function public.approval_request(
  p_agent_name text, p_action_type text, p_target_type text, p_target_id text,
  p_summary text, p_payload jsonb, p_risk_level text, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if coalesce(p_risk_level,'medium') not in ('low','medium','high','critical') then
    raise exception 'invalid risk level';
  end if;
  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;
  insert into approval_queue(agent_name,action_type,target_type,target_id,summary,proposed_payload,risk_level,expires_at)
    values(p_agent_name,p_action_type,p_target_type,p_target_id,p_summary,
           coalesce(p_payload,'{}'::jsonb), coalesce(p_risk_level,'medium'), p_expires_at)
    returning id into v_id;
  return v_id;
end $$;

-- Human decides. Only from pending; an expired request is rejected as expired.
create function public.approval_decide(
  p_id uuid, p_decision text, p_decided_by text, p_reason text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_expires timestamptz;
begin
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

-- Record execution of an approved action (human or gated runtime).
create function public.approval_mark_executed(p_id uuid, p_result jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text;
begin
  select status into v_status from approval_queue where id=p_id for update;
  if v_status is null then raise exception 'approval not found'; end if;
  if v_status <> 'approved' then raise exception 'only approved actions can be executed (is %)', v_status; end if;
  update approval_queue set status='executed', execution_result=p_result where id=p_id;
  return true;
end $$;

create function public.approval_queue_list(p_status text)
returns setof public.approval_queue language sql security definer set search_path=public,pg_temp stable as $$
  select * from approval_queue
  where p_status is null or status = p_status
  order by requested_at desc
  limit 200
$$;

revoke all on function
  public.approval_request(text,text,text,text,text,jsonb,text,timestamptz),
  public.approval_decide(uuid,text,text,text),
  public.approval_mark_executed(uuid,jsonb),
  public.approval_queue_list(text) from public;
grant execute on function
  public.approval_request(text,text,text,text,text,jsonb,text,timestamptz),
  public.approval_decide(uuid,text,text,text),
  public.approval_mark_executed(uuid,jsonb),
  public.approval_queue_list(text) to service_role;
