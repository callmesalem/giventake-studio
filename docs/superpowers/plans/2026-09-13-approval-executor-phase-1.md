# Approval Executor, Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an approved proposal actually happen, for one action type, without letting approval bypass any gate.

**Architecture:** A pure action contract, a dispatcher taking an injected dependency interface so it is testable without a database, one handler, and the wiring that runs it when an operator approves. No new migration: every grant and table this needs already exists.

**Tech Stack:** TanStack Start server functions on Cloudflare Workers, Supabase/PostgREST RPC over raw `fetch`, React 19, Node's built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-09-13-sami-approval-executor-design.md`

## Deviation from the spec, decided before this plan

**The spec's Phase 1 handler is `demo_site`. This plan uses `deal_close` instead.**

`demo_site_request` is not on `main` — it lives on the unmerged `feat/crm-demo-sites` branch, so a `demo_site` handler could not merge until that PR does. `deal_advance_stage` is on `main`, granted to both agent roles, and `CrmActions.advanceDealStage` already refuses a Close without a signed SOW.

The swap also corrects the spec's risk reasoning. It called `demo_site` the action that "stays inside systems you own", but a demo site publishes a public website under a prospect's name. A `deal_close` reaches nobody outside the company. `deal_close` is the lower external risk and the right thing to prove the machinery on.

`demo_site` becomes Phase 2, after its PR merges. Amend the spec's rollout table when this lands.

## Global Constraints

- **No new migration.** `approval_request` is already granted to `agent_sami` and `crm_agent`; `approval_decide`, `approval_mark_executed` and `approval_queue_list` to `service_role`. `approval_queue` is `admin_only` in `MEMBER_TABLE_POLICY`, so a member reading it gets nothing and therefore cannot execute.
- **Approval never bypasses a gate.** Every gate the action's own subsystem enforces still runs after approval. Human approval satisfies "a human authorised this", never "this is otherwise permitted".
- **`proposed_payload` is untrusted input.** It was written by an agent that reads text strangers wrote. Re-read facts from the record; never act on what the payload asserts.
- **`src/lib/*-data.ts` is client-reachable.** It may reach `src/server/*` only through a dynamic `import()` inside a handler. A static import fails the build.
- **Errors never carry message bodies, recipient addresses or client names**, per `src/server/campaigns/mailer.ts`.
- **Product copy:** plain, confident, benefit-first, no filler, no em dashes.
- **Line endings are LF.** Commits use a short imperative subject, a blank line, then trailers.
- **Verify chain:** the node test loop, `npm run build`, `node scripts/worker-smoke.mjs`, and `npx eslint` on touched files. `npm run test` fails on Windows (npm hands a bash loop to cmd.exe) — run the loop directly.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/approval-actions.ts` | The closed action set and payload validation. Pure, client-safe. |
| `tests/approval-actions.test.mjs` | Tests for those |
| `src/server/approvals/execute.ts` | The dispatcher, its dependency interface and outcome types |
| `tests/approval-executor.test.mjs` | Dispatcher tests against a fake |
| `src/lib/crm-data.ts` *(modify)* | `decideCrmApproval` runs the dispatcher; `crmApprovals` returns the payload |
| `src/routes/crm.approvals.tsx` *(modify)* | Renders the payload and the execution outcome |

---

## Task 1: The action contract

**Files:**
- Create: `src/lib/approval-actions.ts`
- Test: `tests/approval-actions.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `EXECUTABLE_ACTIONS: readonly string[]`, `type ExecutableAction = "send_email" | "deal_close" | "demo_site"`, `isExecutableAction(value: unknown): value is ExecutableAction`, `type DealClosePayload = { dealId: string; note: string }`, `validateDealClose(targetType: unknown, targetId: unknown, payload: unknown): { ok: true; value: DealClosePayload } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/approval-actions.test.mjs`:

