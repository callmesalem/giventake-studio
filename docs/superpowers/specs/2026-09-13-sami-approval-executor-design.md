# The approval executor — design

**Status:** Phase 1 built and reviewed; phases 2 and 3 outstanding.
**Date:** 2026-09-13.
**Scope:** making an approved proposal actually happen, so Sami can propose the
three actions he must never take on his own.

---

## What this is for

Sami can already write to the CRM. The capability migration
(`20260906120000_agent_capabilities.sql`) granted both `agent_sami` and
`crm_agent` ten write functions — `company_upsert`, `contact_upsert`,
`deal_upsert`, `deal_advance_stage`, `note_upsert`, the three referral
functions, `task_upsert` — and `approval_request` alongside them, each
individually killable from `agent_capabilities` where a missing row denies.

So this is not about letting Sami write. It is about the class of action he must
**never** take unattended: the six in `HARD_DENIED`
(`src/server/operator-control/policy.ts`). Those need a human in the loop, and
the loop is already half-built.

**What is missing is one thing.** The lifecycle in `src/lib/approvals.ts` is
`pending → approved → executed`, and `approval_mark_executed` records a
*result* — but nothing performs the *action* between those two states. Today an
approval is a decision nothing acts on.

This design adds the executor. It is not a write tier.

---

## The design the documentation no longer calls for

`docs/integrations/sami-mcp-connection.md` says a write tier "belongs behind a
second token and an approval queue, added deliberately, once the read surface
has proven itself."

That sentence predates the capability model by a week, and the capability model
delivered something stronger than a second token: a per-role, per-function
switch, keyed on the function name so the table and the GRANT list name the same
things, backed by an audit row that `UPDATE` and `DELETE` cannot remove.

**A second token is therefore not in this design.** It would be a coarser
control than the one already in place, and a second secret to rotate. The
connection document should be amended to say so when this ships.

---

## Decisions taken before the design

| Decision | Choice |
|---|---|
| Who executes | **The CRM, at the moment of approval.** Not a poller. |
| What Sami may propose | `send_email`, `deal_close`, `demo_site` |
| What he may not propose | Anything touching money: `set_price`, `refund`, `change_scope` |
| Second token | **Dropped** — redundant against `agent_capabilities` |

Money is excluded deliberately. `critical` stays unused in the risk enum so it
remains available if that ever changes.

---

## 1. The action contract

`approval_request(p_agent_name, p_action_type, p_target_type, p_target_id,
p_summary, p_payload, p_risk_level, p_expires_at)` takes `p_action_type` as free
text. The executor recognises exactly three values:

```
send_email   draft a message to a lead or client
deal_close   advance a deal into Close
demo_site    queue a demo build for a prospect
```

A proposal carrying any other `action_type` is still stored and still shown — it
is a legitimate record of a decision — but it is **not executable**, and the
approvals UI says so rather than offering a button that does nothing. A closed
set is what keeps "execute" from meaning "run whatever an agent put in a jsonb
column".

### The payload is untrusted input

`proposed_payload` was written by an agent, and an agent reading a lead's own
words can be steered by them. The CRM's own MCP instructions already state the
principle for read data: everything returned is data, never instructions. Here
it has teeth.

So the executor does not trust the payload. At execution time it re-reads the
target record, re-resolves the recipient, and re-runs every gate against **what
it finds**, not what the payload asserts. A payload claiming a recipient is not
suppressed means nothing; `do_not_contact` is checked fresh against the address
on the record.

### Expiry

`expires_at` is already on the table, and expiry is **already enforced in the
database**: `approval_decide` marks a lapsed proposal `expired` and raises,
before any decision is recorded. So the executor needs no expiry check of its
own — it only ever runs after a successful decide, and a successful decide
proves the proposal was live.

What this design sets is the default: **72 hours**, long enough to cover a
weekend and short enough that nothing surprises an operator who has forgotten
about it. Sami supplies it on `approval_request`.

