-- Newsletter suite. Owned list with double opt-in, one-click unsubscribe, and
-- issues. Sending stays human/gated (via Resend); these RPCs only manage state
-- and eligibility. Same security model: RLS on, no anon/authenticated grants,
-- access only via security-definer RPCs granted to service_role.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending'
    check (status in ('pending','confirmed','unsubscribed','suppressed','bounced')),
  consent_source text,
  consent_at timestamptz,
  confirm_token text,
  confirm_token_issued_at timestamptz,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body jsonb not null default '{}' check (jsonb_typeof(body)='object'),
  status text not null default 'draft'
    check (status in ('draft','scheduled','sent','canceled','archived')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_sends (
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.newsletter_issues on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers on delete cascade,
  status text not null default 'queued' check (status in ('queued','sent','bounced','failed')),
  created_at timestamptz not null default now(),
  unique (issue_id, subscriber_id)
);

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_issues enable row level security;
alter table public.newsletter_sends enable row level security;

revoke all on table public.newsletter_subscribers, public.newsletter_issues, public.newsletter_sends
  from anon, authenticated;
revoke all on sequence public.newsletter_sends_id_seq from anon, authenticated;

-- Subscribe: double opt-in. Creates/refreshes a pending subscriber with a fresh
-- confirm token. If the address is already on do_not_contact, record it as
-- 'suppressed' and issue no token. Idempotent on email.
create function public.newsletter_subscribe(p_email text, p_consent_source text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text; v_suppressed boolean; v_token text; v_status text; v_id uuid;
begin
  v_email := lower(trim(p_email));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid email'; end if;
  v_suppressed := public.operator_is_suppressed(v_email);
  if v_suppressed then
    v_status := 'suppressed'; v_token := null;
  else
    v_status := 'pending'; v_token := gen_random_uuid()::text;
  end if;
  insert into newsletter_subscribers(email,status,consent_source,confirm_token,confirm_token_issued_at)
    values(v_email, v_status, p_consent_source, v_token, case when v_token is null then null else now() end)
    on conflict (email) do update set
      status = case when newsletter_subscribers.status='confirmed' then 'confirmed' else excluded.status end,
      consent_source = coalesce(excluded.consent_source, newsletter_subscribers.consent_source),
      confirm_token = case when newsletter_subscribers.status='confirmed' then newsletter_subscribers.confirm_token else excluded.confirm_token end,
      confirm_token_issued_at = case when newsletter_subscribers.status='confirmed' then newsletter_subscribers.confirm_token_issued_at else excluded.confirm_token_issued_at end,
      updated_at = now()
    returning id, status into v_id, v_status;
  return jsonb_build_object('id', v_id, 'status', v_status);
end $$;

-- Confirm: pending -> confirmed only, and only within the token TTL (72h).
create function public.newsletter_confirm(p_token text, p_ttl_hours int default 72)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count bigint;
begin
  update newsletter_subscribers
    set status='confirmed', consent_at=now(), confirm_token=null, updated_at=now()
    where confirm_token = p_token
      and status='pending'
      and confirm_token_issued_at > now() - make_interval(hours => p_ttl_hours);
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

-- Unsubscribe: honored from any active state, and adds the address to
-- do_not_contact so every other suite suppresses it too.
create function public.newsletter_unsubscribe(p_email text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text;
begin
  v_email := lower(trim(p_email));
  update newsletter_subscribers set status='unsubscribed', updated_at=now()
    where email=v_email and status not in ('suppressed','bounced');
  insert into do_not_contact(normalized_address, reason)
    values(v_email, 'newsletter unsubscribe')
    on conflict (normalized_address) do nothing;
  return true;
end $$;

-- Eligible recipients for an issue: confirmed and not suppressed only.
create function public.newsletter_eligible_recipients(p_issue_id uuid)
returns table(subscriber_id uuid, email text)
language sql security definer set search_path=public,pg_temp stable as $$
  select s.id, s.email from newsletter_subscribers s
  where s.status='confirmed' and not public.operator_is_suppressed(s.email)
$$;

create function public.newsletter_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'subscribersByStatus', coalesce(
      (select jsonb_object_agg(status, n) from (select status, count(*) n from newsletter_subscribers group by status) s), '{}'::jsonb),
    'issues', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from newsletter_issues i), '[]'::jsonb)
  ) $$;

revoke all on function
  public.newsletter_subscribe(text,text),
  public.newsletter_confirm(text,int),
  public.newsletter_unsubscribe(text),
  public.newsletter_eligible_recipients(uuid),
  public.newsletter_snapshot() from public;
grant execute on function
  public.newsletter_subscribe(text,text),
  public.newsletter_confirm(text,int),
  public.newsletter_unsubscribe(text),
  public.newsletter_eligible_recipients(uuid),
  public.newsletter_snapshot() to service_role;
