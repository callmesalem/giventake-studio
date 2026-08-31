# Campaign Sequence Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the sender for the multi-step campaign schema that already exists in the database, so an enrolled lead receives a sequence of emails that stops when they reply, unsubscribe, bounce or become suppressed.

**Architecture:** A `scheduled` handler on the existing Cloudflare Worker claims due enrollments under a lease, re-checks the charter §3.8 gates at send time, sends via Resend, and advances the step. A Cloudflare Email Routing `email` handler detects replies by matching `In-Reply-To`/`References` against recorded provider message ids. Orchestration is pure and testable behind `CampaignStore` / `Mailer` / `Clock` ports, mirroring `src/server/operator-control/`.

**Tech Stack:** TypeScript, TanStack Start on Cloudflare Workers, Supabase Postgres via `SECURITY DEFINER` RPCs, Resend, `node:test`.

**Design doc:** `docs/superpowers/specs/2026-08-31-campaign-sequence-engine-design.md`

---

## Ordering note — read before starting

**The cron trigger is added LAST (Task 11), deliberately.** Every stop condition — reply, unsubscribe, bounce, suppression — is built and tested before the engine is capable of sending anything on a schedule. Do not reorder this. An engine that can send but cannot stop is the failure mode this whole design exists to prevent.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260831120000_campaign_engine.sql` | `campaigns.sop`, `campaign_sends`, claim/record/mark RPCs |
| `src/server/campaigns/types.ts` | `CampaignStore`, `Mailer`, `Clock`, domain types |
| `src/server/campaigns/policy.ts` | Gate evaluation, fail-closed |
| `src/server/campaigns/mailer.ts` | Resend adapter |
| `src/server/campaigns/runner.ts` | Send-tick orchestration (pure) |
| `src/server/campaigns/reply.ts` | Reply header matching (pure) |
| `src/server/campaigns/tokens.ts` | HMAC unsubscribe tokens |
| `src/server/campaigns/supabase-store.ts` | RPC adapter |
| `src/server/campaigns/index.ts` | Barrel export |
| `src/routes/api.unsubscribe.$token.ts` | Unsubscribe endpoint |
| `src/routes/api.webhooks.resend.ts` | Bounce/delivery webhook |
| `src/server.ts` | Add `scheduled` and `email` handlers |
| `wrangler.jsonc` | Cron trigger |

---

### Task 1: Migration — schema the engine needs

**Files:**
- Create: `supabase/migrations/20260831120000_campaign_engine.sql`
- Test: `tests/campaign-migration.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831120000_campaign_engine.sql"),
  "utf8",
);

test("adds the sop column the allowlist gate requires", () => {
  // is_approved_recipient(address, sop) cannot be called for a campaign without this.
  assert.match(sql, /alter table public\.campaigns\s+add column if not exists sop text/i);
});

test("campaign_sends carries the uniqueness that prevents double sends", () => {
  assert.match(sql, /create table if not exists public\.campaign_sends/i);
  assert.match(sql, /unique \(enrollment_id, step_order\)/i);
});

test("claim RPC uses SKIP LOCKED so concurrent ticks cannot claim the same row", () => {
  assert.match(sql, /for update skip locked/i);
});

test("RPCs are service_role only, matching the rest of this schema", () => {
  for (const fn of ["campaign_claim_due", "campaign_record_send", "campaign_mark_status"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}[^;]*from public`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`, "i"));
  }
});

test("the migration is additive - no destructive statements", () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function)\b/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-migration.test.mjs`
Expected: FAIL — `ENOENT: no such file or directory` for the migration.

- [ ] **Step 3: Write the migration**

```sql
-- Campaign sequence engine: the sender for the schema added in 20260818140000.
--
-- Additive only. Same security model as the rest of this schema: RLS on,
-- no anon/authenticated grants, access via narrow SECURITY DEFINER RPCs
-- granted to service_role.

-- 1. The allowlist gate takes a SOP. campaigns had nowhere to put one, so
--    is_approved_recipient() could not be called for a campaign at all.
alter table public.campaigns add column if not exists sop text;
comment on column public.campaigns.sop is
  'Charter §3.8 SOP key, passed to is_approved_recipient(address, sop). A campaign with a null sop can never pass the gate and therefore can never send.';

-- 2. One row per (enrollment, step). The unique constraint is the idempotency
--    spine: a replayed tick collides here instead of sending a second email.
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.campaign_enrollments on delete cascade,
  step_order int not null check (step_order >= 0),
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  provider_message_id text,
  attempts int not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (enrollment_id, step_order)
);

create index if not exists campaign_sends_provider_idx
  on public.campaign_sends (provider_message_id);

alter table public.campaign_sends enable row level security;
alter table public.campaign_sends force row level security;
revoke all on table public.campaign_sends from anon, authenticated;

