import test from "node:test";
import assert from "node:assert/strict";
import { canDecideApproval, isApprovalExpired, isValidRiskLevel } from "../src/lib/approvals.ts";

test("approval transitions allow only legal moves", () => {
  assert.equal(canDecideApproval("pending", "approved"), true);
  assert.equal(canDecideApproval("pending", "rejected"), true);
  assert.equal(canDecideApproval("pending", "expired"), true);
  assert.equal(canDecideApproval("approved", "executed"), true);
  // illegal
  assert.equal(canDecideApproval("approved", "rejected"), false);
  assert.equal(canDecideApproval("rejected", "approved"), false);
  assert.equal(canDecideApproval("executed", "approved"), false);
});

test("expiry: null never expires; past expiry does", () => {
  assert.equal(isApprovalExpired(null, 999), false);
  assert.equal(isApprovalExpired(1000, 999), false);
  assert.equal(isApprovalExpired(1000, 1001), true);
});

test("risk level validation", () => {
  assert.equal(isValidRiskLevel("critical"), true);
  assert.equal(isValidRiskLevel("bogus"), false);
});
