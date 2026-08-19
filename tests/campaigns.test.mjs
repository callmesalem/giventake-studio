import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionCampaign,
  isTerminalEnrollment,
  nextStepDue,
  statusForStopEvent,
} from "../src/lib/campaigns.ts";

const HOUR = 3_600_000;

test("campaign transitions allow only the legal moves", () => {
  assert.equal(canTransitionCampaign("draft", "active"), true);
  assert.equal(canTransitionCampaign("active", "paused"), true);
  assert.equal(canTransitionCampaign("paused", "active"), true);
  assert.equal(canTransitionCampaign("active", "completed"), true);
  assert.equal(canTransitionCampaign("completed", "archived"), true);
  // illegal
  assert.equal(canTransitionCampaign("draft", "completed"), false);
  assert.equal(canTransitionCampaign("completed", "active"), false);
  assert.equal(canTransitionCampaign("archived", "active"), false);
});

test("every stop event maps to a terminal enrollment status", () => {
  for (const ev of ["reply", "unsubscribe", "suppression", "bounce", "manual_stop"]) {
    const status = statusForStopEvent(ev);
    assert.equal(isTerminalEnrollment(status), true, `${ev} -> ${status} should be terminal`);
  }
  assert.equal(statusForStopEvent("reply"), "replied");
  assert.equal(statusForStopEvent("unsubscribe"), "unsubscribed");
  assert.equal(statusForStopEvent("suppression"), "suppressed");
});

test("non-terminal statuses are not terminal", () => {
  assert.equal(isTerminalEnrollment("enrolled"), false);
  assert.equal(isTerminalEnrollment("active"), false);
});

const steps = [
  { order: 1, delayHours: 48 },
  { order: 0, delayHours: 0 }, // intentionally unsorted
  { order: 2, delayHours: 72 },
];

test("nextStepDue never sends for a terminal enrollment", () => {
  const d = nextStepDue({ status: "replied", currentStep: 0, lastAdvancedAt: 0 }, steps, 10 * HOUR);
  assert.equal(d.step, null);
  assert.equal(d.reason, "terminal");
});

test("nextStepDue returns step 0 immediately (0h delay)", () => {
  const d = nextStepDue({ status: "enrolled", currentStep: 0, lastAdvancedAt: 1000 }, steps, 1000);
  assert.equal(d.reason, "due");
  assert.equal(d.step.order, 0);
});

test("nextStepDue withholds a step that is not yet due", () => {
  // step 1 needs 48h after lastAdvancedAt
  const base = 5 * HOUR;
  const early = nextStepDue({ status: "active", currentStep: 1, lastAdvancedAt: base }, steps, base + 47 * HOUR);
  assert.equal(early.reason, "not_due");
  assert.equal(early.step, null);
  const ready = nextStepDue({ status: "active", currentStep: 1, lastAdvancedAt: base }, steps, base + 48 * HOUR);
  assert.equal(ready.reason, "due");
  assert.equal(ready.step.order, 1);
});

test("nextStepDue reports finished when past the last step", () => {
  const d = nextStepDue({ status: "active", currentStep: 3, lastAdvancedAt: 0 }, steps, 999 * HOUR);
  assert.equal(d.reason, "finished");
  assert.equal(d.step, null);
});