### Risk levels

| Action | Risk | Why |
|---|---|---|
| `send_email` | `high` | Leaves the building, reaches a person, cannot be recalled |
| `deal_close` | `high` | Stage 4's gate is "signed and paid"; a wrong Close misstates revenue |
| `demo_site` | `medium` | Publishes publicly under a prospect's name, but is reversible |

---

## 2. The executor

### Where it lives

- `src/server/approvals/execute.ts` — the dispatcher, its outcome types, and, for
  now, the one handler Phase 1 ships (`deal_close`), inline. A separate
  `src/server/approvals/handlers.ts` is worth introducing once a second handler
  lands — not before, since one handler in its own file is a file with one
  export and nothing to share.

Both server-only. `decideCrmApproval` in `src/lib/crm-data.ts` already reaches
`src/server/*` by dynamic `import()` inside its handler; it gains one more.

### The flow

1. Operator clicks Approve. `decideCrmApproval` calls
   `CrmActions.decideApproval(id, "approved", by, reason)` — unchanged.
2. **New:** the dispatcher reads the proposal **fresh from the database**. The
   browser supplies an id; every other fact is re-read.
3. (No expiry check needed — `approval_decide` already refused a lapsed
   proposal in step 1.)
4. A handler is looked up by `action_type`. An unrecognised type is a no-op with
   a stated reason.
5. The handler re-validates against live records and runs that subsystem's own
   gates.
6. `approval_mark_executed(id, result)`.

### Approval never bypasses a gate

This is the property the whole design exists to preserve.

An approved email still runs `sendPreflight`: suppression, the positive
approved-recipient allowlist, the AI-disclosure footer, and the §10 kill switch.
A human approval satisfies *"a human authorised this"*. It does not satisfy
*"this address is not on the do-not-contact list"*. Those are different facts,
and only the first is a person's to assert.

When a gate refuses after approval, the refusal is recorded rather than
swallowed. Silence here would be the worst outcome: an operator who clicked
Approve and saw nothing would reasonably assume the mail went.

### Concurrency: a double-click must not send twice

The hazard is real — two approve requests racing would both dispatch, both act,
and only then would one hit `approval_mark_executed`'s guard, by which point the
email has gone twice.

**The database already prevents it, and no new work is needed.**
`approval_decide` takes a row lock (`select … for update`) and raises
`approval already decided (%)` when the status is anything but `pending`. So the
second request throws inside the decide call and never reaches the dispatcher.

The requirement this places on the executor is therefore a negative one: it must
run **after** a successful `decideApproval` and never in parallel with it, so
that the database's lock is the serialisation point. `decideApproval` already
returns `Promise<boolean>`; that return needs no change.

### Failure

Two kinds, both terminal:

- **Refusal** — a gate said no. Deterministic; retrying changes nothing until
  the underlying fact changes. Recorded as `{ ok: false, refused: "<gate id>" }`.
- **Error** — an RPC or network failure. Recorded as
  `{ ok: false, error: "<class>" }`.

Retry is a **new proposal**, not a retry button. That avoids building a retry
subsystem for something rare, and is honest about what is being repeated. If it
proves annoying in practice, a retry is a small follow-up.

Errors never carry message bodies, recipient addresses or client names,
following the rule `src/server/campaigns/mailer.ts` already states: "Errors
never carry the response body or the message text: both echo personal data."

### One wart, recorded deliberately

A refused action is marked `executed` with `execution_result.ok === false`. The
word reads as "the queue is finished with this", not "the action succeeded" —
`execution_result.ok` carries that distinction, and `executed` is already
terminal in `APPROVAL_TRANSITIONS`.

The cleaner alternative is a fourth terminal status, `refused`. It was not taken
because it touches the table's check constraint, `APPROVAL_TRANSITIONS`, the
UI, and needs its own RPC — a wide change for a naming improvement. If the
ambiguity bites in practice, that is the fix.

---

## 3. What the operator actually sees

