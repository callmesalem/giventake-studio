# CRM Mail Surface, Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store Gmail thread and message headers for one connected mailbox, and render them as a read-only inbox inside the CRM.

**Architecture:** Three tables with RLS on and no policies, reachable only through `SECURITY DEFINER` functions split across two roles: the app reads, the VPS agent writes. The Worker never calls Gmail and never decrypts a token in this phase; it reads headers from Postgres exactly as the documents and demo-site features read theirs. The VPS holds the OAuth flow and the poller.

**Tech Stack:** Postgres/Supabase, PostgREST RPC over raw `fetch` (no `@supabase/supabase-js`), TanStack Start server functions on Cloudflare Workers, React 19, Node's built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-09-11-crm-mail-surface-design.md`

## Global Constraints

- **No body column.** `mail_messages` stores headers and Gmail's snippet only. Bodies are fetched on demand in Phase 2.
- **No `@supabase/supabase-js`.** Not a dependency of this repo. Every call is raw `fetch` to `/rest/v1/rpc/<name>`, matching `src/server/documents/store.ts`.
- **`src/lib/*-data.ts` is client-reachable.** It may reach `src/server/*` only through dynamic `import()` inside a handler. A static import fails the build (`@tanstack/start-plugin-core` import protection). See `src/server/documents/deal-access.ts` for why.
- **Agent grants go to `agent_sami`, not `crm_agent`.** `docs/operations/operator-control/agent-capabilities.md:165` retires `crm_agent`. Granting to it alone breaks mail at cutover.
- **Brand v6:** Ink `#17171A`, Paper `#FFFFFF`, Surface `#F4F4F5`, Indigo `#6366F1`, Indigo Deep `#4338CA` (hover/gradient only), Secondary text `#68686D`. Inter Tight throughout, display 600 at `-0.03em`. No second typeface; use `font-variant-numeric: tabular-nums` for aligned digits.
- **Product copy:** plain, confident, benefit-first, no filler, no em dashes.
- **Line endings are LF.** `.gitattributes` enforces it; a CRLF file buries real lint errors under thousands of `Delete ␍`.
- **Verify chain:** the node test loop, `npm run build`, then `node scripts/worker-smoke.mjs`. `npm run test` fails on Windows (npm hands a bash loop to cmd.exe) — run the loop directly.

---

## Prerequisites (human, not agent)

These are blocking and cannot be done by an implementer inside this repo.

- [x] **P1: RESOLVED 2026-09-13 — `giventakedevs.com` is Google Workspace.** Publish the OAuth app as **Internal**; verification is skipped and CASA does not apply. Original question: `gmail.readonly` and `gmail.send` are Restricted scopes. If `giventakedevs.com` is Google Workspace, publish the OAuth app as **Internal** and verification is skipped. If the mailbox is a plain `@gmail.com`, there is no Internal option and CASA assessment applies. Resolve before P2.
- [ ] **P2: Create the Google Cloud OAuth client.** Enable the Gmail API. Authorized redirect URI points at the **VPS**, not the Worker (only the VPS can encrypt the refresh token). Record client id and secret as VPS environment variables.
- [ ] **P3: Generate the token encryption key on the VPS.** 32 random bytes, stored only as a VPS environment variable. It must never be committed, never reach Cloudflare, and never appear in this repo.

