# Agent Capability Model — Design

**Date:** 2026-09-06
**Status:** Approved, not yet implemented
**Scope:** Enforcing what an agent may do in the CRM database. Subsystem C of four.

## The gap

`operator_system_control` holds a global kill switch. It reads
`operators_enabled: false`, reason *"disabled by default"*, set 2026-08-18 and never
changed since.

**It does not stop anything.**

Measured 2026-09-06: none of the ten write functions granted to the `crm_agent`
role consults it. Not `deal_upsert`, not `deal_advance_stage`, not `task_upsert`,
`note_upsert`, `company_upsert`, `contact_upsert`, `approval_request`,
`referral_partner_upsert`, `referral_record` or `referral_set_status`. Every one
writes unconditionally
when called.

Sami reads that switch, reports its state accurately, and chooses to respect it.
That is good behaviour from a well-configured agent. It is not a control. The
difference matters the first time an agent is confused, compromised, or replaced by
a different one.

## What is already enforced, and is not the problem

The `crm_agent` role is properly built, and this design does not disturb it:

| Property | Value |
|---|---|
| Superuser / createdb / createrole | no |
| `rolbypassrls` | **false** |
| Direct table grants in `public` | **zero** |
| Executable functions | 22 — 10 writes, 12 reads |

The write/read split is not a judgement call, and should not be enumerated by hand
— a first pass at this spec counted nine writes and missed `referral_set_status`,
which updates `referrals.status` and is granted to `crm_agent` like the rest.
Derive it:

```sql
select p.proname,
       (lower(p.prosrc) ~ '\minsert\M|\mupdate\M|\mdelete\M') as mutates
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) a on true
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and r.rolname = 'crm_agent'
  and a.privilege_type = 'EXECUTE'
order by mutates desc, p.proname;
```

Measured 2026-09-06 this splits cleanly: ten mutating (all `volatile`), twelve
not (all `stable`). A write function that escapes this list escapes the guard, so
the count is worth re-deriving rather than trusting.

Nothing that sends, deploys, spends or signs exists in that grant list at all, so
the *hard* prohibitions hold structurally. `policy.ts` names the same set —
`send`, `deploy`, `set_price`, `change_scope`, `sign`, `refund` — as `HARD_DENIED`.

What is missing is the graduated layer between "may never" and "may always": the
ability to say *Sami may enrich companies today but not move deals*, and to have
that be true rather than requested.

## Two capability models that do not talk to each other

| | Model 1 — in-CRM operators | Model 2 — connecting agents |
|---|---|---|
| Governs | `cfo`, `cro`, `cto` | `crm_agent` over Postgres |
| Mechanism | `HARD_DENIED` + `operator_controls` + payload-bound approvals | `GRANT EXECUTE` |
| Expressiveness | high — modes, expiry, single-use, payload hash, revocation | binary |
| In use | **no** — `operator_controls` has 0 rows, so every operator fails `control_missing` | **yes** |

The elaborate model governs code that has never run. The agent doing real work is
governed by a grant list. This design closes that gap for Model 2 without
disturbing Model 1, which stays as it is for the in-process operators.

## Governing constraints

**The write functions are `SECURITY DEFINER` owned by `postgres`.** Inside them
`current_user` is `postgres`, not the caller. A guard reading `current_user` would
see the same value for every agent and either always allow or always deny. The
guard must read **`session_user`**, which remains the role that opened the
connection. This is the single most likely way to implement this wrong.

**Sami does not use the `giventake-mcp` endpoint.** He connects directly to
Postgres via a password file. `channel_auth_log` contains exactly one granted row
and it is a curl probe. The channel-auth hardening — constant-time compare, audit
log, rate limiter — protects a path no agent uses. That is worth knowing and is not
a reason to change either path here.

**Fail closed by absence**, matching the existing posture. A missing control row
denies, exactly as `requireControls` raises `control_missing` today.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Where enforcement lives | Inside the SQL functions | Revoking grants — coarse, and toggling means DDL. Routing Sami through the MCP endpoint — that path is read-only, so every write would need building, and it is a change on his side |
| Agent identity | One Postgres role per agent | A shared role with a self-declared `agent_key` — identity would be a claim, not a fact, and the audit trail would record what an agent said about itself |
| Granularity | Per agent × per function | Capability groups (recommended, not chosen) and per-agent on/off. Per-function is 10 switches per agent and more to review; it was chosen so nothing moves without a specific decision |
| Scope | Writes only | Gating reads as well — doubles the matrix for capabilities that would sit on permanently. Reads remain bounded by the grant list |

## Identity

One role per agent: `agent_sami`, `agent_piper`, and so on. Each non-superuser,
`rolbypassrls` false, **no table grants**, granted only the functions it needs —
the same shape as `crm_agent` today.

An agent cannot impersonate another without that role's password, and enforcement
holds even if the agent's own code is wrong.

## Control table

