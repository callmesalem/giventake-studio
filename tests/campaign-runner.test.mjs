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
  const calls = { sends: [], statuses: [], records: [], claims: [] };
  const store = {
    async claimDue() { return over.dueRows ?? [due()]; },
    async isSuppressed(address) {
      return typeof over.suppressed === "function" ? over.suppressed(address) : (over.suppressed ?? false);
    },
    async isApprovedRecipient(address) {
      return typeof over.approved === "function" ? over.approved(address) : (over.approved ?? true);
    },
    async claimStep(id, step) {
      calls.claims.push({ id, step });
      return typeof over.claimResult === "function"
        ? over.claimResult(id, step)
        : (over.claimResult ?? "claimed");
    },
    async recordResult(id, step, status, msgId, error) {
      calls.records.push({ id, step, status, msgId, error });
    },
    async markStatus(id, status, advance, eventType, details) {
      calls.statuses.push({ id, status, advance, eventType, details });
    },
  };
  const mailer = {
    async send(input) {
      calls.sends.push(input);
      return over.sendOutcome ?? { status: "sent", providerMessageId: "m1" };
    },
  };
  return { calls, deps: {
    store, mailer,
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
  const h = harness({ claimResult: "in_flight" });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0, "must not send when the step is already claimed");
});

test("an in-flight step changes nothing - another tick owns it", async () => {
  // 'sending' is ambiguous: another tick may hold it, or one may have died
  // mid-send. Either way this tick must not touch the enrollment, or it would
  // race the owner or resolve an ambiguity that is not its to resolve.
  const h = harness({ claimResult: "in_flight" });
  const result = await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses.length, 0, "must not change status behind the owning tick");
  assert.equal(h.calls.records.length, 0);
  assert.equal(result.skipped, 1);
});

test("an already-sent step advances without re-sending", async () => {
  // The prospect already has this mail: a previous tick sent it and died
  // before advancing. Re-sending would duplicate; not advancing would wedge.
  const h = harness({ claimResult: "already_sent" });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0, "the mail already went out - never send it twice");
  const advanced = h.calls.statuses.find((s) => s.advance);
  assert.ok(advanced, "expected the enrollment to advance past the delivered step");
  assert.equal(advanced.eventType, "recovered");
  assert.equal(advanced.status, "active");
});

test("a stale claim from a crashed tick is recovered without re-sending", async () => {
  // A tick that died between claiming and recording leaves the row at
  // 'sending'. campaign_claim_step sweeps it once it goes stale and hands back
  // 'already_sent', because we cannot know whether the mail went out and the
  // house rule resolves that ambiguity to sent. This is now the ordinary
  // recovery path for a crashed tick, not just a rare race - so the enrollment
  // must move forward here rather than stall on the same step forever.
  const h = harness({ claimResult: "already_sent" });
  const result = await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0, "the mail may already be in the inbox - never risk a duplicate");
  const advanced = h.calls.statuses.find((s) => s.advance);
  assert.ok(advanced, "a recovered stale claim must advance, not stall on the step");
  assert.equal(advanced.eventType, "recovered");
  assert.equal(result.sent + result.skipped, 1);
});

test("an exhausted step stops the enrollment instead of retrying forever", async () => {
  // MAX_ATTEMPTS is enforced in SQL and surfaced as this claim state. Before
  // the four-state claim it was unreachable, because a failed row was never
  // re-claimed at all.
  const h = harness({ claimResult: "exhausted" });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 0);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
  assert.equal(h.calls.statuses.at(-1).details.reason, "max_attempts");
});

test("a permanent failure stops immediately without burning retries", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_422", permanent: true } });
  await runSendTick(h.deps);
  assert.equal(h.calls.statuses.at(-1).status, "stopped");
});

test("a transient failure leaves the enrollment retryable", async () => {
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" } });
  await runSendTick(h.deps);
  assert.notEqual(h.calls.statuses.at(-1)?.status, "stopped");
});

test("a transient failure is recorded as failed so the next tick can re-claim it", async () => {
  // This is the wedge that was fixed: the failure must land in campaign_sends
  // as 'failed', because that is the only state campaign_claim_step will
  // increment attempts on and hand back as 'claimed' again.
  const h = harness({ sendOutcome: { status: "failed", error: "resend_429" } });
  await runSendTick(h.deps);
  const recorded = h.calls.records.at(-1);
  assert.equal(recorded.status, "failed");
  assert.equal(recorded.error, "resend_429");
  assert.equal(h.calls.statuses.length, 0, "a retryable failure must not touch the enrollment status");
});

test("an ambiguous failure advances and is recorded as sent, never re-sent", async () => {
  // No response came back, so the mail may be in the prospect's inbox. The
  // house rule is that ambiguity resolves to sent: a duplicate is the worse
  // outcome than a missed step.
  const h = harness({
    sendOutcome: { status: "failed", error: "resend_network", ambiguous: true },
  });
  await runSendTick(h.deps);
  assert.equal(h.calls.sends.length, 1, "sent once, and only once");
  assert.equal(h.calls.records.at(-1).status, "sent");
  const advanced = h.calls.statuses.find((s) => s.advance);
  assert.ok(advanced, "expected the enrollment to advance rather than retry into a duplicate");
  assert.equal(advanced.eventType, "sent_ambiguous");
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

test("sent and skipped partition the batch - every row is counted exactly once", async () => {
  // sent++ used to run before the two writes that follow it, so a throw in
  // either counted the row as sent AND again as skipped by the catch.
  const rows = [due({ enrollmentId: "e1" }), due({ enrollmentId: "e2", email: "blocked@y.com" })];
  const h = harness({ dueRows: rows, suppressed: (address) => address === "blocked@y.com" });
  const result = await runSendTick(h.deps);
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.sent + result.skipped, rows.length);
});

test("a throw while recording a send is not double-counted", async () => {
  const h = harness();
  h.deps.store.recordResult = async () => { throw new Error("db down"); };
  const result = await runSendTick(h.deps);
  assert.equal(result.sent, 0, "the write failed, so the row is not a success");
  assert.equal(result.skipped, 1);
});