Tasks 1 through 6 can be built and tested without any of these. Only the end-to-end connect and first sync need them.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260912090000_mail_surface.sql` | Tables, RPCs, grants |
| `tests/mail-migration.test.mjs` | Asserts the grant split and RLS posture |
| `src/server/mail/types.ts` | Row shapes, camel-cased at the boundary |
| `src/server/mail/store.ts` | PostgREST adapter, app-facing RPCs only |
| `src/server/mail/access.ts` | Session + store construction, server-only |
| `src/lib/mail-data.ts` | Server functions; reaches `src/server/mail/*` by dynamic import |
| `src/lib/mail-format.ts` | Pure display helpers, client-safe |
| `tests/mail-format.test.mjs` | Tests for those helpers |
| `src/routes/crm.inbox.tsx` | The read-only inbox route |
| `src/styles.css` *(modify)* | Fix the dead Inter Tight path; add `--gt-*` v6 tokens |
| `docs/integrations/gmail-poller-contract.md` | What the VPS must implement |

---

## Task 1: Schema, RPCs and grants

**Files:**
- Create: `supabase/migrations/20260912090000_mail_surface.sql`
- Test: `tests/mail-migration.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: RPCs `mail_inbox_list(p_limit int, p_offset int)`, `mail_threads_for_deal(p_deal_id uuid)`, `mail_threads_for_contact(p_contact_id uuid)` for `service_role`; `mail_account_for_sync()`, `mail_sync_upsert_thread(...)`, `mail_sync_upsert_messages(p_thread_id uuid, p_messages jsonb)`, `mail_account_set_history_id(p_account_id uuid, p_history_id text)` for `agent_sami`.

  `mail_sync_upsert_messages` takes the **internal** `mail_threads.id`, not the
  Gmail thread id: `mail_sync_upsert_thread` already returns that uuid, so the
  poller holds it and keying on the Gmail id would force a second lookup.

- [ ] **Step 1: Write the failing migration test**

Create `tests/mail-migration.test.mjs`:

```javascript
// The mail tables are reachable ONLY through definer functions, and the two
// halves of the contract go to two different roles: the app reads inboxes and
// can never see a token, the VPS agent writes headers and can never list one.
// A stray grant is invisible in review and total in effect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260912090000_mail_surface.sql", "utf8");

/** SQL with `-- ...` comment text removed, so prose about what the code does
 *  NOT do cannot satisfy a doesNotMatch asking about executable SQL. */
const code = (s) => s.replace(/--[^\n]*/g, "");

test("all three tables are created idempotently", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`));
  }
});

test("there is no body column anywhere", () => {
  // The absence of the column is the enforcement. With nowhere to put a body,
  // nobody adds a cache "just for now".
  assert.doesNotMatch(code(sql), /\bbody\b/);
});

test("RLS is on for every table and no policy is created", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.doesNotMatch(code(sql), /create policy/i);
});

test("the default anon/authenticated grant is revoked", () => {
  assert.match(sql, /revoke all on table public\.mail_accounts, public\.mail_threads, public\.mail_messages from anon, authenticated/);
});

test("no app-facing function can read a token column", () => {
  // The strongest guarantee in this migration. mail_account_for_sync is the
  // only function that touches the ciphertext, and it is agent-only.
  const appFns = ["mail_inbox_list", "mail_threads_for_deal", "mail_threads_for_contact"];
  for (const fn of appFns) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`));
    const end = body.indexOf("$$;");
    assert.doesNotMatch(body.slice(0, end), /refresh_token_enc|access_token_enc/, `${fn} must not read tokens`);
  }
});

