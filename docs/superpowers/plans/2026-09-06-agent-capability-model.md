# Agent Capability Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `operators_enabled` actually stop an agent writing, and make each of Sami's ten write capabilities individually switchable.

**Architecture:** A guard function `agent_require(capability)` reads `session_user`, checks the global kill switch then a per-agent-per-capability row, writes an audit event, and raises on refusal. Each of the ten write functions calls it as its first statement. Identity comes from one Postgres role per agent.

**Tech Stack:** PostgreSQL (SECURITY DEFINER functions, role-based identity), Supabase migrations, `node --experimental-strip-types` for migration text assertions.

**Spec:** `docs/superpowers/specs/2026-09-06-agent-capability-model-design.md`

---

## Read this before Task 1

**The trap this plan exists to avoid.** All ten write functions are
`SECURITY DEFINER` owned by `postgres`. Inside them, `current_user` is `postgres`
for *every* caller. A guard reading `current_user` allows everything or denies
everything, and **looks correct in review**. Read `session_user`.

**The migration is NOT applied by this plan.** Migrations here are applied
manually and deliberately. Do not call any Supabase MCP tool that writes. Read-only
inspection of the live schema is expected and necessary.

**`deal_advance_stage` has no definition in this repo.** It runs in production and
nothing under `supabase/migrations/` creates it. Its only source of truth is
`pg_get_functiondef` against the live database. Task 1 exists because of this.

**Scope: Sami's role only.** Piper, Cade, nova and inbox are configured but idle,
cannot currently be spawned, and two have had no activity since 2026-08-20.
Creating roles for agents that never connect is speculative. The table is keyed by
`agent_role`, so adding them later is rows, not schema.

**Scope: this makes restriction possible, it does not restrict.** All ten
capabilities are seeded enabled, reproducing today's behaviour exactly. Deciding
what Sami may actually do is a separate change, made deliberately, after this lands.

**The dashboard shares these functions.** `src/server/crm/actions.ts` calls all
ten write RPCs through PostgREST, which logs in as `authenticator` and SET ROLEs
to `service_role`. `SET ROLE` does not change `session_user`, so every dashboard
write reaches the guard as `authenticator`. The guard exempts a closed list of
non-agent roles; without it, applying this migration stops the CRM UI writing.

**Conventions:**
- Run tests individually: `node --experimental-strip-types tests/<name>.test.mjs`.
  Do NOT run `npm test` — POSIX for-loop, fails on Windows cmd.exe.
- Migration text assertions follow `tests/documents-migration.test.mjs`.
- Every function: `security definer`, `set search_path = public, pg_temp`,
  `revoke all ... from public`, explicit `grant execute`.
- A repo hook rejects long or compound shell commands containing a commit. Run
  `git add` and `git commit` as separate simple commands. Never `--no-verify`.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260906120000_agent_capabilities.sql` | The table, the guard, the ten re-created functions, the role, the seed rows |
| `tests/agent-capabilities.test.mjs` | Text assertions over that migration |
| `docs/operations/operator-control/agent-capabilities.md` | How to turn a capability on or off, and what the refusals mean |

One migration, because the pieces are meaningless apart: a guard nothing calls, or
functions calling a guard that does not exist, are both broken states.

---

### Task 1: Capture the live definitions, and find the drift

The migration re-creates ten production functions. Nine have bodies in the repo;
one does not. Before rewriting anything, establish what is actually running.

**Files:**
- Create: `docs/operations/operator-control/live-write-functions-2026-09-06.md`

- [ ] **Step 1: Capture all ten current definitions**

Using read-only SQL against project `qsgijpsttojutuhogbns`. **Derive the set, do
not type the names in** — an earlier pass at this enumerated by hand and missed
`referral_set_status`:

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) a on true
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and r.rolname = 'crm_agent'
  and a.privilege_type = 'EXECUTE'
  and lower(p.prosrc) ~ '\minsert\M|\mupdate\M|\mdelete\M'
order by p.proname;
```

**Expect exactly 10 rows.** If you get 11, a write function was added since
2026-09-06 and the plan's `WRITES` list, signature table and seed rows all need it
— stop and report that before writing any SQL. If you get 9, one was removed.
Either way the count is the finding.

Write each definition verbatim into the doc, one fenced block per function.

- [ ] **Step 2: Diff each against the repo**

For the nine that exist in migrations, compare the live body against the repo
version:

