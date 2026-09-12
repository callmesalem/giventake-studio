-- The CRM mail surface: Gmail thread and message HEADERS, beside the record
-- they concern.
--
-- There is deliberately no body column. Bodies are fetched from Gmail on
-- demand (phase 2). The absence of the column is the enforcement: with nowhere
-- to put a body, nobody adds a cache "just for now" and quietly makes this
-- system the custodian of every client conversation the business has had.
--
-- Snippets ARE stored, and that is a real trade recorded in the spec: a Gmail
-- snippet is roughly the first hundred characters of real content, and a list
-- view cannot render without one.
--
-- Same access posture as documents/e-signature and demo_sites: RLS enabled with
-- NO policies, so the tables are unreachable directly, and every path in is a
-- SECURITY DEFINER function granted to exactly one role. The split here is the
-- point: the app reads inboxes and can never see a token; the VPS agent writes
-- headers and can never list an inbox.

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  provider text not null default 'gmail',
  google_sub text,
  status text not null default 'connected',

  -- Encrypted with a key held ONLY on the VPS. Postgres stores ciphertext; the
  -- Worker does not have the key and cannot decrypt these. A database
  -- compromise alone yields nothing readable.
  refresh_token_enc text,
  access_token_enc text,
  token_expires_at timestamptz,

  -- Gmail's incremental sync cursor. Expires after about a week, at which point
  -- history.list answers 404 and the poller must backfill. See
  -- docs/integrations/gmail-poller-contract.md.
  history_id text,

  signature_html text,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (status in ('connected', 'reauth_required', 'disabled')),
  check (provider in ('gmail'))
);

create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.mail_accounts on delete cascade,
  gmail_thread_id text not null,

  subject text,
  snippet text,
  participants text[] not null default '{}',
  message_count integer not null default 0,
  last_message_at timestamptz,
  unread boolean not null default false,
  labels text[] not null default '{}',

  -- The CRM link. This is what separates this from an email client. Resolved at
  -- sync time by matching participants against contacts. A thread with no match
  -- is still stored and still listed; it simply has no record context yet.
  contact_id uuid references public.contacts on delete set null,
  deal_id uuid references public.deals on delete set null,
  company_id uuid references public.companies on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (account_id, gmail_thread_id)
);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads on delete cascade,
  gmail_message_id text not null,
  direction text not null,

  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  sent_at timestamptz,
  snippet text,
  has_attachments boolean not null default false,

  created_at timestamptz not null default now(),

  unique (thread_id, gmail_message_id),
  check (direction in ('inbound', 'outbound'))
);

create index if not exists mail_threads_recent_idx
  on public.mail_threads (account_id, last_message_at desc);
create index if not exists mail_threads_deal_idx
  on public.mail_threads (deal_id) where deal_id is not null;
create index if not exists mail_threads_contact_idx
  on public.mail_threads (contact_id) where contact_id is not null;
create index if not exists mail_messages_thread_idx
  on public.mail_messages (thread_id, sent_at desc);

alter table public.mail_accounts enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;

-- RLS with no policies denies every row, but the default ACL grant must go too,
-- matching every sibling migration (see 20260911223000_demo_sites.sql).
revoke all on table public.mail_accounts, public.mail_threads, public.mail_messages from anon, authenticated;

-- ── App-facing reads. service_role only. None of these touch a token. ────────

