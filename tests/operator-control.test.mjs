import test from "node:test";
import assert from "node:assert/strict";
import {
  requireControls,
  enforceAction,
  payloadHash,
  validateApproval,
  consumeApproval,
  runSyntheticWorkflow,
} from "../src/server/operator-control/index.ts";
const base = () => ({
  controls: { globalEnabled: true, enabled: true, allowedModes: ["synthetic"] },
  approvals: new Map(),
  consumed: new Set(),
  events: [],
  keys: new Set(),
  suppressed: false,
  ai: true,
  async getControls() {
    return this.controls;
  },
  async getApproval(id) {
    return this.approvals.get(id) || null;
  },
  async consumeApproval(id) {
    if (this.consumed.has(id)) return false;
    this.consumed.add(id);
    return true;
  },
  async appendAudit(e) {
    this.events.push(e);
  },
  async claimIdempotency(k) {
    if (this.keys.has(k)) return false;
    this.keys.add(k);
    return true;
  },
  async isSuppressed() {
    return this.suppressed;
  },
  async clientAllowsAi() {
    return this.ai;
  },
});
const rejects = (p, code) => assert.rejects(p, (e) => e.code === code || e.message === code);
test("controls fail closed for missing, disabled, and storage errors", async () => {
  let s = base();
  s.controls = null;
  await rejects(requireControls(s, "x", "synthetic"), "control_missing");
  s = base();
  s.controls.globalEnabled = false;
  await rejects(requireControls(s, "x", "synthetic"), "global_kill_switch");
  s = base();
  s.controls.enabled = false;
  await rejects(requireControls(s, "x", "synthetic"), "control_disabled");
  s = base();
  s.getControls = async () => {
    throw Error();
  };
  await rejects(requireControls(s, "x", "synthetic"), "control_unavailable");
});
test("hard prohibited actions always denied", () => {
  for (const a of ["send", "deploy", "set_price", "change_scope", "sign", "refund"])
    assert.throws(() => enforceAction(a), /hard_prohibition/);
});
test("approval exact binding, expiry, revocation and one use", async () => {
  const payload = { b: 2, a: 1 },
    mk = (x = {}) => ({
      id: "a",
      action: "draft",
      payloadHash: payloadHash(payload),
      expiresAt: "2099-01-01",
      ...x,
    });
  assert.doesNotThrow(() => validateApproval(mk(), "draft", { a: 1, b: 2 }));
  assert.throws(() => validateApproval(mk(), "draft", { a: 2 }), /approval_payload_mismatch/);
  assert.throws(
    () => validateApproval(mk({ expiresAt: "2000-01-01" }), "draft", payload),
    /approval_expired/,
  );
  assert.throws(
    () => validateApproval(mk({ revokedAt: "2020-01-01" }), "draft", payload),
    /approval_revoked/,
  );
  let s = base();
  s.approvals.set("a", mk());
  await consumeApproval(s, "a", "draft", payload);
  await rejects(consumeApproval(s, "a", "draft", payload), "approval_consumed");
});
const input = {
  operator: "lead-op",
  runId: "r1",
  idempotencyKey: "k1",
  lead: { email: "synthetic@example.invalid" },
  clientId: "c1",
  draft: "illustrative draft",
};
test("audit failure blocks", async () => {
  let s = base();
  s.appendAudit = async () => {
    throw Error();
  };
  await rejects(runSyntheticWorkflow(s, input), "audit_failed");
});
test("client restriction and suppression block", async () => {
  let s = base();
  s.ai = false;
  await rejects(runSyntheticWorkflow(s, input), "client_ai_restricted");
  s = base();
  s.suppressed = true;
  await rejects(runSyntheticWorkflow(s, input), "suppressed");
});
test("idempotency blocks duplicate", async () => {
  let s = base();
  await runSyntheticWorkflow(s, input);
  await rejects(runSyntheticWorkflow(s, input), "duplicate_idempotency");
});
test("synthetic workflow queues approval with no side effects", async () => {
  let s = base();
  let r = await runSyntheticWorkflow(s, input);
  assert.equal(r.status, "awaiting_approval");
  assert.equal(r.sideEffects, 0);
  assert.deepEqual(r.steps, [
    "lead_recorded",
    "compliance_passed",
    "draft_created",
    "approval_queued",
  ]);
  assert.equal(s.events.length, 4);
});
