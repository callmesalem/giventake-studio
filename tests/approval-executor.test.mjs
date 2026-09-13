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

test("a bookkeeping failure after a real advance still reports the advance", async () => {
  // The deal IS closed. Telling the operator it failed would be a lie they
  // cannot correct: approval_decide now raises on a retry.
  const deps = fakeDeps({ approval: approved() });
  deps.markExecuted = async () => {
    throw new Error("rpc failed");
  };
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.recorded, false);
  assert.equal(deps.advanced.length, 1);
});