create or replace function public.mail_inbox_list(p_limit integer, p_offset integer)
returns table (
  id uuid, gmail_thread_id text, subject text, snippet text,
  participants text[], message_count integer, last_message_at timestamptz,
  unread boolean, contact_id uuid, deal_id uuid, company_id uuid,
  contact_name text, deal_name text, company_name text
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select t.id, t.gmail_thread_id, t.subject, t.snippet,
         t.participants, t.message_count, t.last_message_at,
         t.unread, t.contact_id, t.deal_id, t.company_id,
         c.name, d.name, co.name
  from mail_threads t
  left join contacts c on c.id = t.contact_id
  left join deals d on d.id = t.deal_id
  left join companies co on co.id = t.company_id
  order by t.last_message_at desc nulls last
  limit least(coalesce(p_limit, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.mail_threads_for_deal(p_deal_id uuid)
returns setof public.mail_threads
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from mail_threads where deal_id = p_deal_id order by last_message_at desc nulls last;
$$;

create or replace function public.mail_threads_for_contact(p_contact_id uuid)
returns setof public.mail_threads
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from mail_threads where contact_id = p_contact_id order by last_message_at desc nulls last;
$$;

revoke all on function public.mail_inbox_list(integer, integer) from public;
revoke all on function public.mail_threads_for_deal(uuid) from public;
revoke all on function public.mail_threads_for_contact(uuid) from public;
grant execute on function public.mail_inbox_list(integer, integer) to service_role;
grant execute on function public.mail_threads_for_deal(uuid) to service_role;
grant execute on function public.mail_threads_for_contact(uuid) to service_role;

-- ── The VPS agent's half. agent_sami, never the browser. ────────────────────
--
-- Granted to agent_sami rather than crm_agent because
-- docs/operations/operator-control/agent-capabilities.md:165 retires
-- crm_agent. Granting to the retiring role alone breaks mail at cutover.

create or replace function public.mail_account_for_sync()
returns table (id uuid, email text, refresh_token_enc text, history_id text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select id, email, refresh_token_enc, history_id
  from mail_accounts
  where status = 'connected'
  order by created_at asc
  limit 5;
$$;

create or replace function public.mail_sync_upsert_thread(
  p_account_id uuid,
  p_gmail_thread_id text,
  p_subject text,
  p_snippet text,
  p_participants text[],
  p_last_message_at timestamptz,
  p_unread boolean,
  p_labels text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_contact uuid;
  v_company uuid;
  v_deal uuid;
begin
  -- Resolve the CRM link from the participants. First matching contact wins;
  -- a thread with no match is still stored, it simply has no record context.
  select c.id, c.company_id into v_contact, v_company
  from contacts c
  where lower(c.email) = any (select lower(x) from unnest(p_participants) as x)
  limit 1;

  if v_company is not null then
    select d.id into v_deal
    from deals d
    where d.company_id = v_company
    order by d.created_at desc
    limit 1;
  end if;

  insert into mail_threads (
    account_id, gmail_thread_id, subject, snippet, participants,
    last_message_at, unread, labels, contact_id, company_id, deal_id
  )
  values (
    p_account_id, p_gmail_thread_id, p_subject, p_snippet, coalesce(p_participants, '{}'),
    p_last_message_at, coalesce(p_unread, false), coalesce(p_labels, '{}'), v_contact, v_company, v_deal
  )
  on conflict (account_id, gmail_thread_id) do update
    set subject = excluded.subject,
        snippet = excluded.snippet,
        participants = excluded.participants,
        last_message_at = excluded.last_message_at,
        unread = excluded.unread,
        labels = excluded.labels,
        contact_id = coalesce(mail_threads.contact_id, excluded.contact_id),
        company_id = coalesce(mail_threads.company_id, excluded.company_id),
        deal_id = coalesce(mail_threads.deal_id, excluded.deal_id),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mail_sync_upsert_messages(
  p_thread_id uuid,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into mail_messages (
    thread_id, gmail_message_id, direction, from_email, from_name,
    to_emails, cc_emails, sent_at, snippet, has_attachments
  )
  select
    p_thread_id,
    m->>'gmailMessageId',
    m->>'direction',
    m->>'fromEmail',
    m->>'fromName',
    coalesce(array(select jsonb_array_elements_text(m->'to')), '{}'),
    coalesce(array(select jsonb_array_elements_text(m->'cc')), '{}'),
    (m->>'sentAt')::timestamptz,
    m->>'snippet',
    coalesce((m->>'hasAttachments')::boolean, false)
  from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) as m
  on conflict (thread_id, gmail_message_id) do nothing;

  get diagnostics v_count = row_count;

  update mail_threads
     set message_count = (select count(*) from mail_messages where thread_id = p_thread_id),
         updated_at = now()
   where id = p_thread_id;

  return v_count;
end;
$$;

create or replace function public.mail_account_set_history_id(p_account_id uuid, p_history_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update mail_accounts
     set history_id = p_history_id, updated_at = now()
   where id = p_account_id;

  if not found then
    raise exception 'mail_account_set_history_id: no account with id %', p_account_id;
  end if;
end;
$$;

revoke all on function public.mail_account_for_sync() from public;
revoke all on function public.mail_sync_upsert_thread(uuid, text, text, text, text[], timestamptz, boolean, text[]) from public;
revoke all on function public.mail_sync_upsert_messages(uuid, jsonb) from public;
revoke all on function public.mail_account_set_history_id(uuid, text) from public;

-- Both roles, deliberately. agent-capabilities.md:155: "Sami connects as
-- crm_agent today", and setting agent_sami's password is step 2 of a cutover
-- that has not happened. Granting only agent_sami would leave the poller
-- unable to call any of these. Step 5 of that cutover revokes crm_agent from
-- the guarded functions; these four join that list.
grant execute on function public.mail_account_for_sync() to service_role, crm_agent, agent_sami;
grant execute on function public.mail_sync_upsert_thread(uuid, text, text, text, text[], timestamptz, boolean, text[]) to service_role, crm_agent, agent_sami;
grant execute on function public.mail_sync_upsert_messages(uuid, jsonb) to service_role, crm_agent, agent_sami;
grant execute on function public.mail_account_set_history_id(uuid, text) to service_role, crm_agent, agent_sami;
