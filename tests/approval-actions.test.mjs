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