```javascript
// The executor's closed set, and the validation that stands between an agent's
// jsonb payload and a real action. proposed_payload is written by an agent that
// reads text strangers wrote, so this is the boundary where it stops being
// trusted.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTABLE_ACTIONS,
  isExecutableAction,
  validateDealClose,
} from "../src/lib/approval-actions.ts";

test("the executable set is exactly the three the spec names", () => {
  assert.deepEqual([...EXECUTABLE_ACTIONS], ["send_email", "deal_close", "demo_site"]);
});

test("anything outside the set is not executable", () => {
  // A proposal with an unknown action_type is still a legitimate decision
  // record. It just must never reach a handler.
  for (const value of ["set_price", "refund", "", null, undefined, 7, {}]) {
    assert.equal(isExecutableAction(value), false, `${String(value)} must not be executable`);
  }
  for (const value of EXECUTABLE_ACTIONS) {
    assert.equal(isExecutableAction(value), true);
  }
});

test("a valid deal_close proposal passes and carries the target id", () => {
  const result = validateDealClose("deal", "11111111-2222-3333-4444-555555555555", {
    note: "Signed SOW received and countersigned.",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.dealId, "11111111-2222-3333-4444-555555555555");
  assert.equal(result.value.note, "Signed SOW received and countersigned.");
});

test("the deal id comes from target_id, never from the payload", () => {
  // Both fields are agent-supplied, so this is not about trusting one over the
  // other. It is about having ONE source: a payload that disagrees with the
  // structured target is a signal, not a tie to break.
  const result = validateDealClose("deal", "11111111-2222-3333-4444-555555555555", {
    dealId: "99999999-9999-9999-9999-999999999999",
    note: "Looks ready.",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /disagree/i);
});

test("a payload repeating the same id is fine", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const result = validateDealClose("deal", id, { dealId: id, note: "Ready." });
  assert.equal(result.ok, true);
  assert.equal(result.value.dealId, id);
});

test("the target must be a deal", () => {
  const result = validateDealClose("company", "11111111-2222-3333-4444-555555555555", {
    note: "Ready.",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /deal/i);
});

test("a malformed target id is refused", () => {
  for (const id of ["", "not-a-uuid", null, undefined, 42]) {
    const result = validateDealClose("deal", id, { note: "Ready." });
    assert.equal(result.ok, false, `${String(id)} must be refused`);
  }
});

test("the note is required and is the evidence the gate was met", () => {
  // advanceDealStage records it against the approver's name. An empty note
  // makes the audit row say nothing about why the stage moved.
  for (const note of ["", "   ", null, undefined]) {
    const result = validateDealClose("deal", "11111111-2222-3333-4444-555555555555", { note });
    assert.equal(result.ok, false, `${String(note)} must be refused`);
  }
});

test("a non-object payload is refused rather than crashing", () => {
  for (const payload of [null, undefined, "note", 7, []]) {
    const result = validateDealClose("deal", "11111111-2222-3333-4444-555555555555", payload);
    assert.equal(result.ok, false);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types tests/approval-actions.test.mjs`
Expected: FAIL, cannot find `../src/lib/approval-actions.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/approval-actions.ts`:

