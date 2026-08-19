import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionReferral, isTerminalReferral } from "../src/lib/referrals.ts";

test("referral transitions allow only legal moves", () => {
  assert.equal(canTransitionReferral("received", "qualified"), true);
  assert.equal(canTransitionReferral("received", "declined"), true);
  assert.equal(canTransitionReferral("qualified", "converted"), true);
  assert.equal(canTransitionReferral("qualified", "declined"), true);
  // illegal
  assert.equal(canTransitionReferral("received", "converted"), false);
  assert.equal(canTransitionReferral("converted", "qualified"), false);
  assert.equal(canTransitionReferral("declined", "received"), false);
});

test("converted and declined are terminal", () => {
  assert.equal(isTerminalReferral("converted"), true);
  assert.equal(isTerminalReferral("declined"), true);
  assert.equal(isTerminalReferral("received"), false);
  assert.equal(isTerminalReferral("qualified"), false);
});