| Function | Repo migration |
|---|---|
| `company_upsert`, `contact_upsert`, `deal_upsert` | `20260818180000_prospecting_layer.sql` |
| `task_upsert` | `20260818200000_notes_tasks.sql` |
| `note_upsert` | `20260821230000_notes_on_leads.sql` |
| `approval_request` | `20260818190000_approval_queue.sql` |
| `referral_partner_upsert`, `referral_record`, `referral_set_status` | `20260818160000_referral_suite.sql` |

**Record any function whose live body differs from the repo.** Drift here means the
repo is not the source of truth for a function agents can call, and the migration in
Task 4 must be built from the LIVE body, not the repo one — otherwise applying it
would silently revert a production change.

`deal_advance_stage` has no repo definition. Note it as recovered-from-production.

- [ ] **Step 3: Report the drift before continuing**

If any function differs, STOP and report it. Do not resolve it silently. A
difference between repo and production is a finding, not a merge conflict.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/operator-control/live-write-functions-2026-09-06.md
git commit -m "docs(agents): capture the ten live write functions before guarding them"
```

---

### Task 2: The capability table

**Files:**
- Create: `supabase/migrations/20260906120000_agent_capabilities.sql`
- Test: `tests/agent-capabilities.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20260906120000_agent_capabilities.sql",
  "utf8",
);

test("the capability table is created idempotently", () => {
  assert.match(sql, /create table if not exists public\.agent_capabilities/);
});

test("a capability is keyed by agent and function together", () => {
  assert.match(sql, /primary key \(agent_role, capability\)/);
});

test("a capability is disabled unless switched on", () => {
  assert.match(sql, /enabled\s+boolean\s+not null\s+default false/);
});

test("the table records who changed it and when", () => {
  assert.match(sql, /updated_at\s+timestamptz/);
  assert.match(sql, /updated_by\s+text/);
});