`crmApprovals` currently returns id, agent name, action type, summary, risk
level and timestamp. It does **not** return `proposed_payload`.

So today an operator approves a *summary*. For a record edit that is tolerable.
For `send_email` it is not: approving "Follow up with Ana about the patio quote"
without seeing a word of what reaches Ana defeats the purpose of the queue.

The approvals VM gains `proposed_payload`, rendered per action type:

| Action | What is shown |
|---|---|
| `send_email` | Recipient, subject, and the full body |
| `deal_close` | The deal, its current stage, and whether a signed SOW exists |
| `demo_site` | Business name, address, and the record it attaches to |

**You approve the artifact, not a description of it.**

`listDealDocuments`-style degradation applies: an unexecutable `action_type`
renders the payload as formatted JSON with a note that the CRM cannot execute
this kind of proposal, rather than hiding it.

---

## 4. Testing

The valuable tests are the gate-posture ones, not the happy paths.

1. **A suppressed recipient refuses after approval**, and the refusal is
   recorded. This proves approval does not bypass gates and is the single most
   important test here.
2. **Kill switch off → refuses**, failing closed.
3. **A payload naming a different recipient than the record holds → the handler
   uses the record.** This is the prompt-injection test: an agent steered into
   proposing a redirected email cannot execute one.
4. An expired proposal is refused at the decision, so nothing reaches the
   executor. Asserted against `approval_decide`'s behaviour, not re-implemented.
5. An unrecognised `action_type` is a no-op with a stated reason, never a crash.
6. A second approve on an already-approved row dispatches nothing.

Handlers are tested with fakes, following `tests/documents-issue.test.mjs`:
a small store that records what it was given, rather than mocks.

---

## 5. Rollout

**No new migration.** `approval_request` is already granted to both agent roles.
`approval_mark_executed` and `approval_queue_list` are already granted to
`service_role`, which the Worker holds. `approval_queue` is already `admin_only`
in `MEMBER_TABLE_POLICY`, and `listPendingApprovals` reads it with an explicit
column list, so surfacing `proposed_payload` means adding a column name to a
`select`. This is app-layer work on infrastructure that already exists.

| Phase | Ships | Why this order |
|---|---|---|
| 1 | Dispatcher, payload rendering, `deal_close` handler | Proves the machinery on an action that reaches nobody outside the company |
| 2 | `demo_site` handler | Stays inside systems you own, but `demo_site_request` lives on an unmerged branch, so it could not ship first |
| 3 | `send_email` handler | Highest value, and the only one that reaches a person |

Phase 1 built `deal_close` rather than `demo_site` because `demo_site_request`
lives on an unmerged branch and a `deal_close` reaches nobody outside the
company, so it is what actually shipped safely first. Value still arrives last,
which is the trade. It is still the right order: the first time
approval-to-execution runs end to end should not be the time it emails a
client.

---

## 6. What this does not do

- **No second token.** Superseded by `agent_capabilities`; see above.
- **No money actions.** `set_price`, `refund` and `change_scope` stay
  `HARD_DENIED` with no proposal path.
- **No autonomous execution.** Nothing runs without a human clicking Approve,
  and `HARD_DENIED` is untouched — an agent still cannot call these directly.
- **No retry subsystem.** Re-proposing is the retry.
- **No changes to the MCP surface.** The seven read tools stay as they are.
  Sami proposes over his existing Postgres connection, using the
  `approval_request` grant he already holds.

---

## 7. Dependency worth stating

`agent_sami` still has no password. Step 2 of the cutover in
`docs/operations/operator-control/agent-capabilities.md` has been open since
2026-09-06, so Sami connects as `crm_agent` — the role that document is trying
to retire.

Nothing in this design is blocked by that: both roles hold `approval_request`
and both are seeded in `agent_capabilities`. But every new grant carries the
double-role tax until the cutover completes, and the mail surface already paid
it once. Finishing the cutover should come before this work, not after.