```typescript
/**
 * The closed set of proposals the CRM knows how to execute, and the validation
 * that stands between an agent's jsonb payload and a real action.
 *
 * approval_request takes action_type as free text, so an agent can propose
 * anything. That is fine: an unrecognised proposal is still a legitimate record
 * of a decision. What must never happen is "execute" coming to mean "run
 * whatever an agent put in a jsonb column", and a closed set is what prevents
 * it.
 *
 * These live in src/lib/ rather than src/server/ because the approvals route
 * renders them in the browser, and they touch nothing server-only. Keeping them
 * pure is what makes the payload boundary testable without a database.
 */

export const EXECUTABLE_ACTIONS = ["send_email", "deal_close", "demo_site"] as const;

export type ExecutableAction = (typeof EXECUTABLE_ACTIONS)[number];

export function isExecutableAction(value: unknown): value is ExecutableAction {
  return typeof value === "string" && (EXECUTABLE_ACTIONS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DealClosePayload {
  dealId: string;
  note: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Validate a deal_close proposal.
 *
 * The deal id is taken from `target_id`, the structured field, and never from
 * the payload. Both are agent-supplied, so this is not about trusting one over
 * the other: it is about having ONE source. A payload naming a different deal
 * is a disagreement to refuse, not a tie to break, because whichever we picked
 * we would be guessing about what a human thought they were approving.
 */
export function validateDealClose(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<DealClosePayload> {
  if (targetType !== "deal") {
    return { ok: false, reason: "A deal_close proposal must target a deal." };
  }

  const dealId = typeof targetId === "string" ? targetId.trim() : "";
  if (!UUID.test(dealId)) {
    return { ok: false, reason: "The proposal does not name a valid deal." };
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "The proposal carries no payload object." };
  }
  const record = payload as Record<string, unknown>;

  const claimed = record.dealId;
  if (typeof claimed === "string" && claimed.trim() && claimed.trim() !== dealId) {
    return {
      ok: false,
      reason: "The payload and the proposal target disagree about which deal this is.",
    };
  }

  const note = typeof record.note === "string" ? record.note.trim() : "";
  if (!note) {
    return { ok: false, reason: "A note is required: it is the evidence the gate was met." };
  }

  return { ok: true, value: { dealId, note } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/approval-actions.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/lib/approval-actions.ts','tests/approval-actions.test.mjs']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
npx eslint src/lib/approval-actions.ts tests/approval-actions.test.mjs
git add src/lib/approval-actions.ts tests/approval-actions.test.mjs
git commit -m "feat(approvals): the closed action set and deal_close validation"
```

---

## Task 2: The dispatcher

**Files:**
- Create: `src/server/approvals/execute.ts`
- Test: `tests/approval-executor.test.mjs`

**Interfaces:**
- Consumes: `isExecutableAction`, `validateDealClose`, `DealClosePayload` from `@/lib/approval-actions` (Task 1).
- Produces: `interface ExecutorDeps` with `getApproval(id: string): Promise<StoredApproval | null>`, `advanceDealStage(input: { dealId: string; toStage: string; note: string; actor: string }): Promise<unknown>`, `markExecuted(id: string, result: Record<string, unknown>): Promise<void>`; `interface StoredApproval { id: string; actionType: string | null; targetType: string | null; targetId: string | null; status: string; payload: unknown }`; `type ExecutionOutcome`; `executeApproval(deps: ExecutorDeps, id: string, actor: string): Promise<ExecutionOutcome>`; `CLOSE_STAGE_FOR_APPROVAL = "Close"`.

- [ ] **Step 1: Write the failing test**

Create `tests/approval-executor.test.mjs`:

```javascript
// The dispatcher. Its whole job is to run an approved proposal WITHOUT letting
// the approval bypass anything the action's own subsystem would have refused.
//
// Tested against a fake that records what it was given, following
// tests/documents-issue.test.mjs, so the gate posture can be asserted without a
// database.
import test from "node:test";
import assert from "node:assert/strict";
import { executeApproval } from "../src/server/approvals/execute.ts";

const DEAL = "11111111-2222-3333-4444-555555555555";

/** Records calls rather than persisting. `advanceThrows` is how a real gate
 *  refusal is simulated: CrmActions.advanceDealStage throws on a Close with no
 *  signed SOW. */
function fakeDeps({ approval, advanceThrows = null } = {}) {
  const marked = [];
  const advanced = [];
  return {
    marked,
    advanced,
    async getApproval() {
      return approval ?? null;
    },
    async advanceDealStage(input) {
      advanced.push(input);
      if (advanceThrows) throw new Error(advanceThrows);
      return { ok: true };
    },
    async markExecuted(id, result) {
      marked.push({ id, result });
    },
  };
}

const approved = (over = {}) => ({
  id: "a1",
  actionType: "deal_close",
  targetType: "deal",
  targetId: DEAL,
  status: "approved",
  payload: { note: "Signed SOW countersigned." },
  ...over,
});

test("an approved deal_close advances the deal and is marked executed", () => {
  const deps = fakeDeps({ approval: approved() });
  return executeApproval(deps, "a1", "crm:salem@example.com").then((outcome) => {
    assert.equal(outcome.ok, true);
    assert.equal(deps.advanced.length, 1);
    assert.equal(deps.advanced[0].dealId, DEAL);
    assert.equal(deps.advanced[0].toStage, "Close");
    assert.equal(deps.advanced[0].actor, "crm:salem@example.com");
    assert.equal(deps.marked.length, 1);
    assert.equal(deps.marked[0].result.ok, true);
  });
});

test("a gate refusal does NOT advance, and is recorded rather than swallowed", async () => {
  // The single most important test here. An operator who clicked Approve and
  // saw nothing would reasonably assume it worked.
  const deps = fakeDeps({
    approval: approved(),
    advanceThrows: "Stage 4 (Close) requires a signed SOW.",
  });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.marked.length, 1);
  assert.equal(deps.marked[0].result.ok, false);
  assert.equal(deps.marked[0].result.refused, "deal_close");
});

test("an unexecutable action_type never reaches a handler", async () => {
  const deps = fakeDeps({ approval: approved({ actionType: "set_price" }) });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "not-executable");
  assert.equal(deps.advanced.length, 0);
});

test("a proposal that is not approved is not executed", async () => {
  // approval_mark_executed raises unless the status is exactly 'approved', so
  // the dispatcher must not even try.
  for (const status of ["pending", "rejected", "expired", "executed"]) {
    const deps = fakeDeps({ approval: approved({ status }) });
    const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
    assert.equal(outcome.ok, false, `${status} must not execute`);
    assert.equal(outcome.reason, "not-approved");
    assert.equal(deps.advanced.length, 0);
    assert.equal(deps.marked.length, 0);
  }
});

test("a missing proposal is not found, and nothing is marked", async () => {
  const deps = fakeDeps({ approval: null });
  const outcome = await executeApproval(deps, "nope", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "not-found");
  assert.equal(deps.marked.length, 0);
});

test("a payload naming a different deal is refused before anything runs", async () => {
  // The injection test. An agent steered into proposing a redirected action
  // cannot execute one.
  const deps = fakeDeps({
    approval: approved({ payload: { dealId: "99999999-9999-9999-9999-999999999999", note: "go" } }),
  });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.advanced.length, 0);
});

test("an invalid payload is refused and recorded", async () => {
  const deps = fakeDeps({ approval: approved({ payload: { note: "" } }) });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.advanced.length, 0);
  assert.equal(deps.marked.length, 1);
});

test("the recorded refusal carries no client data", async () => {
  // Following campaigns/mailer.ts: errors never echo personal data.
  const deps = fakeDeps({
    approval: approved(),
    advanceThrows: "Stage 4 (Close) requires a signed SOW for Ana at Trattoria Nino",
  });
  await executeApproval(deps, "a1", "crm:salem@example.com");
  const serialised = JSON.stringify(deps.marked[0].result);
  assert.doesNotMatch(serialised, /Ana|Trattoria/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types tests/approval-executor.test.mjs`
Expected: FAIL, cannot find `../src/server/approvals/execute.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/server/approvals/execute.ts`:

```typescript
/**
 * The approval executor.
 *
 * src/lib/approvals.ts documents the lifecycle as pending -> approved ->
 * executed, and approval_mark_executed records a RESULT, but until this module
 * nothing performed the ACTION between those two states. An approval was a
 * decision nothing acted on.
 *
 * The property this exists to preserve: APPROVAL NEVER BYPASSES A GATE. A human
 * approval satisfies "a human authorised this". It does not satisfy "this is
 * otherwise permitted" - that is the subsystem's own question, and it is asked
 * again here, after the approval. CrmActions.advanceDealStage still refuses a
 * Close with no signed SOW, and a refusal is RECORDED rather than swallowed: an
 * operator who clicked Approve and saw nothing would reasonably assume it
 * worked.
 *
 * Pure except for the injected deps, same pattern as src/server/documents/
 * issue.ts: a narrow interface declared here rather than importing CrmActions,
 * so this module is testable with a small fake instead of a database.
 */
import { isExecutableAction, validateDealClose } from "@/lib/approval-actions";

/** The stage a deal_close proposal advances into. A literal rather than a
 *  lookup for the reason crm-guards.ts gives about CLOSE_STAGE_NAME: a gate
 *  whose lookup can fail has to decide whether to open, and there is no good
 *  answer. */
export const CLOSE_STAGE_FOR_APPROVAL = "Close";

export interface StoredApproval {
  id: string;
  actionType: string | null;
  targetType: string | null;
  targetId: string | null;
  status: string;
  payload: unknown;
}

export interface ExecutorDeps {
  getApproval(id: string): Promise<StoredApproval | null>;
  advanceDealStage(input: {
    dealId: string;
    toStage: string;
    note: string;
    actor: string;
  }): Promise<unknown>;
  markExecuted(id: string, result: Record<string, unknown>): Promise<void>;
}

export type ExecutionOutcome =
  | { ok: true; action: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-approved"; status: string }
  | { ok: false; reason: "not-executable"; actionType: string }
  | { ok: false; reason: "refused"; detail: string };

/*
 * There is deliberately no separate "error" variant in phase 1, though the spec
 * describes refusal and error as two kinds.
 *
 * CrmActions.advanceDealStage throws a plain Error for BOTH: the signed-SOW gate
 * throws one, and #rpc throws one on a transport failure. Telling them apart
 * would mean matching on message text, which breaks the first time someone
 * rewords the gate. So phase 1 reports one outcome and says only what it can
 * stand behind: the deal was not advanced.
 *
 * Distinguishing them properly means giving CrmActions a typed error, which is
 * a change to a class eleven other call sites depend on. Worth doing before the
 * send_email handler lands, where "it was refused" and "it did not run" lead an
 * operator to do different things. Out of scope here.
 */

/**
 * Run one approved proposal.
 *
 * The id is the only thing taken from the caller. Everything else is re-read,
 * because proposed_payload was written by an agent that reads text strangers
 * wrote.
 */
export async function executeApproval(
  deps: ExecutorDeps,
  id: string,
  actor: string,
): Promise<ExecutionOutcome> {
  const approval = await deps.getApproval(id);
  if (!approval) return { ok: false, reason: "not-found" };

  // approval_mark_executed raises unless the status is exactly 'approved', so
  // marking here would throw. Nothing is recorded and nothing is run.
  if (approval.status !== "approved") {
    return { ok: false, reason: "not-approved", status: approval.status };
  }

  const actionType = approval.actionType ?? "";
  if (!isExecutableAction(actionType)) {
    const detail = "The CRM cannot execute this kind of proposal.";
    await deps.markExecuted(id, { ok: false, refused: "not-executable", detail });
    return { ok: false, reason: "not-executable", actionType };
  }

  if (actionType !== "deal_close") {
    // send_email and demo_site are later phases. Recognised, deliberately not
    // yet runnable, and said so rather than failing silently.
    const detail = "This action is recognised but not implemented yet.";
    await deps.markExecuted(id, { ok: false, refused: actionType, detail });
    return { ok: false, reason: "refused", detail };
  }

  const validated = validateDealClose(approval.targetType, approval.targetId, approval.payload);
  if (!validated.ok) {
    await deps.markExecuted(id, { ok: false, refused: "deal_close", detail: validated.reason });
    return { ok: false, reason: "refused", detail: validated.reason };
  }

  try {
    await deps.advanceDealStage({
      dealId: validated.value.dealId,
      toStage: CLOSE_STAGE_FOR_APPROVAL,
      note: validated.value.note,
      actor,
    });
  } catch {
    // The thrown message is deliberately not recorded: it can name a deal, a
    // client or a contact, and campaigns/mailer.ts sets the rule that errors
    // never echo personal data.
    //
    // The wording claims only what this code can stand behind. It does NOT say
    // "the gate refused", because a transport failure throws here too and this
    // cannot tell the two apart - see the note on ExecutionOutcome.
    const detail = "The deal was not advanced. Approving it again will not help until you check why.";
    await deps.markExecuted(id, { ok: false, refused: "deal_close", detail });
    return { ok: false, reason: "refused", detail };
  }

  await deps.markExecuted(id, { ok: true, action: "deal_close" });
  return { ok: true, action: "deal_close" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/approval-executor.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/server/approvals/execute.ts','tests/approval-executor.test.mjs']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
npx eslint src/server/approvals/ tests/approval-executor.test.mjs
git add src/server/approvals/execute.ts tests/approval-executor.test.mjs
git commit -m "feat(approvals): the dispatcher, with gates preserved after approval"
```

