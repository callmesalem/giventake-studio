# Approval Executor, Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Sami propose a demo site and have an approving admin actually queue it, through the same gates the UI enforces.

**Architecture:** The gate-and-request path is extracted out of the server function into one server-only function, so the executor and the UI call the same code rather than two copies of security-critical gate logic. The executor's handler then reports *which* gate refused, which the `deal_close` handler cannot do.

**Tech Stack:** TanStack Start server functions on Cloudflare Workers, Supabase/PostgREST RPC over raw `fetch`, React 19, Node's built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-09-13-sami-approval-executor-design.md`

## Global Constraints

- **Approval never bypasses a gate.** Every gate the subsystem enforces still runs after approval. A human approval satisfies "a human authorised this", never "this is otherwise permitted".
- **One gated path, not two.** The executor must not be able to reach `demo_site_request` except through the same function the UI uses. Duplicating the gate block is the defect this plan exists to prevent.
- **`proposed_payload` is untrusted input**, written by an agent that reads text strangers typed into a contact form. Identity comes from the structured `approval_queue` columns; the payload supplies content only.
- **`src/lib/*-data.ts` is client-reachable.** It may reach `src/server/*` only via a dynamic `import()` inside a handler.
- **Grants target BOTH `crm_agent` and `agent_sami`.** The cutover's step 5 has not run; both roles still hold 10 enabled capability rows. Verified in the database on 2026-09-13.
- **Errors never carry message bodies, recipient addresses or client names**, per `src/server/campaigns/mailer.ts`.
- **Product copy:** plain, confident, benefit-first, no filler, no em dashes.
- **Line endings LF.** Commits use a short imperative subject, a blank line, then trailers.
- **Verify chain:** the node test loop, `npm run build`, `node scripts/worker-smoke.mjs`, and `npx eslint` on touched files. `npm run test` fails on Windows (npm hands a bash loop to cmd.exe) — run the loop directly. The branch has **49** runnable non-integration test files, all passing on `main` at the time this plan was written (verified by running the loop, not by recalling an earlier number).

---

## No new migration