-- 3. Claim due enrollments under a lease. SKIP LOCKED so two overlapping ticks
--    never claim the same enrollment.
create or replace function public.campaign_claim_due(p_limit int, p_lease_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  with due as (
    select e.id
    from campaign_enrollments e
    join campaigns c on c.id = e.campaign_id
    join campaign_steps s
      on s.campaign_id = e.campaign_id and s.step_order = e.current_step
    where e.status in ('enrolled','active')
      and c.status = 'active'
      and not coalesce(e.synthetic, false)
      and e.last_advanced_at + make_interval(hours => s.delay_hours) <= now()
    order by e.last_advanced_at
    limit greatest(1, least(coalesce(p_limit, 25), 200))
    for update of e skip locked
  ),
  claimed as (
    update campaign_enrollments e
    set status = 'active',
        updated_at = now(),
        last_advanced_at = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 300)))
    from due
    where e.id = due.id
    returning e.id, e.campaign_id, e.lead_id, e.current_step
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'enrollmentId', cl.id,
    'campaignId',   cl.campaign_id,
    'stepOrder',    cl.current_step,
    'sop',          c.sop,
    'email',        l.email,
    'name',         l.name,
    'template',     s.template
  )), '[]'::jsonb)
  into result
  from claimed cl
  join campaigns c on c.id = cl.campaign_id
  join campaign_steps s on s.campaign_id = cl.campaign_id and s.step_order = cl.current_step
  join leads l on l.id = cl.lead_id;

  return result;
end;
$$;

-- 4. Record a send attempt. Returns false when the (enrollment, step) row
--    already exists, which is how a replay is refused.
create or replace function public.campaign_record_send(
  p_enrollment_id uuid, p_step_order int, p_status text,
  p_provider_message_id text default null, p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted boolean;
begin
  insert into campaign_sends (enrollment_id, step_order, status, provider_message_id, error, attempts, sent_at)
  values (p_enrollment_id, p_step_order, p_status, p_provider_message_id, p_error, 1,
          case when p_status = 'sent' then now() else null end)
  on conflict (enrollment_id, step_order) do nothing;

  get diagnostics inserted = row_count;
  if not inserted then
    update campaign_sends
      set status = p_status,
          provider_message_id = coalesce(p_provider_message_id, provider_message_id),
          error = p_error,
          attempts = attempts + 1,
          sent_at = case when p_status = 'sent' then now() else sent_at end
      where enrollment_id = p_enrollment_id and step_order = p_step_order
        and status = 'sending';
    return false;
  end if;
  return true;
end;
$$;

-- 5. Move an enrollment to a terminal or advanced state, with an audit event.
create or replace function public.campaign_mark_status(
  p_enrollment_id uuid, p_status text, p_advance boolean default false,
  p_event_type text default 'status_changed', p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update campaign_enrollments
    set status = p_status,
        current_step = case when p_advance then current_step + 1 else current_step end,
        last_advanced_at = now(),
        updated_at = now()
    where id = p_enrollment_id;

  insert into campaign_events (enrollment_id, event_type, details)
  values (p_enrollment_id, p_event_type, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.campaign_claim_due(int, int) from public;
grant execute on function public.campaign_claim_due(int, int) to service_role;
revoke all on function public.campaign_record_send(uuid, int, text, text, text) from public;
grant execute on function public.campaign_record_send(uuid, int, text, text, text) to service_role;
revoke all on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) from public;
grant execute on function public.campaign_mark_status(uuid, text, boolean, text, jsonb) to service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-migration.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260831120000_campaign_engine.sql tests/campaign-migration.test.mjs
git commit -m "feat(campaigns): schema for the sequence engine"
```

---

### Task 2: Ports and domain types

**Files:**
- Create: `src/server/campaigns/types.ts`

- [ ] **Step 1: Write the types** (no test — types alone assert nothing at runtime; Task 3 exercises them)

```ts
/** A single due step, as returned by campaign_claim_due. */
export interface DueSend {
  enrollmentId: string;
  campaignId: string;
  stepOrder: number;
  sop: string | null;
  email: string | null;
  name: string | null;
  template: { subject?: string; text?: string };
}

export interface SendOutcome {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  /** True when the provider rejected the address outright — retrying cannot help. */
  permanent?: boolean;
}

export interface Mailer {
  send(input: {
    to: string;
    subject: string;
    text: string;
    replyTo: string;
    headers?: Record<string, string>;
  }): Promise<SendOutcome>;
}

export interface CampaignStore {
  claimDue(limit: number, leaseSeconds: number): Promise<DueSend[]>;
  isSuppressed(address: string): Promise<boolean>;
  isApprovedRecipient(address: string, sop: string): Promise<boolean>;
  recordSend(
    enrollmentId: string,
    stepOrder: number,
    status: "sending" | "sent" | "failed",
    providerMessageId?: string,
    error?: string,
  ): Promise<boolean>;
  markStatus(
    enrollmentId: string,
    status: string,
    advance: boolean,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void>;
  attemptsFor(enrollmentId: string, stepOrder: number): Promise<number>;
}

export interface Clock {
  now(): Date;
}

export const MAX_ATTEMPTS = 3;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/server/campaigns/types.ts
git commit -m "feat(campaigns): ports for the sequence engine"
```

---

### Task 3: Gate policy — fail closed

**Files:**
- Create: `src/server/campaigns/policy.ts`
- Test: `tests/campaign-policy.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGates } from "../src/server/campaigns/policy.ts";

const store = (over = {}) => ({
  async isSuppressed() { return false; },
  async isApprovedRecipient() { return true; },
  ...over,
});

test("allows a suppression-free, approved recipient", async () => {
  const d = await evaluateGates(store(), { email: "a@b.com", sop: "outreach" });
  assert.deepEqual(d, { allow: true });
});

test("refuses a suppressed address", async () => {
  const d = await evaluateGates(store({ async isSuppressed() { return true; } }), {
    email: "a@b.com", sop: "outreach",
  });
  assert.deepEqual(d, { allow: false, status: "suppressed", reason: "do_not_contact" });
});

test("refuses an address not on the allowlist", async () => {
  const d = await evaluateGates(store({ async isApprovedRecipient() { return false; } }), {
    email: "a@b.com", sop: "outreach",
  });
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "not_approved" });
});