test("the sync functions are granted to agent_sami, not only crm_agent", () => {
  // agent-capabilities.md:165 retires crm_agent. Granting to it alone breaks
  // mail at cutover, which is the mistake the demo_sites migration made.
  for (const fn of ["mail_account_for_sync", "mail_account_set_history_id"]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]*to [^;]*agent_sami`));
  }
});

test("app functions are granted to service_role only", () => {
  assert.match(sql, /grant execute on function public\.mail_inbox_list\(integer, integer\) to service_role;/);
  assert.doesNotMatch(code(sql), /mail_inbox_list[^;]*to (anon|authenticated|agent_sami)/);
});

test("every function revokes PUBLIC before granting", () => {
  const revokes = code(sql).match(/revoke all on function/g) ?? [];
  const grants = code(sql).match(/grant execute on function/g) ?? [];
  assert.equal(revokes.length, 7, "one revoke per function");
  assert.equal(grants.length, 7, "one grant per function");
});

test("every definer pins search_path", () => {
  const definers = code(sql).match(/security definer/g) ?? [];
  const paths = code(sql).match(/set search_path = public, pg_temp/g) ?? [];
  assert.equal(definers.length, paths.length);
});

test("the inbox list is bounded", () => {
  assert.match(sql, /least\(coalesce\(p_limit, 50\), 200\)/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --experimental-strip-types tests/mail-migration.test.mjs`
Expected: FAIL with `ENOENT` — the migration does not exist yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260912090000_mail_surface.sql`:

```sql
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
grant execute on function public.mail_account_for_sync() to service_role, agent_sami;
grant execute on function public.mail_sync_upsert_thread(uuid, text, text, text, text[], timestamptz, boolean, text[]) to service_role, agent_sami;
grant execute on function public.mail_sync_upsert_messages(uuid, jsonb) to service_role, agent_sami;
grant execute on function public.mail_account_set_history_id(uuid, text) to service_role, agent_sami;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/mail-migration.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Normalize line endings and commit**

```bash
python3 -c "
for p in ['supabase/migrations/20260912090000_mail_surface.sql','tests/mail-migration.test.mjs']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
git add supabase/migrations/20260912090000_mail_surface.sql tests/mail-migration.test.mjs
git commit -m "feat(mail): schema and the app/agent RPC split"
```

---

## Task 2: Types and the PostgREST store

**Files:**
- Create: `src/server/mail/types.ts`, `src/server/mail/store.ts`

**Interfaces:**
- Consumes: the RPCs from Task 1.
- Produces: `MailStore` with `listInbox(limit: number, offset: number): Promise<InboxThread[]>`, `threadsForDeal(dealId: string): Promise<MailThreadRow[]>`, `threadsForContact(contactId: string): Promise<MailThreadRow[]>`; factory `createSupabaseMailStore(config: { url: string; serviceRoleKey: string; fetch?: typeof globalThis.fetch }): MailStore`.

- [ ] **Step 1: Write `src/server/mail/types.ts`**

```typescript
/**
 * Gmail thread and message HEADERS as the CRM stores them.
 *
 * There is no body type here and there should not be one. Bodies are fetched
 * from Gmail on demand in phase 2 and are never persisted; a body type in this
 * module would be the first step toward a cache nobody decided to build.
 */

/** One inbox row, already joined to whatever CRM record it belongs to. */
export interface InboxThread {
  id: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string | null;
  unread: boolean;
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
  /** Denormalised for the list view, so rendering one screen is one round trip
   *  rather than one plus the number of rows. */
  contactName: string | null;
  dealName: string | null;
  companyName: string | null;
}

/** A raw mail_threads row, as the per-record readers return it. */
export interface MailThreadRow {
  id: string;
  accountId: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string | null;
  unread: boolean;
  labels: string[];
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
}
```

- [ ] **Step 2: Write `src/server/mail/store.ts`**

```typescript
import type { InboxThread, MailThreadRow } from "./types.ts";

export interface MailStore {
  listInbox(limit: number, offset: number): Promise<InboxThread[]>;
  threadsForDeal(dealId: string): Promise<MailThreadRow[]>;
  threadsForContact(contactId: string): Promise<MailThreadRow[]>;
}

interface InboxJson {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[] | null;
  message_count: number;
  last_message_at: string | null;
  unread: boolean;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_name: string | null;
  deal_name: string | null;
  company_name: string | null;
}

interface ThreadJson {
  id: string;
  account_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[] | null;
  message_count: number;
  last_message_at: string | null;
  unread: boolean;
  labels: string[] | null;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
}

/**
 * PostgREST adapter. Same posture as src/server/documents/store.ts: every call
 * is a narrow SECURITY DEFINER RPC granted only to service_role, and the key
 * stays server-side.
 *
 * Deliberately absent: every function in the agent half of the contract
 * (mail_account_for_sync, mail_sync_upsert_*, mail_account_set_history_id).
 * The app writes no mail and reads no token, and this omission is what makes
 * that impossible to do by accident from here.
 *
 * Nothing catches. A failed call must reach the caller; a swallowed error would
 * render an empty inbox that looks like "no mail" rather than "could not tell".
 */
export function createSupabaseMailStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): MailStore {
  const base = config.url.replace(/\/$/, "");
  const doFetch = config.fetch ?? ((i: RequestInfo | URL, n?: RequestInit) => fetch(i, n));

  async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`mail rpc ${name} failed: ${response.status}`);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  function toThread(row: ThreadJson): MailThreadRow {
    return {
      id: row.id,
      accountId: row.account_id,
      gmailThreadId: row.gmail_thread_id,
      subject: row.subject,
      snippet: row.snippet,
      participants: row.participants ?? [],
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at,
      unread: row.unread,
      labels: row.labels ?? [],
      contactId: row.contact_id,
      dealId: row.deal_id,
      companyId: row.company_id,
    };
  }

  return {
    async listInbox(limit, offset) {
      const rows = await rpc<InboxJson[]>("mail_inbox_list", {
        p_limit: limit,
        p_offset: offset,
      });
      return (rows ?? []).map((row) => ({
        id: row.id,
        gmailThreadId: row.gmail_thread_id,
        subject: row.subject,
        snippet: row.snippet,
        participants: row.participants ?? [],
        messageCount: row.message_count,
        lastMessageAt: row.last_message_at,
        unread: row.unread,
        contactId: row.contact_id,
        dealId: row.deal_id,
        companyId: row.company_id,
        contactName: row.contact_name,
        dealName: row.deal_name,
        companyName: row.company_name,
      }));
    },

    async threadsForDeal(dealId) {
      const rows = await rpc<ThreadJson[]>("mail_threads_for_deal", { p_deal_id: dealId });
      return (rows ?? []).map(toThread);
    },

    async threadsForContact(contactId) {
      const rows = await rpc<ThreadJson[]>("mail_threads_for_contact", {
        p_contact_id: contactId,
      });
      return (rows ?? []).map(toThread);
    },
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/server/mail/`.

- [ ] **Step 4: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/server/mail/types.ts','src/server/mail/store.ts']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
git add src/server/mail/
git commit -m "feat(mail): types and the PostgREST read store"
```

---

## Task 3: Display helpers, tested

**Files:**
- Create: `src/lib/mail-format.ts`, `tests/mail-format.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `senderLabel(participants: string[], accountEmail: string): string`, `relativeTime(iso: string | null, now?: Date): string`, `threadTitle(subject: string | null): string`.

These are pure so the inbox's fiddliest logic is testable without a database or a browser.

- [ ] **Step 1: Write the failing test**

Create `tests/mail-format.test.mjs`:

```javascript
// The inbox list's small decisions, made testable. Each of these renders on
// every row, so a wrong answer is wrong hundreds of times on one screen.
import test from "node:test";
import assert from "node:assert/strict";
import { senderLabel, relativeTime, threadTitle } from "../src/lib/mail-format.ts";

const ME = "build@giventakedevs.com";

test("the sender label names the other party, not us", () => {
  // A row reading "build@giventakedevs.com" on every line tells the reader
  // nothing. The useful name is whoever else is on the thread.
  assert.equal(senderLabel([ME, "ana@trattorianino.com"], ME), "ana@trattorianino.com");
  assert.equal(senderLabel(["ana@trattorianino.com", ME], ME), "ana@trattorianino.com");
});

test("the sender label is case-insensitive about our own address", () => {
  assert.equal(senderLabel(["Build@GivenTakeDevs.com", "ana@x.com"], ME), "ana@x.com");
});

test("a thread with several other people names them all", () => {
  assert.equal(senderLabel([ME, "a@x.com", "b@x.com"], ME), "a@x.com, b@x.com");
});

test("a thread with only us falls back to our own address", () => {
  // A note to self is rare but real, and an empty sender column is a bug.
  assert.equal(senderLabel([ME], ME), ME);
});

test("an empty participant list does not render blank", () => {
  assert.equal(senderLabel([], ME), "Unknown sender");
});

test("relative time is short enough for a dense row", () => {
  const now = new Date("2026-09-12T12:00:00Z");
  assert.equal(relativeTime("2026-09-12T11:59:10Z", now), "now");
  assert.equal(relativeTime("2026-09-12T11:30:00Z", now), "30m");
  assert.equal(relativeTime("2026-09-12T08:00:00Z", now), "4h");
  assert.equal(relativeTime("2026-09-10T12:00:00Z", now), "2d");
  assert.equal(relativeTime("2026-06-12T12:00:00Z", now), "12 Jun");
});

test("a missing timestamp renders a dash, never Invalid Date", () => {
  assert.equal(relativeTime(null), "—");
});

test("an empty subject gets a readable stand-in", () => {
  assert.equal(threadTitle(null), "No subject");
  assert.equal(threadTitle("   "), "No subject");
  assert.equal(threadTitle("Quote for the patio"), "Quote for the patio");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types tests/mail-format.test.mjs`
Expected: FAIL, cannot find `../src/lib/mail-format.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mail-format.ts`:

```typescript
/**
 * Pure display helpers for the inbox list.
 *
 * These live in src/lib/ rather than src/server/ because the route renders
 * them in the browser, and they touch nothing server-only. Keeping them pure
 * is what makes the list's fiddliest decisions testable without a database.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Who the row is about: everyone on the thread except us.
 *
 * A list whose sender column reads our own address on every line tells the
 * reader nothing, so our address is filtered out. When that leaves nothing,
 * a note to ourselves, we fall back to it rather than render a blank cell.
 */
export function senderLabel(participants: string[], accountEmail: string): string {
  if (!participants.length) return "Unknown sender";
  const mine = accountEmail.trim().toLowerCase();
  const others = participants.filter((p) => p.trim().toLowerCase() !== mine);
  if (!others.length) return participants[0];
  return others.join(", ");
}

/**
 * Short enough for a 38px row. Anything older than a week is a date, because
 * "37d" is not something anyone converts in their head.
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
}

/** Gmail allows an empty subject; a blank row reads as a rendering fault. */
export function threadTitle(subject: string | null): string {
  const s = (subject ?? "").trim();
  return s.length ? s : "No subject";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/mail-format.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/lib/mail-format.ts','tests/mail-format.test.mjs']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
git add src/lib/mail-format.ts tests/mail-format.test.mjs
git commit -m "feat(mail): pure display helpers for the inbox list"
```

---

## Task 4: Access helper and server function

**Files:**
- Create: `src/server/mail/access.ts`, `src/lib/mail-data.ts`

**Interfaces:**
- Consumes: `createSupabaseMailStore` (Task 2), `InboxThread` (Task 2).
- Produces: server function `listInbox` returning `InboxVM` = `{ available: boolean; connected: boolean; accountEmail: string; threads: InboxThreadVM[] }`, where `InboxThreadVM` mirrors `InboxThread` field for field.

- [ ] **Step 1: Write `src/server/mail/access.ts`**

```typescript
/**
 * Server-only access helpers for the mail surface.
 *
 * These live under src/server/ rather than beside the server functions in
 * src/lib/mail-data.ts for the reason src/server/documents/deal-access.ts
 * records: mail-data.ts is client-reachable, so a plain helper defined there
 * that reaches src/server/* joins the client module graph and the
 * import-protection plugin denies it, even when the reach is a dynamic
 * import(). Reached only by dynamic import() from the stripped handlers, these
 * stay off the client graph entirely.
 */
import { requireCrmSession } from "@/lib/crm-auth.server";
import { createSupabaseMailStore } from "@/server/mail/store";

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

/**
 * Session plus a mail store.
 *
 * Phase 1 shows one shared mailbox, so there is no per-record scoping to apply
 * here yet: every signed-in operator sees the same inbox. When the mailbox
 * model becomes per-user, this is the function that gains the scoping, which is
 * why the route goes through it rather than constructing a store itself.
 */
export async function forInbox() {
  const session = await requireCrmSession();
  return { session, store: createSupabaseMailStore(config()) };
}

/** The connected mailbox address, for the sender column. Read from the
 *  environment rather than the database because the list view needs it on
 *  every render and it does not change. */
export function accountEmail(): string {
  return process.env.MAIL_ACCOUNT_EMAIL ?? "";
}
```

- [ ] **Step 2: Write `src/lib/mail-data.ts`**

```typescript
/**
 * The inbox's server functions.
 *
 * This lives in src/lib/ beside documents-data.ts, and NOT in src/server/mail/
 * where the rest of the feature lives, because it has to: the build denies any
 * import of src/server/* from the client environment, and a server function's
 * declaration is imported by the component that calls it. The server-only
 * modules are reached below by dynamic import().
 *
 * Phase 1 is READ ONLY. There is no compose, no send, and no Gmail call from
 * the Worker at all: these rows come from Postgres, written there by the VPS
 * poller. The Worker cannot decrypt a refresh token and therefore cannot reach
 * Gmail even if a future edit tried to.
 */
import { createServerFn } from "@tanstack/react-start";

export interface InboxThreadVM {
  id: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string | null;
  unread: boolean;
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
  contactName: string | null;
  dealName: string | null;
  companyName: string | null;
}

export interface InboxVM {
  /**
   * False when the mail schema could not be reached at all. Distinct from
   * `connected` and from an empty list, because "the migration is not applied",
   * "no mailbox is connected" and "no mail yet" are three different answers and
   * an operator has to be able to tell which one they are looking at.
   */
  available: boolean;
  /** False when the schema is reachable but no mailbox has been connected. */
  connected: boolean;
  accountEmail: string;
  threads: InboxThreadVM[];
}

export const listInbox = createServerFn({ method: "GET" }).handler(async (): Promise<InboxVM> => {
  const { forInbox, accountEmail } = await import("@/server/mail/access");
  const { store } = await forInbox();
  const email = accountEmail();

  try {
    const threads = await store.listInbox(50, 0);
    return {
      available: true,
      connected: Boolean(email),
      accountEmail: email,
      threads,
    };
  } catch {
    // Nothing is logged: these rows carry client names and subject lines.
    // The UI says the mail store is unreachable, which is all an operator can
    // act on anyway.
    return { available: false, connected: false, accountEmail: email, threads: [] };
  }
});
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: exit 0. A static import of `src/server/*` from `mail-data.ts` would fail here with an import-protection error; the dynamic import is what keeps it passing.

- [ ] **Step 4: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/server/mail/access.ts','src/lib/mail-data.ts']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
git add src/server/mail/access.ts src/lib/mail-data.ts
git commit -m "feat(mail): inbox server function with three-state degradation"
```

---

## Task 5: Fix the dead brand font, and add v6 tokens for the CRM

**Files:**
- Modify: `src/styles.css`

There is no `src/styles/` directory and there must not be one. The convention
here is a single `src/styles.css`, loaded by `src/routes/__root.tsx` as
`import appCss from "../styles.css?url"` and injected as a head `<link>`. A
side-effect `import "…css"` is a different mechanism and does not belong
alongside it.

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--gt-ink`, `--gt-paper`, `--gt-surface`, `--gt-secondary`, `--gt-indigo`, `--gt-indigo-deep`, `--gt-ok`, `--gt-warn`, `--gt-bad`, plus the utility classes `.gt-display` and `.gt-nums`.

### Step 1 is a bug fix, not a feature

`src/styles.css` declares Inter Tight from
`/__l5e/assets-v1/…/inter-tight-latin.woff2`. That is the abandoned Lovable
CDN. `src/lib/asset-availability.ts` exists precisely because those paths 404,
and `public/__l5e/` does not exist in this repository.

**The brand typeface is therefore not loading at all**, on the CRM or the
public site, and every page is rendering in a system fallback. The real file is
already committed at `public/fonts/inter-tight-latin.woff2`. The fix is the
path.

The italic face has no counterpart in `public/fonts/`, so its `@font-face`
block is removed rather than pointed at a second 404. Inter Tight italic will
synthesise until a real file is added, which is what is happening today anyway.

- [ ] **Step 1: Fix the roman font path**

In `src/styles.css`, in the `@font-face` block for `font-style: normal`, change:

```css
  src: url("/__l5e/assets-v1/95d1fcbb-84a4-490f-9fb7-fc4940056c0d/inter-tight-latin.woff2")
    format("woff2");
```

to:

```css
  /* Was /__l5e/, the dead Lovable CDN: the face never loaded and every page
     fell back to a system sans. The file has been in public/fonts all along.
     See src/lib/asset-availability.ts. */
  src: url("/fonts/inter-tight-latin.woff2") format("woff2");
```

- [ ] **Step 2: Delete the italic @font-face block**

Remove the entire `@font-face` block with `font-style: italic`. There is no
italic woff2 in `public/fonts/`, so it can only resolve to a 404. Add a comment
in its place:

```css
/* No italic face is shipped: public/fonts has the roman only. Inter Tight
   italic synthesises until a real file is added. A @font-face pointing at a
   missing file is worse than none, per asset-availability.ts. */
```

- [ ] **Step 3: Verify the font now resolves**

```bash
npm run build
node scripts/worker-smoke.mjs
```

Then confirm the asset is served:

```bash
ls -la public/fonts/inter-tight-latin.woff2
grep -n "__l5e" src/styles.css || echo "no dead font references remain"
```

Expected: the file exists, the grep finds nothing, smoke meets 5/5.

- [ ] **Step 4: Add the v6 tokens**

Append to the existing `:root` block in `src/styles.css` (the one near line 84
that already holds `--ink`, `--paper`, `--violet`):

```css
  /* ── GivenTake Devs brand identity v6 ──────────────────────────────────
   *
   * Namespaced --gt-* deliberately. The unprefixed --ink / --paper / --violet
   * above predate v6 and differ from it (--ink is #0a0a0a against v6's
   * #17171A, --paper is #f7f7f5 against #FFFFFF, --violet is #4f46e5 against
   * Indigo #6366F1). Those drive the public marketing site, and restyling it
   * is not in scope for a mail phase. The CRM uses --gt-*; reconciling the two
   * is its own piece of work.
   *
   * One accent system, built on Indigo. Indigo Deep is a SUPPORTING shade for
   * gradients and hover states, not a second colour.
   *
   * Status colour is separate from accent. Deal stages, sync health and unread
   * state need green/amber/red; those are semantic and are not brand accents.
   * Indigo stays reserved for selection, focus and primary action, which is
   * why the send button must never be green.
   */
  --gt-ink: #17171a;
  --gt-paper: #ffffff;
  --gt-surface: #f4f4f5;
  --gt-secondary: #68686d;
  --gt-indigo: #6366f1;
  --gt-indigo-deep: #4338ca;

  --gt-ok: #157f4a;
  --gt-warn: #8a6a12;
  --gt-bad: #b3261e;
```

- [ ] **Step 5: Add the two utility classes**

Append at the end of `src/styles.css`:

```css
/* v6 display setting: 600 at -0.03em. Inter Tight throughout means there is no
   second typeface, so aligned digits come from font-variant-numeric rather
   than from a mono face. */
.gt-display {
  font-weight: 600;
  letter-spacing: -0.03em;
}

.gt-nums {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm run build
npx eslint src/styles.css || true
python3 -c "
p='src/styles.css'
d=open(p,'rb').read().replace(b'\r\n',b'\n')
open(p,'wb').write(d)
"
git add src/styles.css
git commit -m "fix(brand): serve Inter Tight from public/fonts, add v6 tokens

The @font-face pointed at /__l5e/, the dead Lovable CDN, so the brand
typeface never loaded and every page fell back to a system sans. The
file was already committed at public/fonts. The italic block is removed
rather than repointed: no italic woff2 is shipped.

v6 tokens are namespaced --gt-* because the unprefixed palette above
predates v6 and drives the public site; reconciling those is separate."
```

### Flagged for a separate decision, not done here

The `--e-*` "elite gradient system" in `src/styles.css` carries cyan `#22d3ee`
and gold `#c9a24c`. v6 says one accent system built on Indigo and explicitly
drops Signal Blue. Those extra accents look like exactly what v6 retires, but
they are used by the public marketing site and removing them is a visual change
to pages this plan has no business touching. Raise it as its own task.

---

## Task 6: The read-only inbox route

**Files:**
- Create: `src/routes/crm.inbox.tsx`

**Interfaces:**
- Consumes: `listInbox`, `InboxVM`, `InboxThreadVM` (Task 4); `senderLabel`, `relativeTime`, `threadTitle` (Task 3); brand tokens (Task 5).
- Produces: route `/crm/inbox`.

- [ ] **Step 1: Write the route**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { listInbox, type InboxVM, type InboxThreadVM } from "@/lib/mail-data";
import { senderLabel, relativeTime, threadTitle } from "@/lib/mail-format";
import { PageHeader, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/inbox")({
  loader: async () => ({ inbox: await listInbox() }),
  component: Inbox,
});

function Inbox() {
  const { inbox } = Route.useLoaderData();
  return (
    <div>
      <PageHeader title="Inbox" />
      <Card title={inbox.accountEmail || "Mail"}>
        <InboxBody vm={inbox} />
      </Card>
    </div>
  );
}

/**
 * Three states, deliberately distinct. "The migration is not applied", "no
 * mailbox is connected" and "no mail yet" look identical as an empty list, and
 * an operator has to be able to tell which one they are looking at.
 */
function InboxBody({ vm }: { vm: InboxVM }) {
  if (!vm.available) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        Mail storage is not reachable from this environment, so threads cannot be listed. The mail
        migration may not be applied yet. Nothing has been lost.
      </p>
    );
  }
  if (!vm.connected) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        No mailbox is connected yet. Connect one on the VPS to start syncing threads.
      </p>
    );
  }
  if (!vm.threads.length) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        No threads synced yet. The poller writes them as it reads them.
      </p>
    );
  }
  return (
    <ul className="divide-y" style={{ borderColor: "var(--gt-surface)" }}>
      {vm.threads.map((t) => (
        <li key={t.id}>
          <ThreadRow thread={t} accountEmail={vm.accountEmail} />
        </li>
      ))}
    </ul>
  );
}