`demo_site_request` is already on main (#42) and granted to `service_role`. `approval_request`, `approval_decide` and `approval_mark_executed` are already granted. This is app-layer work only.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/approval-actions.ts` *(modify)* | `validateDemoSite`, beside `validateDealClose` |
| `tests/approval-actions.test.mjs` *(modify)* | Tests for it |
| `src/server/demo-sites/request.ts` | The single gated path, extracted |
| `src/lib/demo-sites-data.ts` *(modify)* | Server function delegates to it |
| `src/server/approvals/execute.ts` *(modify)* | `requestDemoSite` on `ExecutorDeps`; the `demo_site` handler |
| `src/server/approvals/deps.ts` *(modify)* | Wires the real implementation |
| `tests/approval-executor.test.mjs` *(modify)* | Handler tests |
| `src/routes/crm.approvals.tsx` *(modify)* | The `demo_site` payload branch |
| `tests/approvals-route.test.mjs` | Asserts that branch exists and says the right thing |

---

## Task 1: Validate a demo_site proposal

**Files:**
- Modify: `src/lib/approval-actions.ts`
- Test: `tests/approval-actions.test.mjs`

**Interfaces:**
- Consumes: the existing `UUID` regex and `ValidationResult<T>` in that file.
- Produces: `interface DemoSitePayload { dealId: string; businessName: string; address: string | null; vertical: string | null }` and `validateDemoSite(targetType: unknown, targetId: unknown, payload: unknown): ValidationResult<DemoSitePayload>`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/approval-actions.test.mjs`:

```javascript
/* demo_site proposals. Same one-source rule as deal_close: identity comes from
 * target_id, content comes from the payload, and a payload that disagrees about
 * identity is refused rather than resolved. */

test("a valid demo_site proposal passes and carries the target deal", () => {
  const result = validateDemoSite("deal", "11111111-2222-3333-4444-555555555555", {
    businessName: "Trattoria Nino",
    address: "18 Mill Street",
    vertical: "restaurant",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.dealId, "11111111-2222-3333-4444-555555555555");
  assert.equal(result.value.businessName, "Trattoria Nino");
  assert.equal(result.value.address, "18 Mill Street");
  assert.equal(result.value.vertical, "restaurant");
});

test("address and vertical are optional and normalise to null", () => {
  // The columns are nullable, and a row storing "" makes "no address given" and
  // "address is blank" indistinguishable to the builder on the VPS.
  for (const blank of ["", "   ", undefined, null, 7]) {
    const result = validateDemoSite("deal", "11111111-2222-3333-4444-555555555555", {
      businessName: "Nino",
      address: blank,
      vertical: blank,
    });
    assert.equal(result.ok, true, `${String(blank)} must be accepted`);
    assert.equal(result.value.address, null);
    assert.equal(result.value.vertical, null);
  }
});

test("a demo_site payload naming a different deal is refused", () => {
  const result = validateDemoSite("deal", "11111111-2222-3333-4444-555555555555", {
    dealId: "99999999-9999-9999-9999-999999999999",
    businessName: "Nino",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /disagree/i);
});

test("a demo_site proposal must target a deal", () => {
  const result = validateDemoSite("company", "11111111-2222-3333-4444-555555555555", {
    businessName: "Nino",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /deal/i);
});

test("a blank business name is refused: the builder has nothing to search for", () => {
  for (const name of ["", "   ", null, undefined, 7]) {
    const result = validateDemoSite("deal", "11111111-2222-3333-4444-555555555555", {
      businessName: name,
    });
    assert.equal(result.ok, false, `${String(name)} must be refused`);
  }
});

test("an over-long business name is refused rather than truncated", () => {
  // demo_sites.business_name has no length cap, and the value reaches a Google
  // Places search. Truncating would silently search for something else.
  const result = validateDemoSite("deal", "11111111-2222-3333-4444-555555555555", {
    businessName: "x".repeat(201),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /too long/i);
});
```

Add `validateDemoSite` to the import at the top of the file:

```javascript
import {
  EXECUTABLE_ACTIONS,
  isExecutableAction,
  validateDealClose,
  validateDemoSite,
} from "../src/lib/approval-actions.ts";
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types tests/approval-actions.test.mjs`
Expected: FAIL — `validateDemoSite` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/approval-actions.ts`:

```typescript
export interface DemoSitePayload {
  dealId: string;
  businessName: string;
  address: string | null;
  vertical: string | null;
}

/** Absent, blank and non-string all collapse to null. The columns are nullable,
 *  and a row storing "" would make "no address given" and "address is blank"
 *  indistinguishable to the builder. */
function optional(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length ? s : null;
}

/**
 * Validate a demo_site proposal.
 *
 * Same one-source rule as validateDealClose: the deal comes from `target_id`,
 * never from the payload, and a payload naming a different deal is a
 * disagreement to refuse rather than a tie to break.
 *
 * The payload DOES supply content: the business name the builder will search
 * Google Places for, and optionally an address and vertical to narrow it. That
 * is the right division. Identity is a decision and must be structured; content
 * is what the proposal is for.
 */
export function validateDemoSite(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<DemoSitePayload> {
  if (targetType !== "deal") {
    return { ok: false, reason: "A demo_site proposal must target a deal." };
  }

  const dealId = typeof targetId === "string" ? targetId.trim() : "";
  if (!UUID.test(dealId)) {
    return { ok: false, reason: "The proposal does not name a valid deal." };
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "The proposal has no payload to validate." };
  }
  const record = payload as Record<string, unknown>;

  const claimed = record.dealId;
  if (typeof claimed === "string" && claimed.trim() && claimed.trim() !== dealId) {
    return {
      ok: false,
      reason: "The payload and the proposal target disagree about which deal this is.",
    };
  }

  const businessName = typeof record.businessName === "string" ? record.businessName.trim() : "";
  if (!businessName) {
    return {
      ok: false,
      reason: "The builder has nothing to search Google Places for without a business name.",
    };
  }
  if (businessName.length > 200) {
    // Refused rather than truncated: a shortened name searches for a different
    // business, and the operator approved the one they read.
    return { ok: false, reason: "The business name is too long." };
  }

  return {
    ok: true,
    value: {
      dealId,
      businessName,
      address: optional(record.address),
      vertical: optional(record.vertical),
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --experimental-strip-types tests/approval-actions.test.mjs`
Expected: PASS, 15 tests (9 existing plus 6 new).

- [ ] **Step 5: Normalize line endings, lint, commit**

```bash
python3 -c "
for p in ['src/lib/approval-actions.ts','tests/approval-actions.test.mjs']:
    d=open(p,'rb').read().replace(bytes([13,10]),bytes([10]))
    open(p,'wb').write(d)
"
npx eslint src/lib/approval-actions.ts tests/approval-actions.test.mjs
git add src/lib/approval-actions.ts tests/approval-actions.test.mjs
git commit -m "feat(approvals): validate a demo_site proposal"
```

---

## Task 2: Extract the single gated path

**Files:**
- Create: `src/server/demo-sites/request.ts`
- Modify: `src/lib/demo-sites-data.ts` — `requestDealDemoSite`'s handler

**This task changes no behaviour.** It moves the gate-and-request block into a function two callers can share. The verification is that the existing tests and build still pass.

**Interfaces:**
- Consumes: `forDeal`, `outboundControl` from `@/server/demo-sites/access`; `buildDemoSiteGates`, `isDemoSiteRequestable`, `Gate` from `@/lib/crm-guards`.
- Produces: `type DemoSiteRequestOutcome = { ok: true; demoSiteId: string } | { ok: false; gates: Gate[] }` and `requestDemoSiteForDeal(input: { dealId: string; businessName: string; address: string | null; vertical: string | null }): Promise<DemoSiteRequestOutcome>`.

- [ ] **Step 1: Create the shared function**

Create `src/server/demo-sites/request.ts`:

```typescript
/**
 * The one path that queues a demo site.
 *
 * Both the deal page and the approval executor reach demo_site_request through
 * here, and that is the point. Queuing a demo puts a public website on the
 * internet under a prospect's name, so the §10 kill switch and the duplicate
 * guard have to hold on every route in. Two copies of that gate block would be
 * two implementations that must agree forever; one function cannot disagree
 * with itself.
 *
 * Server-only. src/lib/demo-sites-data.ts reaches it by dynamic import().
 */
import { buildDemoSiteGates, isDemoSiteRequestable, type Gate } from "@/lib/crm-guards";
import { forDeal, outboundControl } from "@/server/demo-sites/access";

export type DemoSiteRequestOutcome =
  | { ok: true; demoSiteId: string }
  /** Refused. The gates travel with the refusal so a caller can say WHICH one
   *  said no, rather than reporting an undifferentiated failure. */
  | { ok: false; gates: Gate[] };

export async function requestDemoSiteForDeal(input: {
  dealId: string;
  businessName: string;
  address: string | null;
  vertical: string | null;
}): Promise<DemoSiteRequestOutcome> {
  const { session, read, deal, store } = await forDeal(input.dealId);

  // Read the facts the gate needs FROM THE DATABASE, now. A caller may have
  // computed gates minutes ago; the kill switch may have been thrown since, and
  // a stale pass must not be what authorises a deployment.
  const [existing, control] = await Promise.all([
    store.listForDeal(input.dealId),
    outboundControl(read),
  ]);

  const gates = buildDemoSiteGates({
    outboundEnabled: control.outboundEnabled,
    outboundReason: control.reason,
    hasTarget: true,
    businessName: input.businessName,
    existingStatuses: existing.map((d) => d.status),
  });

  // Nothing is written on refusal. A demo_sites row that exists but must never
  // be built is a trap for whoever finds it later.
  if (!isDemoSiteRequestable(gates)) return { ok: false, gates };

  const demoSiteId = await store.requestDemoSite({
    // Both ids are attached when the deal has a company, so the demo surfaces
    // on the company record too. The table requires at least one; a deal always
    // supplies one here.
    companyId: typeof deal.company_id === "string" ? deal.company_id : null,
    dealId: input.dealId,
    businessName: input.businessName,
    address: input.address,
    vertical: input.vertical,
    requestedBy: session.userId,
  });

  return { ok: true, demoSiteId };
}
```

- [ ] **Step 2: Delegate from the server function**

In `src/lib/demo-sites-data.ts`, replace the body of `requestDealDemoSite`'s `.handler(...)` with:

```typescript
  .handler(async ({ data }): Promise<RequestDemoSiteResult> => {
    const { requestDemoSiteForDeal } = await import("@/server/demo-sites/request");
    const outcome = await requestDemoSiteForDeal({
      dealId: data.dealId,
      businessName: data.businessName,
      address: data.address,
      vertical: data.vertical,
    });
    if (!outcome.ok) return { ok: false, reason: "refused", gates: outcome.gates };
    return { ok: true, demoSiteId: outcome.demoSiteId };
  });
```

**The import block needs no change.** Verified before this plan was written: `src/lib/demo-sites-data.ts:25` imports `buildDemoSiteGates`, `isDemoSiteRequestable` and `type Gate`, and after this edit all three are still used in that file — the first two by `listDealDemoSites` (lines 112 and 124), and `Gate` by the two result types (lines 83 and 157). Do not delete anything from line 25.

- [ ] **Step 3: Verify nothing changed**

```bash
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
npm run build
node scripts/worker-smoke.mjs
npx eslint src/lib/demo-sites-data.ts src/server/demo-sites/
```

Expected: 49 test files pass, build exit 0, smoke 5/5, eslint silent. The demo-site gate tests in `tests/demo-sites-gates.test.mjs` still pass because `buildDemoSiteGates` is untouched — they are the evidence this refactor preserved behaviour.

- [ ] **Step 4: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/server/demo-sites/request.ts','src/lib/demo-sites-data.ts']:
    d=open(p,'rb').read().replace(bytes([13,10]),bytes([10]))
    open(p,'wb').write(d)
"
git add src/server/demo-sites/request.ts src/lib/demo-sites-data.ts
git commit -m "refactor(demo-sites): one gated path, shared by the UI and the executor"
```

---

## Task 3: The demo_site handler

**Files:**
- Modify: `src/server/approvals/execute.ts`
- Modify: `src/server/approvals/deps.ts`
- Test: `tests/approval-executor.test.mjs`

**Interfaces:**
- Consumes: `validateDemoSite`, `DemoSitePayload` (Task 1); `requestDemoSiteForDeal`, `DemoSiteRequestOutcome` (Task 2).
- Produces: `ExecutorDeps.requestDemoSite(input: { dealId: string; businessName: string; address: string | null; vertical: string | null }): Promise<{ ok: true; demoSiteId: string } | { ok: false; refusedGate: string }>`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/approval-executor.test.mjs`:

```javascript
/* demo_site. Unlike deal_close, this handler can say WHICH gate refused,
 * because the demo-site gates are returned rather than thrown. */

const demoApproved = (over = {}) => ({
  id: "a2",
  actionType: "demo_site",
  agentName: "sami",
  targetType: "deal",
  targetId: DEAL,
  status: "approved",
  payload: { businessName: "Trattoria Nino", address: "18 Mill Street" },
  ...over,
});

/** Extends fakeDeps with a demo-site queue that records what it was asked for. */
function fakeDemoDeps({ approval, refusedGate = null } = {}) {
  const marked = [];
  const requested = [];
  return {
    marked,
    requested,
    async getApproval() {
      return approval ?? null;
    },
    async advanceDealStage() {
      throw new Error("advanceDealStage must not be called for a demo_site");
    },
    async requestDemoSite(input) {
      requested.push(input);
      if (refusedGate) return { ok: false, refusedGate };
      return { ok: true, demoSiteId: "demo-1" };
    },
    async markExecuted(id, result) {
      marked.push({ id, result });
    },
  };
}

test("an approved demo_site queues the build and is marked executed", async () => {
  const deps = fakeDemoDeps({ approval: demoApproved() });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(deps.requested.length, 1);
  assert.equal(deps.requested[0].dealId, DEAL);
  assert.equal(deps.requested[0].businessName, "Trattoria Nino");
  assert.equal(deps.marked.length, 1);
  assert.equal(deps.marked[0].result.ok, true);
});

test("a refused gate names itself and nothing is queued", async () => {
  // The kill switch being off is the case this whole feature exists to respect.
  const deps = fakeDemoDeps({ approval: demoApproved(), refusedGate: "kill-switch" });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.match(outcome.detail, /kill-switch/);
  assert.equal(deps.marked.length, 1);
  assert.equal(deps.marked[0].result.ok, false);
});

test("a demo_site payload naming a different deal is refused before anything runs", async () => {
  const deps = fakeDemoDeps({
    approval: demoApproved({ payload: { dealId: "99999999-9999-9999-9999-999999999999", businessName: "Nino" } }),
  });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.requested.length, 0);
});

test("a demo_site with no business name is refused and recorded", async () => {
  const deps = fakeDemoDeps({ approval: demoApproved({ payload: { businessName: "  " } }) });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(deps.requested.length, 0);
  assert.equal(deps.marked.length, 1);
});

test("a bookkeeping failure after a real queue still reports the queue", async () => {
  // Same rule as deal_close: the row exists, and telling the operator it failed
  // would be a lie they cannot correct.
  const deps = fakeDemoDeps({ approval: demoApproved() });
  deps.markExecuted = async () => {
    throw new Error("rpc failed");
  };
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.recorded, false);
  assert.equal(deps.requested.length, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types tests/approval-executor.test.mjs`
Expected: FAIL — `demo_site` currently takes the "recognised but not implemented" path, so the first test's `outcome.ok` is `false`.

- [ ] **Step 3: Add the dependency and the handler**

In `src/server/approvals/execute.ts`, add to `ExecutorDeps` after `advanceDealStage`:

```typescript
  /** Queue a demo site through the SAME gated path the deal page uses.
   *
   *  Returns the refusing gate rather than throwing, which is richer than
   *  advanceDealStage can manage: the demo gates are values, not exceptions, so
   *  the operator can be told the kill switch is off rather than only that it
   *  did not run. */
  requestDemoSite(input: {
    dealId: string;
    businessName: string;
    address: string | null;
    vertical: string | null;
  }): Promise<{ ok: true; demoSiteId: string } | { ok: false; refusedGate: string }>;
```

Import `validateDemoSite` alongside the existing imports:

```typescript
import { isExecutableAction, validateDealClose, validateDemoSite } from "../../lib/approval-actions.ts";
```

Then replace the "recognised but not implemented" branch. Find:

```typescript
  if (actionType !== "deal_close") {
```

and change it so `demo_site` is handled before that fallback. Insert this block immediately **before** that `if`:

```typescript
  if (actionType === "demo_site") {
    const validated = validateDemoSite(approval.targetType, approval.targetId, approval.payload);
    if (!validated.ok) {
      const recorded = await record(deps, id, {
        ok: false,
        refused: "demo_site",
        detail: validated.reason,
      });
      return recorded
        ? { ok: false, reason: "refused", detail: validated.reason }
        : { ok: false, reason: "refused", detail: validated.reason, recorded: false };
    }

    const queued = await deps.requestDemoSite(validated.value);
    if (!queued.ok) {
      // Named, because "the kill switch is off" and "a demo is already building"
      // lead an operator to do completely different things.
      const detail = `The demo was not queued. Gate refused: ${queued.refusedGate}.`;
      const recorded = await record(deps, id, { ok: false, refused: "demo_site", detail });
      return recorded
        ? { ok: false, reason: "refused", detail }
        : { ok: false, reason: "refused", detail, recorded: false };
    }

    const recorded = await record(deps, id, { ok: true, action: "demo_site" });
    return recorded
      ? { ok: true, action: "demo_site" }
      : { ok: true, action: "demo_site", recorded: false };
  }
```

- [ ] **Step 4: Wire the real implementation**

In `src/server/approvals/deps.ts`, add to the import block at the top:

```typescript
import { requestDemoSiteForDeal } from "@/server/demo-sites/request";
```

A **static** import, unlike the dynamic ones in `src/lib/*-data.ts`. The dynamic form exists there because those files are client-reachable. `deps.ts` is not: it is itself reached only by a dynamic `import()` inside `decideCrmApproval`, so everything it imports is already off the client graph. Static is then the better form, because a mistyped path fails the build instead of at runtime.

Then add to the returned object after `advanceDealStage`, matching the arrow-property style of its neighbours:

```typescript
    requestDemoSite: async (input) => {
      const outcome = await requestDemoSiteForDeal(input);
      if (outcome.ok) return { ok: true, demoSiteId: outcome.demoSiteId };
      // The first blocking gate that did not pass is the one worth naming. The
      // gates are built in a fixed order, so this is stable.
      const blocking = outcome.gates.find((g) => !g.pass && g.blocking);
      return { ok: false, refusedGate: blocking ? blocking.id : "unknown" };
    },
```

`Gate` carries `{ id, label, pass, detail, blocking }`, and the four demo gate ids are `kill-switch`, `target`, `business-name`, `no-duplicate` — so `refusedGate` is one of those four, or `unknown`.

- [ ] **Step 5: Run the tests and the full chain**

```bash
node --experimental-strip-types tests/approval-executor.test.mjs
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
npm run build
node scripts/worker-smoke.mjs
npx eslint src/server/approvals/ tests/approval-executor.test.mjs
```

Expected: the executor test file has 19 tests (14 existing plus 5 new), all pass; 49 test files pass; build exit 0; smoke 5/5; eslint silent.

- [ ] **Step 6: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/server/approvals/execute.ts','src/server/approvals/deps.ts','tests/approval-executor.test.mjs']:
    d=open(p,'rb').read().replace(bytes([13,10]),bytes([10]))
    open(p,'wb').write(d)
"
git add src/server/approvals/execute.ts src/server/approvals/deps.ts tests/approval-executor.test.mjs
git commit -m "feat(approvals): the demo_site handler, naming the gate that refused"
```

---

---

## Task 4: Show the operator what a demo_site proposal actually is

**Files:**
- Modify: `src/routes/crm.approvals.tsx` — `ProposalDetail`
- Test: `tests/approvals-route.test.mjs` (create)

**Why this task is not optional.** `ProposalDetail` has three branches today: unexecutable, `deal_close`, and a fallback that renders raw JSON under the words *"Recognised, but the CRM cannot carry this out yet."* `demo_site` currently lands in that fallback. The moment Task 3 ships, that sentence becomes false: the Approve button queues a real public website, while the page tells the operator nothing will happen. A page that disclaims an action it performs is worse than one that never mentioned it. Spec section 3 also names exactly what this must show: business name, address, and the record it attaches to.

**Interfaces:**
- Consumes: `ApprovalRow` (`target_label`, `target_id`, `proposed_payload`) — already carries everything needed; no loader or VM change.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Create `tests/approvals-route.test.mjs`:

```javascript
// The approvals route's payload rendering, asserted against the route source.
//
// Same pattern as tests/compliance-tracking.test.mjs, and for the same reason:
// there is no DOM harness for routes in this repo, and what is being protected
// is a CLAIM the page makes to an operator. The fallback branch says "the CRM
// cannot carry this out yet" - true of send_email, false of demo_site the
// moment the Phase 2 handler lands. An Approve button that queues a public
// website, sitting under a sentence promising it will not, is the regression
// this file exists to catch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/crm.approvals.tsx", import.meta.url), "utf8");

test("demo_site has its own branch and no longer falls through to the fallback", () => {
  assert.match(route, /action_type === "demo_site"/);
});

test("the demo_site branch shows the facts being approved", () => {
  // Spec section 3: business name, address, and the record it attaches to.
  assert.match(route, /businessName/);
  assert.match(route, /payload\?\.address/);
});

test("the demo_site branch restates the gates that approval does not skip", () => {
  // The deal_close branch carries the equivalent line about a signed SOW. An
  // operator should never be able to read this card and believe approving is
  // what makes the deployment permitted.
  assert.match(route, /Approving does not skip them/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types tests/approvals-route.test.mjs`
Expected: FAIL on all three — there is no `demo_site` branch yet.

- [ ] **Step 3: Add the branch**

In `src/routes/crm.approvals.tsx`, insert **after** the `deal_close` branch and **before** the final fallback `return`:

```tsx
  if (approval.action_type === "demo_site") {
    const businessName = typeof payload?.businessName === "string" ? payload.businessName : "";
    const address = typeof payload?.address === "string" ? payload.address : "";
    const vertical = typeof payload?.vertical === "string" ? payload.vertical : "";
    return (
      <div className="mt-3 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Queues a public demo site for this record</p>
        {approval.target_label && (
          <p className="mt-1 break-words text-sm font-medium text-foreground">
            {approval.target_label}
          </p>
        )}
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
          {approval.target_id ?? "no deal named"}
        </p>
        <p className="mt-2 break-words text-sm text-foreground">
          {businessName || "No business name given"}
        </p>
        {(address || vertical) && (
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {[address, vertical].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          The kill switch and the duplicate check still apply. Approving does not skip them.
        </p>
      </div>
    );
  }
```

Note what this branch does NOT do: it does not recompute gates and it does not show a pass/fail list. The card is rendered from `proposed_payload`, which an agent wrote, and gates computed at render time would be stale by the time Approve is clicked. The real gates run inside `requestDemoSiteForDeal` at execution. This line tells the operator that, instead of showing them a result that might have changed.

- [ ] **Step 4: Run to verify it passes, then the full chain**

```bash
node --experimental-strip-types tests/approvals-route.test.mjs
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
npm run build
node scripts/worker-smoke.mjs
npx eslint src/routes/crm.approvals.tsx tests/approvals-route.test.mjs
```

Expected: 3 tests pass; **50** test files now pass (the 49 baseline plus this new file); build exit 0; smoke 5/5; eslint silent.

- [ ] **Step 5: Normalize line endings and commit**

```bash
python3 -c "
for p in ['src/routes/crm.approvals.tsx','tests/approvals-route.test.mjs']:
    d=open(p,'rb').read().replace(bytes([13,10]),bytes([10]))
    open(p,'wb').write(d)
"
git add src/routes/crm.approvals.tsx tests/approvals-route.test.mjs
git commit -m "feat(approvals): render what a demo_site proposal will actually build"
```

## Done when

- [ ] Every test file passes, including the 6 and 5 added here
- [ ] `npm run build` exits 0 and `node scripts/worker-smoke.mjs` meets 5/5
- [ ] The executor reaches `demo_site_request` **only** through `requestDemoSiteForDeal`, so it cannot bypass the kill switch or the duplicate guard
- [ ] A refused gate is named to the operator, not reported as an undifferentiated failure
- [ ] A payload naming a different deal than the proposal target is refused, asserted in CI
- [ ] No approval card claims the CRM cannot carry out an action it now carries out

## Deliberately not in Phase 2

The `send_email` handler, a typed error on `CrmActions` (still wanted before `send_email` lands, since "the gate refused" and "it did not run" are indistinguishable there), a decided-approvals view, and demo requests targeting a company rather than a deal. `demo_sites` accepts either, but Phase 2 keeps one target type so the validation has one shape.
