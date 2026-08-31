import test from "node:test";
import assert from "node:assert/strict";
import { runSendTick } from "../src/server/campaigns/runner.ts";

const due = (over = {}) => ({
  enrollmentId: "e1", campaignId: "c1", stepOrder: 0,
  sop: "outreach", email: "x@y.com", name: "X",
  template: { subject: "Hello {{name}}", text: "Hi {{name}}" },
  ...over,
});

const harness = (over = {}) => {
  const calls = { sends: [], statuses: [], records: [] };
  const store = {
    async claimDue() { return over.dueRows ?? [due()]; },
    async isSuppressed() { return over.suppressed ?? false; },
    async isApprovedRecipient() { return over.approved ?? true; },
    async recordSend(id, step, status, msgId, error) {
      calls.records.push({ id, step, status, msgId, error });
      if (status === "sending") return over.recordSendResult ?? true;
      return true;
    },
    async markStatus(id, status, advance, eventType, details) {
      calls.statuses.push({ id, status, advance, eventType, details });
    },
    async attemptsFor() { return over.attempts ?? 0; },
  };
  const mailer = {
    async send(input) {
      calls.sends.push(input);
      return over.sendOutcome ?? { status: "sent", providerMessageId: "m1" };
    },
  };
  return { calls, deps: {
    store, mailer,
    clock: { now: () => new Date("2026-08-31T12:00:00Z") },
    replyTo: "reply@giventakedevs.com",
    unsubscribeBase: "https://giventakedevs.com/api/unsubscribe",
    secret: "test-secret",
    ...over.deps,
  } };
};

test("sends a due step and advances the enrollment", async () => {
  const h = harness();
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 1);
  assert.equal(h.calls.sends[0].to, "x@y.com");
  assert.equal(h.calls.sends[0].subject, "Hello X");
  const advanced = h.calls.statuses.find((s) => s.advance);
  assert.ok(advanced, "expected the enrollment to advance");
});

test("a suppressed address is never mailed", async () => {
  const h = harness({ suppressed: true });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses[0].status, "suppressed");
});

test("an unapproved address is never mailed and records why", async () => {
  const h = harness({ approved: false });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses[0].status, "stopped");
  assert.equal(h.calls.statuses[0].details.reason, "not_approved");
});

test("a replayed step does not send twice", async () => {
  const h = harness({ recordSendResult: false });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0, "must not send when the step is already recorded");
});

test("a permanent failure stops immediately without burning retries", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_422", permanent: true } });
  await runSendTick(h.deps);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
});

test("a transient failure leaves the enrollment retryable", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" }, attempts: 0 });
  await runSendTick(h.deps);
  assert.notEqual(h.calls.statuses.at(-1)?.status, "stopped");
});

test("a transient failure stops after MAX_ATTEMPTS", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" }, attempts: 3 });
  await runSendTick(h.deps);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
});

test("every message carries a List-Unsubscribe header", async () => {
  const h = harness();
  await runSendTick(h.deps);
  assert.match(h.calls.sends[0].headers["List-Unsubscribe"], /^<https:\/\//);
});

test("the unsubscribe link is also in the body", async () => {
  const h = harness();
  await runSendTick(h.deps);
  assert.match(h.calls.sends[0].text, /Unsubscribe: https:\/\//);
});

test("one bad enrollment does not abort the rest of the tick", async () => {
  const h = harness({ dueRows: [due({ enrollmentId: "e1", email: null }), due({ enrollmentId: "e2" })] });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 1, "the healthy enrollment must still send");
});

test("refuses to run at all without a signing secret", async () => {
  // Every message must carry a WORKING unsubscribe link. With no secret the
  // token cannot be verified later, so the link would be dead on arrival -
  // send nothing rather than send mail nobody can opt out of.
  const h = harness({ deps: { secret: "" } });
  await assert.rejects(() => runSendTick(h.deps), /secret/i);
  assert.equal(h.calls.sends.length, 0);
});

test("returns counts of what it did", async () => {
  const h = harness();
  const result = await runSendTick(h.deps);
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, 0);
});