```sql
create table if not exists public.agent_capabilities (
  agent_role  text not null,          -- 'agent_sami'
  capability  text not null,          -- the function name, e.g. 'deal_upsert'
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (agent_role, capability)
);
```

Ten rows per agent. `capability` is the function name deliberately: the control
table and the grant list then name the same things, and a reviewer comparing them
does not have to hold a mapping in their head.

**A missing row denies.** Adding a tenth write function later is therefore off for
every agent until someone turns it on, rather than silently open.

## The guard

One function, `agent_require(p_capability text)`, called as the first statement of
each of the ten writes. In order:

1. Resolve the caller from `session_user`
2. If `operator_system_control.operators_enabled` is false → raise. One flip stops
   every agent, and unlike today it will actually stop them
3. Look up `(session_user, p_capability)` — missing → raise
4. Not enabled → raise
5. Record the call
6. Return

One place to get right, one place to audit. Each write function gains a single
line and is otherwise untouched.

Each refusal raises with a distinct reason in the message — `operators_disabled`,
`capability_missing`, `capability_disabled` — so an agent can tell "switched off"
from "never granted" and report the difference to a human rather than retrying
blindly. The reasons deliberately mirror `policy.ts`'s vocabulary
(`global_kill_switch`, `control_missing`, `control_disabled`) so the two models
read the same way even though they are separate.

## Audit

**Reuse `public.operator_audit_events`.** Its shape already fits and it is
append-only, protected by the existing `deny_audit_mutation` trigger — so an agent
cannot erase its own trail even if its capability set were wrong:

| Column | Written as |
|---|---|
| `operator_key` | the agent role, e.g. `agent_sami` |
| `event_type` | `capability_allowed` / `capability_denied` |
| `details` (jsonb) | `{ capability, reason }` — reason only on denial |
| `created_at` | default `now()` |
| `run_id` | left null; agents connecting over Postgres have no operator run |

No new audit table. One place to look, and the in-CRM operators already write here,
so a future console reads a single feed rather than merging two.

Every write is recorded, not only denials. Denials matter most, but allows are the
trail that answers *what did Sami change last Tuesday* — and writes are low-volume
enough to log in full. A bulk import of 383 companies is 383 rows, which is
affordable and is exactly the record you would want afterwards.

## Migration, and its live window

Sami connects as `crm_agent` today, so the change has an ordering hazard:

1. Create `agent_sami`
2. Grant it the 22 functions `crm_agent` holds
3. Insert his 10 capability rows, enabled
4. **Update `.pgpw` and the connection on the VPS** — outside this repo
5. Revoke the functions from `crm_agent`

Between 3 and 4 he still works on the old role. Before 4 completes he must not be
cut off, so step 5 waits for confirmation that step 4 landed. Step 4 is on the
Hetzner VPS and cannot be sequenced from here.

**Collision to expect:** `deal_advance_stage` is in Sami's grants, and the
documents feature (PR #30) makes that function refuse without a signed SOW. Both
changes land on the same function. They are independent — one asks *may this agent
act*, the other asks *is the gate satisfied* — but they will arrive together and
the first refusal Sami sees may be either.

## Testing

The guard is SQL, so the migration test asserts on the text as
`campaign-migration` and `documents-migration` do:

- `agent_require` exists, is `security definer`, and is `revoke`d from `public`
- it reads `session_user`, **not** `current_user` — the trap named above
- each of the ten write functions contains a call to it
- `agent_capabilities` has the composite primary key and `enabled` defaults false
- the global kill switch is consulted before the per-capability lookup
- the guard writes to `operator_audit_events` on **both** outcomes, not only
  denials — an audit that records refusals and stays silent about what actually
  happened answers the wrong question
- the guard is granted to the agent roles but `revoke`d from `public`, so it cannot
  be probed by an unprivileged caller to enumerate capabilities

Behaviour that needs a database — that a disabled capability actually raises — is
verified by hand against a scratch role during the migration, not by the unit
suite, which has no database.

## Out of scope

- **Subsystems A, B and D.** Sami's OpenClaw configuration, one identity across
  CRM/Discord/cloud, and the mission-control tab each get their own spec. D reads
  the tables this creates
- **Model 1.** `operator_controls`, `HARD_DENIED` and the approval machinery are
  left exactly as they are
- **Approvals for agent writes.** The existing payload-bound approval flow is not
  wired into this guard. It is the obvious next layer once capabilities are real
- **Read gating**, per the decision above

## Open questions

1. **Which of Sami's ten writes should be enabled on day one?** The migration has
   to insert some state. Enabling all ten reproduces today's behaviour exactly and
   changes nothing operationally; enabling fewer is a live restriction that needs
   deciding deliberately rather than defaulted.
2. **Do Piper, Cade, nova and inbox get roles now or later?** They are configured
   but idle, cannot currently be spawned (`allowAny: false`), and two have had no
   activity since 2026-08-20. Creating roles for agents that never connect is
   speculative; not creating them means a second migration when they do.