test("refuses a campaign with no SOP - the gate cannot be evaluated", async () => {
  const d = await evaluateGates(store(), { email: "a@b.com", sop: null });
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "no_sop" });
});

test("refuses an enrollment with no address", async () => {
  const d = await evaluateGates(store(), { email: null, sop: "outreach" });
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "no_address" });
});

test("a throwing suppression check refuses, it does not send", async () => {
  const d = await evaluateGates(
    store({ async isSuppressed() { throw new Error("network"); } }),
    { email: "a@b.com", sop: "outreach" },
  );
  assert.equal(d.allow, false);
});

test("a throwing allowlist check refuses, it does not send", async () => {
  const d = await evaluateGates(
    store({ async isApprovedRecipient() { throw new Error("network"); } }),
    { email: "a@b.com", sop: "outreach" },
  );
  assert.equal(d.allow, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-policy.test.mjs`
Expected: FAIL — cannot find module `policy.ts`.

- [ ] **Step 3: Write the implementation**

```ts
import type { CampaignStore } from "./types.ts";

export interface GateDecision {
  allow: boolean;
  status?: "suppressed" | "stopped";
  reason?: string;
}

/**
 * Charter §3.8. Both checks fail closed: a network error refuses the send
 * rather than allowing it, matching how crm-data.ts already treats these
 * (`.catch(() => true)` for suppression, `.catch(() => false)` for approval).
 *
 * Evaluated at send time, not enrollment time: an address can reach
 * do_not_contact, or an approval can pass expires_at, mid-sequence.
 */
export async function evaluateGates(
  store: Pick<CampaignStore, "isSuppressed" | "isApprovedRecipient">,
  input: { email: string | null; sop: string | null },
): Promise<GateDecision> {
  if (!input.email) return { allow: false, status: "stopped", reason: "no_address" };
  if (!input.sop) return { allow: false, status: "stopped", reason: "no_sop" };

  const suppressed = await store.isSuppressed(input.email).catch(() => true);
  if (suppressed) return { allow: false, status: "suppressed", reason: "do_not_contact" };

  const approved = await store.isApprovedRecipient(input.email, input.sop).catch(() => false);
  if (!approved) return { allow: false, status: "stopped", reason: "not_approved" };

  return { allow: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-policy.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/campaigns/policy.ts tests/campaign-policy.test.mjs
git commit -m "feat(campaigns): fail-closed gate evaluation"
```

---

### Task 4: Resend mailer adapter

**Files:**
- Create: `src/server/campaigns/mailer.ts`
- Test: `tests/campaign-mailer.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createResendMailer } from "../src/server/campaigns/mailer.ts";

const ok = (body) => ({ ok: true, status: 200, async json() { return body; } });

test("sends and returns the provider message id", async () => {
  let seen;
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async (url, init) => { seen = { url, init }; return ok({ id: "msg-1" }); },
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.deepEqual(out, { status: "sent", providerMessageId: "msg-1" });
  assert.equal(seen.url, "https://api.resend.com/emails");
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(body.to, ["x@y.com"]);
  assert.equal(body.reply_to, "r@b.com");
});

test("a 422 is permanent - retrying a rejected address cannot help", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 422, async json() { return {}; } }),
  });
  const out = await mailer.send({ to: "bad", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.equal(out.permanent, true);
});

test("a 429 is not permanent - rate limiting should be retried", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 429, async json() { return {}; } }),
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.notEqual(out.permanent, true);
});

test("a thrown network error is not permanent", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => { throw new Error("boom"); },
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.notEqual(out.permanent, true);
});