---

## Task 3: Wire the dispatcher into the decision

**Files:**
- Create: `src/server/approvals/deps.ts`
- Modify: `src/lib/crm-data.ts` — `decideCrmApproval` (around line 255) and `crmApprovals` (around line 266), and `ApprovalRow` (around line 80)

**Interfaces:**
- Consumes: `executeApproval`, `ExecutorDeps`, `StoredApproval`, `ExecutionOutcome` (Task 2).
- Produces: `crmExecutorDeps(config: { url: string; serviceRoleKey: string }): ExecutorDeps`; `decideCrmApproval` now resolves to `{ ok: true; execution: ExecutionOutcome | null }`; `ApprovalRow` gains `target_type: string | null`, `target_id: string | null`, `proposed_payload: unknown`.

- [ ] **Step 1: Write the deps adapter**

Create `src/server/approvals/deps.ts`:

```typescript
/**
 * The real ExecutorDeps, built from CrmRead and CrmActions.
 *
 * Separate from execute.ts so the dispatcher stays testable with a fake. This
 * module is the only place that knows the executor talks to Postgres at all.
 */
import { CrmRead } from "@/server/crm/read";
import { CrmActions } from "@/server/crm/actions";
import type { ExecutorDeps, StoredApproval } from "@/server/approvals/execute";

export function crmExecutorDeps(config: {
  url: string;
  serviceRoleKey: string;
}): ExecutorDeps {
  // Admin actor: approval_queue is admin_only in MEMBER_TABLE_POLICY, so a
  // member's read returns nothing and the executor refuses with not-found. That
  // is the correct outcome - a member has no business executing an approval -
  // and it is enforced by the same scoping every other surface uses.
  const read = new CrmRead({ ...config, actor: { id: null, isAdmin: true } });
  const actions = new CrmActions(config);

  return {
    async getApproval(id: string): Promise<StoredApproval | null> {
      const row = await read.getById<Record<string, unknown>>(
        "approval_queue",
        id,
        "id,action_type,target_type,target_id,status,proposed_payload",
      );
      if (!row) return null;
      return {
        id: String(row.id),
        actionType: typeof row.action_type === "string" ? row.action_type : null,
        targetType: typeof row.target_type === "string" ? row.target_type : null,
        targetId: typeof row.target_id === "string" ? row.target_id : null,
        status: String(row.status),
        payload: row.proposed_payload,
      };
    },

    advanceDealStage: (input) => actions.advanceDealStage(input),

    markExecuted: async (id, result) => {
      await actions.markApprovalExecuted(id, result);
    },
  };
}
```

- [ ] **Step 2: Add `markApprovalExecuted` to CrmActions**

In `src/server/crm/actions.ts`, directly after the existing `decideApproval` method (which ends around line 85), add:

```typescript
  /** Record what happened to an approved proposal. The RPC raises unless the
   *  status is exactly 'approved', so this is also the guard against marking
   *  something twice. */
  markApprovalExecuted(id: string, result: Record<string, unknown>): Promise<unknown> {
    return this.#rpc<unknown>("approval_mark_executed", {
      p_id: id,
      p_result: result,
    });
  }
```

- [ ] **Step 3: Run the dispatcher through the decision**

In `src/lib/crm-data.ts`, replace the body of `decideCrmApproval` (around line 255) with:

```typescript
export const decideCrmApproval = createServerFn({ method: "POST" })
  .validator(validateDecide)
  .handler(async ({ data }): Promise<{ ok: true; execution: ExecutionOutcome | null }> => {
    const { requireCrmSession } = await import("./crm-auth.server");
    const session = await requireCrmSession();
    const { CrmActions } = await import("@/server/crm/actions");
    const actions = new CrmActions(config());
    const actor = `crm:${session.email}`;

    // decideApproval takes a row lock and raises when the status is not
    // pending, so a double-click throws here and never reaches the executor.
    // That raise IS the serialisation point; do not catch it.
    await actions.decideApproval(data.id, data.decision, actor, data.reason);

    if (data.decision !== "approved") return { ok: true, execution: null };

    const { executeApproval } = await import("@/server/approvals/execute");
    const { crmExecutorDeps } = await import("@/server/approvals/deps");
    const execution = await executeApproval(crmExecutorDeps(config()), data.id, actor);
    return { ok: true, execution };
  });
```

Add the type import at the top of the file, beside the other type-only imports:

```typescript
import type { ExecutionOutcome } from "@/server/approvals/execute";
```

A type-only import is erased at build time and does not put `src/server/*` on the client graph. If the build rejects it, inline the union in `crm-data.ts` instead and report that in your notes.

- [ ] **Step 4: Return the payload to the UI**

In `src/lib/crm-data.ts`, extend `ApprovalRow` (around line 80):

```typescript
export interface ApprovalRow {
  id: string;
  agent_name: string | null;
  action_type: string | null;
  summary: string | null;
  risk_level: string | null;
  requested_at: string | null;
  /** What is actually being approved. Without this an operator approves a
   *  summary rather than the artifact, which for an outbound message would mean
   *  approving "Follow up with Ana" without seeing a word that reaches Ana. */
  target_type: string | null;
  target_id: string | null;
  proposed_payload: unknown;
}
```

In `crmApprovals` (around line 266), add the three fields to the mapping:

```typescript
      target_type: str(r.target_type),
      target_id: str(r.target_id),
      proposed_payload: r.proposed_payload ?? null,
```

In `src/server/crm/read.ts`, extend `listPendingApprovals`'s select list (around line 174) to:

```
"select=id,agent_name,action_type,summary,risk_level,requested_at,target_type,target_id,proposed_payload&status=eq.pending&order=requested_at.desc&limit=200"
```

- [ ] **Step 5: Verify and commit**

```bash
npm run build
node scripts/worker-smoke.mjs
npx eslint src/lib/crm-data.ts src/server/approvals/ src/server/crm/actions.ts src/server/crm/read.ts
python3 -c "
for p in ['src/lib/crm-data.ts','src/server/approvals/deps.ts','src/server/crm/actions.ts','src/server/crm/read.ts']:
    d=open(p,'rb').read().replace(b'\r\n',b'\n')
    open(p,'wb').write(d)
"
git add src/lib/crm-data.ts src/server/approvals/deps.ts src/server/crm/actions.ts src/server/crm/read.ts
git commit -m "feat(approvals): run the executor when a proposal is approved"
```

Expected: build exit 0, smoke 5/5, eslint silent.

---

## Task 4: Show the artifact and the outcome

**Files:**
- Modify: `src/routes/crm.approvals.tsx`

**Interfaces:**
- Consumes: `ApprovalRow` with `target_type`/`target_id`/`proposed_payload` (Task 3); `isExecutableAction` (Task 1); `decideCrmApproval` returning `{ ok, execution }` (Task 3).
- Produces: route behaviour only.