test("the table is not reachable by anon or authenticated", () => {
  assert.match(sql, /revoke all on table public\.agent_capabilities from anon, authenticated/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/agent-capabilities.test.mjs`
Expected: FAIL — ENOENT, the migration does not exist.

- [ ] **Step 3: Create the migration with the table**

```sql
-- Agent capability model.
--
-- operator_system_control has read operators_enabled: false since 2026-08-18 and
-- stopped nothing: none of the ten write functions granted to crm_agent consulted
-- it. Sami read that switch and respected it, which is good behaviour from a
-- well-configured agent and is not a control.
--
-- This makes the switch real, and adds the layer between "may never" and "may
-- always" - so an agent can enrich companies without being able to move deals.

create table if not exists public.agent_capabilities (
  agent_role  text not null,
  capability  text not null,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (agent_role, capability)
);

comment on table public.agent_capabilities is
  'What each agent role may do. capability is the function name deliberately, so '
  'this table and the GRANT list name the same things. A MISSING ROW DENIES: a new '
  'write function is off for every agent until someone turns it on.';

alter table public.agent_capabilities enable row level security;
revoke all on table public.agent_capabilities from anon, authenticated;
```

- [ ] **Step 4: Run it and watch it pass**

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906120000_agent_capabilities.sql tests/agent-capabilities.test.mjs
git commit -m "feat(agents): capability table, denying by absence"
```

---

### Task 3: The guard

**Files:**
- Modify: `supabase/migrations/20260906120000_agent_capabilities.sql`
- Test: `tests/agent-capabilities.test.mjs` (append)

- [ ] **Step 1: Append the failing tests**

Note the helper. Every assertion about the guard reads the guard's own body, not
the whole file — the file will also contain ten pasted production function bodies
and a header comment, and a test that matches those instead is a test that passes
for the wrong reason.

```javascript
// The guard's body alone: from its CREATE to the revoke that follows it.
function guardBody() {
  const start = sql.indexOf("create or replace function public.agent_require");
  assert.notEqual(start, -1, "agent_require is not defined in the migration");
  const end = sql.indexOf("revoke all on function public.agent_require", start);
  assert.notEqual(end, -1, "agent_require is not revoked from public");
  return sql.slice(start, end);
}

test("the guard exists and is a definer function", () => {
  assert.match(guardBody(), /security definer/);
  assert.match(guardBody(), /set search_path = public, pg_temp/);
});

test("the guard reads session_user, NOT current_user", () => {
  const body = guardBody();
  assert.match(body, /session_user/);
  assert.doesNotMatch(
    body,
    /current_user/,
    "the write functions are SECURITY DEFINER owned by postgres, so current_user " +
      "inside them is postgres for every caller — a guard on it allows everything " +
      "or denies everything, and looks correct in review",
  );
});

test("the global kill switch is checked before the per-capability lookup", () => {
  const body = guardBody();
  const killIdx = body.indexOf("operator_system_control");
  const lookupIdx = body.indexOf("from public.agent_capabilities");
  assert.ok(killIdx > -1, "the guard never reads the kill switch");
  assert.ok(lookupIdx > -1, "the guard never reads the capability table");
  assert.ok(
    killIdx < lookupIdx,
    "one flip must stop every agent before any capability row is considered",
  );
});

test("each refusal has its own reason", () => {
  for (const reason of ["operators_disabled", "capability_missing", "capability_disabled"]) {
    assert.match(sql, new RegExp(reason));
  }
});

test("the guard audits both outcomes, not only denials", () => {
  assert.match(sql, /capability_allowed/);
  assert.match(sql, /capability_denied/);
  assert.match(sql, /insert into public\.operator_audit_events/);
});

test("the guard is not callable by public", () => {
  assert.match(sql, /revoke all on function public\.agent_require\(text\) from public/);
});

test("the app's PostgREST role passes through, or the whole dashboard breaks", () => {
  assert.match(
    guardBody(),
    /'authenticator'/,
    "PostgREST logs in as authenticator; without an exemption every dashboard " +
      "write raises capability_missing",
  );
});

test("the pass-through is a closed list, not a name pattern", () => {
  assert.doesNotMatch(
    guardBody(),
    /likes+'agent/i,
    "matching agent roles by name prefix fails OPEN for any role that does not " +
      "match — a new connecting role would be unguarded rather than denied",
  );
});
```

- [ ] **Step 2: Run and watch the new tests fail**

- [ ] **Step 3: Append the guard**

```sql
-- The guard. Called as the FIRST statement of every write function.
--
-- session_user, not current_user. These functions are SECURITY DEFINER owned by
-- postgres, so current_user inside them is postgres for every caller - a guard on
-- it would allow everything or deny everything, and would look correct in review.
-- session_user stays as the role that opened the connection.
--
-- Order matters: the global switch is consulted first, so one flip stops every
-- agent regardless of what any capability row says.
create or replace function public.agent_require(p_capability text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   text := session_user;
  v_global   boolean;
  v_enabled  boolean;
  v_reason   text;
begin
  -- Callers that are not agents.
  --
  -- The dashboard reaches these same functions through PostgREST, which logs in
  -- as `authenticator` and then SET ROLEs to service_role. SET ROLE does not
  -- change session_user, so EVERY dashboard write arrives here as
  -- `authenticator`. Without this branch the guard refuses every write in the
  -- CRM UI.
  --
  -- A closed list, not a pattern: any other role falls through and needs a
  -- capability row, so it denies by default.
  if v_caller in ('authenticator', 'postgres', 'supabase_admin') then
    return;
  end if;

  select operators_enabled into v_global
    from public.operator_system_control where id = 'global';

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

  insert into public.operator_audit_events(operator_key, event_type, details)
  values (
    v_caller,
    case when v_reason is null then 'capability_allowed' else 'capability_denied' end,
    jsonb_build_object('capability', p_capability, 'reason', v_reason)
  );

  if v_reason is not null then
    raise exception 'agent_capability_denied: % (%, %)', v_reason, v_caller, p_capability
      using errcode = 'check_violation';
  end if;
end $$;

revoke all on function public.agent_require(text) from public;
```

Note the audit row is written **before** the raise, and an exception rolls the
transaction back — so a denial recorded here disappears with it. That is a known
limitation; see Task 6, which decides whether denials need to survive.

- [ ] **Step 4: Run and watch all tests pass**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906120000_agent_capabilities.sql tests/agent-capabilities.test.mjs
git commit -m "feat(agents): the guard, reading session_user and failing closed"
```

---

### Task 4: Guard the ten write functions

**Files:**
- Modify: `supabase/migrations/20260906120000_agent_capabilities.sql`
- Test: `tests/agent-capabilities.test.mjs` (append)

- [ ] **Step 1: Append the failing test**

```javascript
const WRITES = [
  "company_upsert", "contact_upsert", "deal_upsert", "task_upsert", "note_upsert",
  "deal_advance_stage", "approval_request", "referral_partner_upsert", "referral_record",
  "referral_set_status",
];

test("every write function is re-created", () => {
  for (const fn of WRITES) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`));
  }
});

test("every write function calls the guard with its own name", () => {
  for (const fn of WRITES) {
    assert.match(
      sql,
      new RegExp(`agent_require\\('${fn}'\\)`),
      `${fn} must guard on its own capability name, not another's`,
    );
  }
});

test("exactly ten call sites exist — no more, no fewer", () => {
  const calls = sql.match(/agent_require[(]'[a-z_]+'[)]/g) ?? [];
  assert.equal(
    calls.length,
    WRITES.length,
    `found ${calls.length} guard calls: ${calls.join(", ")}`,
  );
  assert.deepEqual(
    [...new Set(calls)].sort(),
    WRITES.map((f) => `agent_require('${f}')`).sort(),
    "a guard call naming something outside the ten writes is either a typo or a " +
      "read function that should not be gated",
  );
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Re-create each function with the guard**

Take each body from the doc produced in Task 1 — **the live definition, not the
repo one**, since Task 1 may have found drift. Insert exactly one line as the first
statement after `begin`:

```sql
  perform public.agent_require('<the function's own name>');
```

Worked example, `referral_record`, whose live definition is:

```sql
create or replace function public.referral_record(p_partner_id uuid, p_lead_id uuid, p_company_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform public.agent_require('referral_record');
  insert into referrals(partner_id, lead_id, company_name)
    values(p_partner_id, p_lead_id, p_company_name)
    returning id into v_id;
  return v_id;
end $$;
```

Change nothing else — not the signature, not the body, not the `search_path`, not
the security setting. The argument lists must match exactly or `create or replace`
creates an overload instead of replacing, leaving the unguarded original callable.
The ten signatures are:

| Function | Arguments |
|---|---|
| `approval_request` | `p_agent_name text, p_action_type text, p_target_type text, p_target_id text, p_summary text, p_payload jsonb, p_risk_level text, p_expires_at timestamptz` |
| `company_upsert` | `p_source text, p_source_record_id text, p_name text, p_domain text, p_description text, p_categories jsonb, p_employee_range text, p_location text, p_socials jsonb, p_metadata jsonb` |
| `contact_upsert` | `p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_email text, p_phone text, p_job_title text, p_socials jsonb, p_metadata jsonb` |
| `deal_advance_stage` | `p_deal_id uuid, p_to_stage text, p_note text, p_actor text` |
| `deal_upsert` | `p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_stage text, p_value_usd numeric, p_metadata jsonb` |
| `note_upsert` | `p_source text, p_source_record_id text, p_company_id uuid, p_title text, p_content text, p_metadata jsonb, p_lead_id uuid` |
| `referral_partner_upsert` | `p_id uuid, p_name text, p_kind text, p_contact_email text, p_notes text` |
| `referral_record` | `p_partner_id uuid, p_lead_id uuid, p_company_name text` |
| `referral_set_status` | `p_id uuid, p_status text` |
| `task_upsert` | `p_source text, p_source_record_id text, p_company_id uuid, p_content text, p_is_completed boolean, p_deadline_at timestamptz, p_metadata jsonb` |

**Re-issue the grants after each `create or replace`.** Replacing a function does
not drop its privileges, but the migration should be explicit so a fresh database
built from migrations ends up in the same state as production.

- [ ] **Step 4: Run all tests**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906120000_agent_capabilities.sql tests/agent-capabilities.test.mjs
git commit -m "feat(agents): every write function asks the guard first"
```

---

### Task 5: Sami's role and seed state

**Files:**
- Modify: `supabase/migrations/20260906120000_agent_capabilities.sql`
- Test: `tests/agent-capabilities.test.mjs` (append)

- [ ] **Step 1: Append the failing test**

```javascript
test("the agent role is created without table access or RLS bypass", () => {
  assert.match(sql, /create role agent_sami/);
  assert.doesNotMatch(sql, /agent_sami\s+.*bypassrls/i);
  assert.doesNotMatch(sql, /grant .* on table .* to agent_sami/i);
});

test("all ten capabilities are seeded enabled, reproducing today's behaviour", () => {
  for (const fn of WRITES) {
    assert.match(sql, new RegExp(`\\('agent_sami',\\s*'${fn}',\\s*true`));
  }
});

test("seeding is idempotent", () => {
  assert.match(sql, /on conflict \(agent_role, capability\) do nothing/);
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Append the role and seed**

```sql
-- One role per agent, so identity is proven by the connection rather than claimed
-- in a parameter. No table grants and no RLS bypass - the same shape as crm_agent.
--
-- Password is set out of band, never in a migration.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_sami') then
    create role agent_sami login noinherit;
  end if;
end $$;

grant execute on function public.agent_require(text) to agent_sami;

-- All ten enabled, which reproduces today's behaviour exactly. This migration
-- makes restriction POSSIBLE; it does not restrict. Changing what Sami may do is a
-- separate, deliberate decision, and bundling it here would hide a behaviour change
-- inside an infrastructure change.
insert into public.agent_capabilities(agent_role, capability, enabled, updated_by)
values
  ('agent_sami','company_upsert',true,'migration'),
  ('agent_sami','contact_upsert',true,'migration'),
  ('agent_sami','deal_upsert',true,'migration'),
  ('agent_sami','task_upsert',true,'migration'),
  ('agent_sami','note_upsert',true,'migration'),
  ('agent_sami','deal_advance_stage',true,'migration'),
  ('agent_sami','approval_request',true,'migration'),
  ('agent_sami','referral_partner_upsert',true,'migration'),
  ('agent_sami','referral_record',true,'migration'),
  ('agent_sami','referral_set_status',true,'migration')
on conflict (agent_role, capability) do nothing;
```

Then grant `agent_sami` execute on the same 22 functions `crm_agent` holds. Get
that list from the live database rather than guessing it:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) a on true
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and r.rolname = 'crm_agent' and a.privilege_type = 'EXECUTE'
order by p.proname;
```

Expect 22 rows — 10 writes and 12 reads. If the count differs, that is a finding:
report it before continuing, because it means the grant list moved since
2026-09-06. List them explicitly rather than looping — a grant list is a security boundary and
should be readable.

- [ ] **Step 4: Run all tests. Step 5: Commit**

```bash
git add supabase/migrations/20260906120000_agent_capabilities.sql tests/agent-capabilities.test.mjs
git commit -m "feat(agents): agent_sami role, seeded to today's behaviour"
```

---

### Task 6: The operator runbook

**Files:**
- Create: `docs/operations/operator-control/agent-capabilities.md`

- [ ] **Step 1: Write it**

Cover, in this order:

1. **How to turn one capability off**, with the exact SQL:
   `update public.agent_capabilities set enabled = false, updated_at = now(), updated_by = '<who>' where agent_role = 'agent_sami' and capability = 'deal_advance_stage';`
2. **How to stop everything** — set `operators_enabled = false` on
   `operator_system_control`. Note this now works, and did not before 2026-09-06.
3. **What each refusal means** — `operators_disabled` (global switch),
   `capability_missing` (never granted), `capability_disabled` (switched off).
   An agent seeing these should report them, not retry.
4. **The migration sequence and its live window** — see below. Whoever applies this
   must know that revoking `crm_agent` before the VPS is updated cuts Sami off.
5. **The rollback** — `enabled = true` for a capability, or
   `operators_enabled = true` globally.

- [ ] **Step 2: Commit**

```bash
git add docs/operations/operator-control/agent-capabilities.md
git commit -m "docs(agents): runbook for turning capabilities on and off"
```

---

### Task 7: Verification, and the questions only a database can answer

The unit suite asserts migration text. It cannot prove the guard actually refuses.
These checks are run **by a human, against the database, after applying** — they are
not part of the automated suite.

- [ ] **Step 1: Write the checks into the runbook**

```sql
-- as agent_sami, with the capability enabled: should succeed
select public.referral_record(null, null, 'guard smoke test');

-- disable it, then retry: should raise agent_capability_denied: capability_disabled
update public.agent_capabilities set enabled = false
  where agent_role='agent_sami' and capability='referral_record';

-- flip the global switch off: every capability should raise operators_disabled
update public.operator_system_control set operators_enabled = false where id='global';

-- a capability with no row at all: should raise capability_missing
select public.agent_require('not_a_real_capability');
```

- [ ] **Step 2: Resolve the audit-rollback question**

The guard writes its audit row before raising, and the raise rolls the transaction
back — so **denials may not survive**. Confirm the behaviour against the database.
If denials are lost, the fix is to write them from a separate autonomous
transaction, and that is a change worth making deliberately rather than assuming.
Record the answer in the runbook either way.

- [ ] **Step 3: Commit any runbook updates**

---

## Deploy order

This migration is **not applied by this plan**. When it is applied:

1. Apply the migration — creates the table, the guard, the guarded functions, the
   `agent_sami` role and its ten enabled rows
2. Set a password for `agent_sami` out of band
3. **Update `.pgpw` and the connection on the Hetzner VPS** — not in this repo, and
   not something this plan can sequence
4. Confirm Sami still writes, using the smoke test in Task 7
5. Only then `revoke` the functions from `crm_agent`

**Between 1 and 3, Sami still works on the old role**, because `crm_agent` keeps its
grants until step 5. That ordering is deliberate: an agent cut off mid-task is worse
than an agent briefly holding two paths.

**Expect `deal_advance_stage` to change twice.** The documents feature (PR #30) makes
it refuse without a signed SOW. Independent of this work, arriving alongside it.