test("never puts the message body in the error - it is personal data", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 500, async json() { return { detail: "SECRET" }; } }),
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "SECRET", replyTo: "r@b.com" });
  assert.doesNotMatch(out.error ?? "", /SECRET/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-mailer.test.mjs`
Expected: FAIL — cannot find module `mailer.ts`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Mailer, SendOutcome } from "./types.ts";

/**
 * Resend adapter. Same endpoint and auth shape as the transactional sender in
 * src/lib/intake.ts, with two additions the engine needs: custom headers (for
 * List-Unsubscribe) and the provider message id, which reply matching depends on.
 *
 * Errors never carry the response body or the message text: both echo personal data.
 */
export function createResendMailer(config: {
  apiKey: string;
  from: string;
  fetch?: typeof globalThis.fetch;
}): Mailer {
  const doFetch = config.fetch ?? ((i, n) => fetch(i, n));

  return {
    async send(input): Promise<SendOutcome> {
      try {
        const response = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            reply_to: input.replyTo,
            headers: input.headers,
          }),
        });

        if (!response.ok) {
          // 4xx that is not rate limiting means the request itself is wrong.
          const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
          return { status: "failed", error: `resend_${response.status}`, permanent };
        }

        const body = (await response.json()) as { id?: string };
        return { status: "sent", providerMessageId: body.id };
      } catch {
        return { status: "failed", error: "resend_network" };
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-mailer.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/campaigns/mailer.ts tests/campaign-mailer.test.mjs
git commit -m "feat(campaigns): Resend adapter with permanent-failure detection"
```

---

### Task 5: The send tick

**Files:**
- Create: `src/server/campaigns/runner.ts`
- Test: `tests/campaign-runner.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { runSendTick } from "../src/server/campaigns/runner.ts";

const due = (over = {}) => ({
  enrollmentId: "e1", campaignId: "c1", stepOrder: 0,
  sop: "outreach", email: "x@y.com", name: "X",
  template: { subject: "Hello {{name}}", text: "Hi {{name}}" },
  ...over,
});

const harness = (over = {}) => {
  const calls = { sends: [], statuses: [], records: [] };
  const store = {
    async claimDue() { return over.dueRows ?? [due()]; },
    async isSuppressed() { return over.suppressed ?? false; },
    async isApprovedRecipient() { return over.approved ?? true; },
    async recordSend(id, step, status, msgId, error) {
      calls.records.push({ id, step, status, msgId, error });
      return over.recordSendResult ?? true;
    },
    async markStatus(id, status, advance, eventType, details) {
      calls.statuses.push({ id, status, advance, eventType, details });
    },
    async attemptsFor() { return over.attempts ?? 0; },
  };
  const mailer = {
    async send(input) {
      calls.sends.push(input);
      return over.sendOutcome ?? { status: "sent", providerMessageId: "m1" };
    },
  };
  return { calls, store, mailer, deps: { store, mailer, clock: { now: () => new Date("2026-08-31T12:00:00Z") }, replyTo: "reply@giventakedevs.com", unsubscribeBase: "https://giventakedevs.com/api/unsubscribe" } };
};

test("sends a due step and advances the enrollment", async () => {
  const h = harness();
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 1);
  assert.equal(h.calls.sends[0].to, "x@y.com");
  assert.equal(h.calls.sends[0].subject, "Hello X");
  const advanced = h.calls.statuses.find((s) => s.advance);
  assert.ok(advanced, "expected the enrollment to advance");
});

test("a suppressed address is never mailed", async () => {
  const h = harness({ suppressed: true });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses[0].status, "suppressed");
});

test("an unapproved address is never mailed and records why", async () => {
  const h = harness({ approved: false });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses[0].status, "stopped");
  assert.equal(h.calls.statuses[0].details.reason, "not_approved");
});

test("a replayed step does not send twice", async () => {
  // recordSend returning false means the (enrollment, step) row already existed.
  const h = harness({ recordSendResult: false });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0, "must not send when the step is already recorded");
});

test("a permanent failure stops immediately without burning retries", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_422", permanent: true } });
  await runSendTick(h.deps);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
});

test("a transient failure leaves the enrollment retryable", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" }, attempts: 0 });
  await runSendTick(h.deps);
  assert.notEqual(h.calls.statuses.at(-1)?.status, "stopped");
});

test("a transient failure stops after MAX_ATTEMPTS", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" }, attempts: 3 });
  await runSendTick(h.deps);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
});

test("every message carries a List-Unsubscribe header", async () => {
  const h = harness();
  await runSendTick(h.deps);
  assert.match(h.calls.sends[0].headers["List-Unsubscribe"], /^<https:\/\//);
});

test("one bad enrollment does not abort the rest of the tick", async () => {
  const h = harness({ dueRows: [due({ enrollmentId: "e1", email: null }), due({ enrollmentId: "e2" })] });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 1, "the healthy enrollment must still send");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-runner.test.mjs`
Expected: FAIL — cannot find module `runner.ts`.

- [ ] **Step 3: Write the implementation**

```ts
import { evaluateGates } from "./policy.ts";
import { MAX_ATTEMPTS, type CampaignStore, type Clock, type Mailer, type DueSend } from "./types.ts";
import { unsubscribeToken } from "./tokens.ts";

export interface RunnerDeps {
  store: CampaignStore;
  mailer: Mailer;
  clock: Clock;
  replyTo: string;
  unsubscribeBase: string;
  secret?: string;
  limit?: number;
  leaseSeconds?: number;
}

function render(template: string, row: DueSend): string {
  return template.replace(/\{\{name\}\}/g, row.name ?? "there");
}

/**
 * One tick. Claims due enrollments, re-checks the gates for each, sends, and
 * advances. A failure on one enrollment is contained so the rest of the batch
 * still runs — a single bad row must not stall the queue.
 */
export async function runSendTick(deps: RunnerDeps): Promise<{ sent: number; skipped: number }> {
  const rows = await deps.store.claimDue(deps.limit ?? 25, deps.leaseSeconds ?? 300);
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const gate = await evaluateGates(deps.store, { email: row.email, sop: row.sop });
      if (!gate.allow) {
        skipped++;
        await deps.store.markStatus(row.enrollmentId, gate.status ?? "stopped", false, "gate_refused", {
          reason: gate.reason,
          step: row.stepOrder,
        });
        continue;
      }

      // Claim the step before sending. A false return means this (enrollment,
      // step) was already recorded, so another tick has it — never send again.
      const claimed = await deps.store.recordSend(row.enrollmentId, row.stepOrder, "sending");
      if (!claimed) {
        skipped++;
        continue;
      }

      const token = await unsubscribeToken(row.enrollmentId, deps.secret ?? "");
      const url = `${deps.unsubscribeBase}/${token}`;
      const outcome = await deps.mailer.send({
        to: row.email as string,
        subject: render(row.template.subject ?? "", row),
        text: `${render(row.template.text ?? "", row)}\n\n---\nUnsubscribe: ${url}`,
        replyTo: deps.replyTo,
        headers: { "List-Unsubscribe": `<${url}>` },
      });

      if (outcome.status === "sent") {
        sent++;
        await deps.store.recordSend(row.enrollmentId, row.stepOrder, "sent", outcome.providerMessageId);
        await deps.store.markStatus(row.enrollmentId, "active", true, "sent", {
          step: row.stepOrder,
          messageId: outcome.providerMessageId,
        });
        continue;
      }

      skipped++;
      await deps.store.recordSend(row.enrollmentId, row.stepOrder, "failed", undefined, outcome.error);
      const attempts = await deps.store.attemptsFor(row.enrollmentId, row.stepOrder);
      if (outcome.permanent || attempts >= MAX_ATTEMPTS) {
        await deps.store.markStatus(row.enrollmentId, "stopped", false, "send_failed", {
          step: row.stepOrder,
          error: outcome.error,
          permanent: Boolean(outcome.permanent),
        });
      }
    } catch (error) {
      skipped++;
      console.error("campaign tick error", error instanceof Error ? error.message : "unknown");
    }
  }

  return { sent, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-runner.test.mjs`
Expected: PASS, 9 tests. (Task 6 creates `tokens.ts`; if running this task alone, stub `unsubscribeToken` to return `"t"` and replace it in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/server/campaigns/runner.ts tests/campaign-runner.test.mjs
git commit -m "feat(campaigns): send tick with gates re-checked at send time"
```

---

### Task 6: Unsubscribe tokens

**Files:**
- Create: `src/server/campaigns/tokens.ts`
- Test: `tests/campaign-tokens.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { unsubscribeToken, verifyUnsubscribeToken } from "../src/server/campaigns/tokens.ts";

test("a token round-trips to its enrollment id", async () => {
  const t = await unsubscribeToken("e1", "secret");
  assert.equal(await verifyUnsubscribeToken(t, "secret"), "e1");
});

test("a forged signature is rejected", async () => {
  const t = await unsubscribeToken("e1", "secret");
  const forged = `${t.split(".")[0]}.deadbeef`;
  assert.equal(await verifyUnsubscribeToken(forged, "secret"), null);
});

test("a token signed with another secret is rejected", async () => {
  const t = await unsubscribeToken("e1", "secret");
  assert.equal(await verifyUnsubscribeToken(t, "other"), null);
});

test("swapping the payload invalidates the token", async () => {
  const t = await unsubscribeToken("e1", "secret");
  const other = await unsubscribeToken("e2", "secret");
  const spliced = `${other.split(".")[0]}.${t.split(".")[1]}`;
  assert.equal(await verifyUnsubscribeToken(spliced, "secret"), null);
});

test("malformed input is rejected rather than throwing", async () => {
  for (const bad of ["", "nodot", "a.b.c", "..", "!!.??"]) {
    assert.equal(await verifyUnsubscribeToken(bad, "secret"), null);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-tokens.test.mjs`
Expected: FAIL — cannot find module `tokens.ts`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Signed unsubscribe tokens. Unguessable so the endpoint cannot be enumerated
 * to unsubscribe other people, and verified in constant time.
 *
 * WebCrypto rather than node:crypto — this runs on Cloudflare Workers.
 */
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(new Uint8Array(mac));
}

export async function unsubscribeToken(enrollmentId: string, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(enrollmentId));
  return `${payload}.${await sign(payload, secret)}`;
}

/** Returns the enrollment id, or null for anything that does not verify. */
export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expected = await sign(parts[0], secret);
  if (expected.length !== parts[1].length) return null;

  // Constant time: never leak how much of the signature matched.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const padded = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    return atob(padded) || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-tokens.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/campaigns/tokens.ts tests/campaign-tokens.test.mjs
git commit -m "feat(campaigns): signed unsubscribe tokens"
```

---

### Task 7: Reply matching

**Files:**
- Create: `src/server/campaigns/reply.ts`
- Test: `tests/campaign-reply.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractReferencedMessageIds } from "../src/server/campaigns/reply.ts";

test("reads In-Reply-To", () => {
  assert.deepEqual(extractReferencedMessageIds({ "in-reply-to": "<abc@resend>" }), ["abc@resend"]);
});

test("reads every id in References, newest last", () => {
  assert.deepEqual(
    extractReferencedMessageIds({ references: "<a@x> <b@x>" }),
    ["a@x", "b@x"],
  );
});

test("merges both headers without duplicates", () => {
  const ids = extractReferencedMessageIds({ "in-reply-to": "<b@x>", references: "<a@x> <b@x>" });
  assert.deepEqual(ids.sort(), ["a@x", "b@x"]);
});

test("header names are case-insensitive", () => {
  assert.deepEqual(extractReferencedMessageIds({ "In-Reply-To": "<abc@x>" }), ["abc@x"]);
});

test("mail with no threading headers yields nothing", () => {
  assert.deepEqual(extractReferencedMessageIds({ subject: "hi" }), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-reply.test.mjs`
Expected: FAIL — cannot find module `reply.ts`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Pull the message ids a reply threads onto, so an inbound mail can be matched
 * to campaign_sends.provider_message_id.
 *
 * Header matching rather than tagged reply-to addresses: it survives forwards
 * and clients that rewrite the envelope, and it needs no special addressing.
 */
export function extractReferencedMessageIds(headers: Record<string, string>): string[] {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;

  const raw = [lower["in-reply-to"], lower["references"]].filter(Boolean).join(" ");
  const ids = raw.match(/<([^>]+)>/g) ?? [];
  return [...new Set(ids.map((id) => id.slice(1, -1)))];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/campaign-reply.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/campaigns/reply.ts tests/campaign-reply.test.mjs
git commit -m "feat(campaigns): match replies by threading headers"
```

---

### Task 8: Supabase store adapter

**Files:**
- Create: `src/server/campaigns/supabase-store.ts`
- Create: `src/server/campaigns/index.ts`
- Test: `tests/campaign-store.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseCampaignStore } from "../src/server/campaigns/supabase-store.ts";

const store = (handler) => createSupabaseCampaignStore({
  url: "https://p.supabase.co", serviceRoleKey: "svc", fetch: handler,
});

test("claimDue maps RPC rows into DueSend", async () => {
  const s = store(async () => ({
    ok: true, status: 200,
    async json() {
      return [{ enrollmentId: "e1", campaignId: "c1", stepOrder: 0, sop: "outreach",
                email: "x@y.com", name: "X", template: { subject: "S", text: "T" } }];
    },
  }));
  const rows = await s.claimDue(10, 300);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].enrollmentId, "e1");
});

test("claimDue sends the service role key and hits the RPC path", async () => {
  let seen;
  const s = store(async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, async json() { return []; } };
  });
  await s.claimDue(10, 300);
  assert.match(seen.url, /\/rest\/v1\/rpc\/campaign_claim_due$/);
  assert.equal(seen.init.headers.apikey, "svc");
});

test("a failed claim throws rather than silently returning nothing", async () => {
  const s = store(async () => ({ ok: false, status: 500, async json() { return {}; } }));
  await assert.rejects(() => s.claimDue(10, 300));
});

test("recordSend returns the RPC's boolean", async () => {
  const s = store(async () => ({ ok: true, status: 200, async json() { return false; } }));
  assert.equal(await s.recordSend("e1", 0, "sending"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/campaign-store.test.mjs`
Expected: FAIL — cannot find module `supabase-store.ts`.

- [ ] **Step 3: Write the implementation**

```ts
import type { CampaignStore, DueSend } from "./types.ts";

/**
 * PostgREST adapter. Every call is a narrow SECURITY DEFINER RPC granted only
 * to service_role — the same posture as src/server/crm/read.ts. The key stays
 * server-side and never reaches the browser.
 */
export function createSupabaseCampaignStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): CampaignStore {
  const base = config.url.replace(/\/$/, "");
  const doFetch = config.fetch ?? ((i, n) => fetch(i, n));

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
    if (!response.ok) throw new Error(`campaign rpc ${name} failed: ${response.status}`);
    return (await response.json()) as T;
  }

  return {
    async claimDue(limit, leaseSeconds) {
      const rows = await rpc<DueSend[]>("campaign_claim_due", {
        p_limit: limit, p_lease_seconds: leaseSeconds,
      });
      return Array.isArray(rows) ? rows : [];
    },
    isSuppressed: (address) => rpc<boolean>("operator_is_suppressed", { p_address: address }),
    isApprovedRecipient: (address, sop) =>
      rpc<boolean>("is_approved_recipient", { p_address: address, p_sop: sop }),
    recordSend: (enrollmentId, stepOrder, status, providerMessageId, error) =>
      rpc<boolean>("campaign_record_send", {
        p_enrollment_id: enrollmentId, p_step_order: stepOrder, p_status: status,
        p_provider_message_id: providerMessageId ?? null, p_error: error ?? null,
      }),
    markStatus: (enrollmentId, status, advance, eventType, details) =>
      rpc<void>("campaign_mark_status", {
        p_enrollment_id: enrollmentId, p_status: status, p_advance: advance,
        p_event_type: eventType, p_details: details,
      }),
    async attemptsFor(enrollmentId, stepOrder) {
      const rows = await rpc<{ attempts?: number }[]>("campaign_attempts", {
        p_enrollment_id: enrollmentId, p_step_order: stepOrder,
      }).catch(() => []);
      return Array.isArray(rows) && rows[0]?.attempts ? rows[0].attempts : 0;
    },
  };
}
```

- [ ] **Step 4: Add `campaign_attempts` to the migration**

Append to `supabase/migrations/20260831120000_campaign_engine.sql`:

```sql
create or replace function public.campaign_attempts(p_enrollment_id uuid, p_step_order int)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('attempts', attempts)), '[]'::jsonb)
  from campaign_sends
  where enrollment_id = p_enrollment_id and step_order = p_step_order
$$;

revoke all on function public.campaign_attempts(uuid, int) from public;
grant execute on function public.campaign_attempts(uuid, int) to service_role;
```

- [ ] **Step 5: Write the barrel export**

```ts
export * from "./types.ts";
export * from "./policy.ts";
export * from "./runner.ts";
export * from "./mailer.ts";
export * from "./tokens.ts";
export * from "./reply.ts";
export * from "./supabase-store.ts";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --experimental-strip-types tests/campaign-store.test.mjs && node --experimental-strip-types tests/campaign-migration.test.mjs`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add src/server/campaigns/ supabase/migrations/20260831120000_campaign_engine.sql tests/campaign-store.test.mjs
git commit -m "feat(campaigns): Supabase RPC adapter"
```

---

### Task 9: Unsubscribe endpoint

**Files:**
- Create: `src/routes/api.unsubscribe.$token.ts`

- [ ] **Step 1: Write the route**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { verifyUnsubscribeToken } from "@/server/campaigns/tokens.ts";
import { createSupabaseCampaignStore } from "@/server/campaigns/supabase-store.ts";

/**
 * One-click unsubscribe. Always answers 200 with the same body: a different
 * response for a bad token would let someone probe which tokens are real.
 */
export const Route = createFileRoute("/api/unsubscribe/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const secret = process.env.CAMPAIGN_TOKEN_SECRET;
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (secret && url && key) {
          const enrollmentId = await verifyUnsubscribeToken(params.token, secret);
          if (enrollmentId) {
            const store = createSupabaseCampaignStore({ url, serviceRoleKey: key });
            await store
              .markStatus(enrollmentId, "unsubscribed", false, "unsubscribed", { via: "link" })
              .catch(() => undefined);
          }
        }

        return new Response("You have been unsubscribed.", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
```

- [ ] **Step 2: Regenerate the route tree and typecheck**

Run: `npx vite build && npx tsc --noEmit`
Expected: build succeeds, `src/routeTree.gen.ts` updated, tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api.unsubscribe.\$token.ts src/routeTree.gen.ts
git commit -m "feat(campaigns): one-click unsubscribe endpoint"
```

---

### Task 10: Bounce webhook and reply handler

**Files:**
- Create: `src/routes/api.webhooks.resend.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write the bounce webhook**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseCampaignStore } from "@/server/campaigns/supabase-store.ts";

/**
 * Resend delivery events. Only bounces and complaints matter here: both are
 * terminal for an enrollment, and a complaint is the strongest possible signal
 * to stop.
 */
export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return new Response("unconfigured", { status: 503 });

        const payload = (await request.json().catch(() => null)) as
          | { type?: string; data?: { email_id?: string } }
          | null;
        const type = payload?.type ?? "";
        if (!/bounced|complained/.test(type)) return new Response("ignored", { status: 200 });

        const messageId = payload?.data?.email_id;
        if (!messageId) return new Response("no id", { status: 200 });

        const store = createSupabaseCampaignStore({ url, serviceRoleKey: key });
        await store
          .markStatusByMessageId(messageId, "bounced", "bounced", { type })
          .catch(() => undefined);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
```

- [ ] **Step 2: Add `markStatusByMessageId` to the store and a matching RPC**

Add to `CampaignStore` in `src/server/campaigns/types.ts`:

```ts
  markStatusByMessageId(
    providerMessageId: string,
    status: string,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void>;
```

Add to `createSupabaseCampaignStore`:

```ts
    markStatusByMessageId: (providerMessageId, status, eventType, details) =>
      rpc<void>("campaign_mark_by_message", {
        p_provider_message_id: providerMessageId, p_status: status,
        p_event_type: eventType, p_details: details,
      }),
```

Append to the migration:

```sql
create or replace function public.campaign_mark_by_message(
  p_provider_message_id text, p_status text,
  p_event_type text default 'status_changed', p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enrollment uuid;
begin
  select enrollment_id into v_enrollment
  from campaign_sends where provider_message_id = p_provider_message_id limit 1;
  if v_enrollment is null then return; end if;

  update campaign_enrollments
    set status = p_status, updated_at = now() where id = v_enrollment;
  insert into campaign_events (enrollment_id, event_type, details)
  values (v_enrollment, p_event_type, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.campaign_mark_by_message(text, text, text, jsonb) from public;
grant execute on function public.campaign_mark_by_message(text, text, text, jsonb) to service_role;
```

- [ ] **Step 3: Add the `email` handler to `src/server.ts`**

Add this export inside the default object, after `fetch`:

```ts
  /**
   * Cloudflare Email Routing. Marks the enrollment replied, then forwards the
   * message on regardless. The engine must never be the reason a customer
   * reply goes unseen — forwarding happens even when matching fails.
   */
  async email(message: {
    headers: Headers;
    forward: (to: string) => Promise<void>;
  }) {
    try {
      const { extractReferencedMessageIds } = await import("./server/campaigns/reply.ts");
      const { createSupabaseCampaignStore } = await import("./server/campaigns/supabase-store.ts");

      const headers: Record<string, string> = {};
      message.headers.forEach((value, key) => { headers[key] = value; });

      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const store = createSupabaseCampaignStore({ url, serviceRoleKey: key });
        for (const id of extractReferencedMessageIds(headers)) {
          await store
            .markStatusByMessageId(id, "replied", "replied", { messageId: id })
            .catch(() => undefined);
        }
      }
    } catch (error) {
      console.error("email handler", error instanceof Error ? error.message : "unknown");
    } finally {
      const to = process.env.CAMPAIGN_FORWARD_TO;
      if (to) await message.forward(to).catch(() => undefined);
    }
  },
```

- [ ] **Step 4: Regenerate, typecheck, run the suite**

Run: `npx vite build && npx tsc --noEmit && bun run test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api.webhooks.resend.ts src/server.ts src/server/campaigns/ src/routeTree.gen.ts supabase/migrations/20260831120000_campaign_engine.sql
git commit -m "feat(campaigns): bounce webhook and reply detection"
```

---

### Task 11: Arm the engine — cron trigger

**Do this last.** Every stop condition exists by now.

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `src/server.ts`

- [ ] **Step 1: Add the cron trigger to `wrangler.jsonc`**

```jsonc
  "triggers": {
    "crons": ["*/5 * * * *"],
  },
```

- [ ] **Step 2: Add the `scheduled` handler to `src/server.ts`**

Add inside the default object:

```ts
  async scheduled() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.INTAKE_FROM_EMAIL;
    const secret = process.env.CAMPAIGN_TOKEN_SECRET;
    const replyTo = process.env.CAMPAIGN_REPLY_TO;
    const base = process.env.CAMPAIGN_UNSUBSCRIBE_BASE;

    // Unconfigured is a no-op, never a partial send.
    if (!url || !key || !apiKey || !from || !secret || !replyTo || !base) {
      console.warn("campaign tick skipped: unconfigured");
      return;
    }

    const { runSendTick } = await import("./server/campaigns/runner.ts");
    const { createSupabaseCampaignStore } = await import("./server/campaigns/supabase-store.ts");
    const { createResendMailer } = await import("./server/campaigns/mailer.ts");

    const result = await runSendTick({
      store: createSupabaseCampaignStore({ url, serviceRoleKey: key }),
      mailer: createResendMailer({ apiKey, from }),
      clock: { now: () => new Date() },
      replyTo,
      unsubscribeBase: base,
      secret,
    });
    console.log(`campaign tick: sent=${result.sent} skipped=${result.skipped}`);
  },
```

- [ ] **Step 3: Verify the whole suite and build**

Run: `bun run test && bun run test:components && npx tsc --noEmit && npx vite build`
Expected: all green, route tree unchanged.

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc src/server.ts
git commit -m "feat(campaigns): arm the send tick on a 5-minute cron"
```

---

## Self-review

**Spec coverage:** `campaigns.sop` → Task 1. `campaign_sends` uniqueness → Task 1. Claim RPCs with `SKIP LOCKED` → Task 1. Ports mirroring operator-control → Task 2. Fail-closed gates at send time → Tasks 3, 5. Resend adapter → Task 4. Send tick + ambiguity-as-sent → Task 5. Unsubscribe tokens → Task 6. Reply header matching → Task 7. Store adapter → Task 8. Unsubscribe endpoint → Task 9. Bounce webhook + reply handler + forwarding → Task 10. Cron → Task 11. Every test named in the spec's testing table appears in Tasks 3–8.

**Ambiguity-as-sent** is realised by `campaign_record_send`: a `sending` row already present makes the claim return false, and Task 5's replay test asserts no second send.

**Type consistency:** `markStatusByMessageId` is added to `CampaignStore` in Task 10 alongside its implementation and RPC. `attemptsFor` is defined in Task 2, implemented in Task 8, backed by `campaign_attempts` added in Task 8 Step 4. `MAX_ATTEMPTS` is defined in Task 2 and used in Task 5.

**Known forward reference:** Task 5 imports `tokens.ts`, created in Task 6. Task 5 Step 4 notes the stub if tasks run strictly in order.