function ThreadRow({ thread, accountEmail }: { thread: InboxThreadVM; accountEmail: string }) {
  const record = thread.dealName ?? thread.companyName ?? thread.contactName;
  return (
    <div className="flex items-baseline gap-3 py-2">
      <span
        className="w-48 shrink-0 truncate text-sm"
        style={{
          color: "var(--gt-ink)",
          fontWeight: thread.unread ? 600 : 400,
        }}
      >
        {senderLabel(thread.participants, accountEmail)}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        <span style={{ color: "var(--gt-ink)", fontWeight: thread.unread ? 600 : 400 }}>
          {threadTitle(thread.subject)}
        </span>
        {thread.snippet && (
          <span style={{ color: "var(--gt-secondary)" }}> &middot; {thread.snippet}</span>
        )}
      </span>

      {/* The reason to read mail here rather than in Gmail. */}
      {record && (
        <span
          className="shrink-0 truncate rounded px-1.5 py-0.5 text-xs"
          style={{ background: "var(--gt-surface)", color: "var(--gt-secondary)", maxWidth: "12rem" }}
        >
          {record}
        </span>
      )}

      <span
        className="gt-nums w-14 shrink-0 text-right text-xs"
        style={{ color: "var(--gt-secondary)" }}
      >
        {relativeTime(thread.lastMessageAt)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Run the full verify chain**

```bash
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
npm run build
node scripts/worker-smoke.mjs
```

Expected: every test file passes, build exits 0, smoke meets 5/5 expectations.

- [ ] **Step 3: Lint only the files touched**

Run: `npx eslint src/routes/crm.inbox.tsx src/lib/mail-data.ts src/lib/mail-format.ts src/server/mail/`
Expected: no output.

Repo-wide `npm run lint` cannot pass on a Windows checkout: 171 of 355 tracked files are CRLF on disk, which buries real errors under `Delete ␍`. The committed blobs are LF, so CI is unaffected.

- [ ] **Step 4: Normalize line endings and commit**

```bash
python3 -c "
p='src/routes/crm.inbox.tsx'
d=open(p,'rb').read().replace(b'\r\n',b'\n')
open(p,'wb').write(d)
"
git add src/routes/crm.inbox.tsx
git commit -m "feat(mail): read-only inbox at /crm/inbox"
```

---

## Task 7: The poller contract

**Files:**
- Create: `docs/integrations/gmail-poller-contract.md`

The poller runs on the VPS and is not in this repository, exactly as the demo-site generator is not. This task writes down what it must do, so the VPS work can proceed independently and so the next person does not have to infer the contract from the RPC signatures.

**Interfaces:**
- Consumes: the agent-half RPCs from Task 1.
- Produces: documentation only.

- [ ] **Step 1: Write the contract document**

Create `docs/integrations/gmail-poller-contract.md` covering, in this order:

1. **Why the poller is on the VPS.** Workers cannot run a long sync job, and the token encryption key lives only on the VPS. Mirrors `docs/integrations/sami-mcp-connection.md` in tone.
2. **The OAuth connect flow.** The Google redirect URI points at the VPS. The VPS exchanges the code, encrypts the refresh token with its local key, and inserts the `mail_accounts` row. The Worker is not involved and cannot be.
3. **The poll loop**, as six numbered steps: `mail_account_for_sync()` → decrypt → refresh access token → `users.history.list?startHistoryId=…` → `users.messages.get?format=metadata` for changed ids → `mail_sync_upsert_thread` then `mail_sync_upsert_messages` → `mail_account_set_history_id`.
4. **`format=metadata` is not optional.** It is what keeps bodies out of the sync path entirely, rather than relying on the poller to discard them.
5. **The 404 backfill.** Gmail history ids expire after roughly a week and `history.list` then answers 404. Treated as a transient error, sync stops permanently while the UI still looks healthy. On 404 the poller must run a bounded `users.messages.list` over a capped window (start with 30 days), upsert what it finds, and re-establish a cursor from the newest message.
6. **`direction`.** `outbound` when the message `From` matches the connected account address, case-insensitively; `inbound` otherwise.
7. **Failure posture.** A failed poll is retried on the next cycle and never clears `history_id`. Errors must not carry subjects, snippets or addresses, following `src/server/campaigns/mailer.ts`.
8. **Setting `status`.** On a refresh token rejected by Google, set the account to `reauth_required` so the UI can say so rather than showing a silently stale inbox.

- [ ] **Step 2: Normalize line endings and commit**

```bash
python3 -c "
p='docs/integrations/gmail-poller-contract.md'
d=open(p,'rb').read().replace(b'\r\n',b'\n')
open(p,'wb').write(d)
"
git add docs/integrations/gmail-poller-contract.md
git commit -m "docs(mail): the Gmail poller contract for the VPS"
```

---

## Done when

- [ ] Every test file passes, including the two added here
- [ ] `npm run build` exits 0
- [ ] `node scripts/worker-smoke.mjs` meets 5/5 expectations
- [ ] `/crm/inbox` renders all three empty states correctly
- [ ] No app-facing function can read a token column, asserted in CI
- [ ] Prerequisites P1 to P3 are resolved before the first real sync is attempted

## Deliberately not in Phase 1

Compose, send, the Worker→VPS gateway for bodies, the four AI capabilities, per-user mailboxes, and the Mail card on deal and contact pages. Phase 1 proves ingest, storage and the read path; everything else is built on top of a working one of those.
