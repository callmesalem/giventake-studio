import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUnsubscribe,
  canReceiveNewsletter,
  canTransitionIssue,
  confirmSubscription,
  eligibleRecipients,
} from "../src/lib/newsletter.ts";

const HOUR = 3_600_000;

test("double opt-in confirms only from pending within TTL", () => {
  const issued = 1_000_000;
  const ok = confirmSubscription("pending", issued, issued + 10 * HOUR, 72);
  assert.deepEqual(ok, { ok: true, status: "confirmed" });

  const expired = confirmSubscription("pending", issued, issued + 73 * HOUR, 72);
  assert.deepEqual(expired, { ok: false, reason: "token_expired" });

  const notPending = confirmSubscription("confirmed", issued, issued + HOUR, 72);
  assert.deepEqual(notPending, { ok: false, reason: "not_pending" });
});

test("send-eligibility is fail-closed: confirmed and not suppressed only", () => {
  assert.equal(canReceiveNewsletter("confirmed", false), true);
  assert.equal(canReceiveNewsletter("confirmed", true), false); // suppressed wins
  assert.equal(canReceiveNewsletter("pending", false), false);
  assert.equal(canReceiveNewsletter("unsubscribed", false), false);
  assert.equal(canReceiveNewsletter("bounced", false), false);
});

test("unsubscribe is honored from active states, no-op for terminal suppression/bounce", () => {
  assert.equal(applyUnsubscribe("confirmed"), "unsubscribed");
  assert.equal(applyUnsubscribe("pending"), "unsubscribed");
  assert.equal(applyUnsubscribe("suppressed"), "suppressed");
  assert.equal(applyUnsubscribe("bounced"), "bounced");
});

test("issue lifecycle allows only legal transitions", () => {
  assert.equal(canTransitionIssue("draft", "scheduled"), true);
  assert.equal(canTransitionIssue("scheduled", "sent"), true);
  assert.equal(canTransitionIssue("scheduled", "draft"), true);
  assert.equal(canTransitionIssue("sent", "archived"), true);
  assert.equal(canTransitionIssue("draft", "sent"), false); // must schedule first
  assert.equal(canTransitionIssue("sent", "draft"), false);
  assert.equal(canTransitionIssue("archived", "draft"), false);
});

test("eligibleRecipients keeps only confirmed, non-suppressed subscribers", () => {
  const list = [
    { email: "a", status: "confirmed", suppressed: false },
    { email: "b", status: "confirmed", suppressed: true },
    { email: "c", status: "pending", suppressed: false },
    { email: "d", status: "unsubscribed", suppressed: false },
  ];
  const out = eligibleRecipients(list).map((s) => s.email);
  assert.deepEqual(out, ["a"]);
});