- [ ] **Step 1: Render what is being approved**

In `src/routes/crm.approvals.tsx`, add beneath the existing `{approval.summary && ...}` line inside `ApprovalCard`:

```tsx
      <ProposalDetail approval={approval} />
```

And add these two components at the end of the file:

```tsx
/**
 * What is actually being approved.
 *
 * Before this, the card showed a summary only, so an operator approved a
 * description rather than the artifact. For a deal_close that means seeing
 * which deal and the note that will be recorded as evidence the gate was met.
 */
function ProposalDetail({ approval }: { approval: ApprovalRow }) {
  const payload =
    approval.proposed_payload && typeof approval.proposed_payload === "object"
      ? (approval.proposed_payload as Record<string, unknown>)
      : null;

  if (!isExecutableAction(approval.action_type)) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          The CRM cannot carry this out. Approving records your decision; someone still has to do
          the work.
        </p>
        {payload && (
          <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (approval.action_type === "deal_close") {
    const note = typeof payload?.note === "string" ? payload.note : "";
    return (
      <div className="mt-3 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Advances this deal to Close</p>
        <p className="mt-1 font-mono text-xs">{approval.target_id ?? "no deal named"}</p>
        {note && <p className="mt-2 text-sm text-foreground">{note}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Close still requires a signed SOW. Approving does not skip that check.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Recognised, but the CRM cannot carry this out yet.
      </p>
    </div>
  );
}
```

Add to the imports at the top of the file:

```tsx
import { isExecutableAction } from "@/lib/approval-actions";
```

- [ ] **Step 2: Report what happened after approving**

Replace the `decide` function inside `ApprovalCard` with:

```tsx
  const [outcome, setOutcome] = useState<string>("");

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError("");
    setOutcome("");
    try {
      const result = await decideCrmApproval({ data: { id: approval.id, decision, reason } });
      // A refusal after approval is not an error and must not be silent: an
      // operator who clicked Approve and saw nothing would assume it worked.
      if (result.execution && !result.execution.ok) {
        setOutcome(
          "detail" in result.execution
            ? result.execution.detail
            : "Approved, but the CRM did not carry it out.",
        );
        setBusy(null);
        return;
      }
      await router.invalidate();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message.replace(/^Error:\s*/, "") : "Decision failed",
      );
      setBusy(null);
    }
  }
```

And render it beside the existing error, after the buttons:

```tsx
      {outcome && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {outcome}
        </p>
      )}
```

- [ ] **Step 3: Run the full verify chain**

```bash
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
npm run build
node scripts/worker-smoke.mjs
npx eslint src/routes/crm.approvals.tsx
```

Expected: every test file passes, build exit 0, smoke 5/5, eslint silent.

- [ ] **Step 4: Normalize line endings and commit**

```bash
python3 -c "
p='src/routes/crm.approvals.tsx'
d=open(p,'rb').read().replace(b'\r\n',b'\n')
open(p,'wb').write(d)
"
git add src/routes/crm.approvals.tsx
git commit -m "feat(approvals): approve the artifact, and say what happened"
```

---

## Done when

- [ ] Every test file passes, including the two added here
- [ ] `npm run build` exits 0 and `node scripts/worker-smoke.mjs` meets 5/5
- [ ] A gate refusal after approval is visible to the operator, not silent
- [ ] A payload naming a different deal than the proposal target is refused, asserted in CI
- [ ] An unexecutable `action_type` renders its payload and says the CRM cannot carry it out
- [ ] The failure message claims only what the code can distinguish, and does not assert a gate refusal it cannot prove

## Deliberately not in Phase 1

The `send_email` and `demo_site` handlers, any retry mechanism, a `refused` status distinct from `executed`, and any change to the MCP surface. `demo_site` is blocked on its own PR merging; `send_email` is last by design, because the first end-to-end run of approval-to-execution should not be the one that emails a client.
