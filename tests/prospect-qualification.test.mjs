import test from "node:test";
import assert from "node:assert/strict";
import {
  bandFor,
  isPursuable,
  qualifyProspect,
  QualificationError,
} from "../src/lib/prospect-qualification.ts";

const perfect = {
  businessNeed: 20,
  problemSeverity: 20,
  abilityToPay: 15,
  technologyFit: 15,
  decisionMakerAccess: 10,
  timingTrigger: 10,
  strategicFit: 10,
};

const zero = {
  businessNeed: 0,
  problemSeverity: 0,
  abilityToPay: 0,
  technologyFit: 0,
  decisionMakerAccess: 0,
  timingTrigger: 0,
  strategicFit: 0,
};

test("bandFor maps totals to rubric bands at the boundaries", () => {
  assert.equal(bandFor(100), "exceptional");
  assert.equal(bandFor(90), "exceptional");
  assert.equal(bandFor(89), "high_priority");
  assert.equal(bandFor(75), "high_priority");
  assert.equal(bandFor(74), "qualified");
  assert.equal(bandFor(60), "qualified");
  assert.equal(bandFor(59), "nurture");
  assert.equal(bandFor(40), "nurture");
  assert.equal(bandFor(39), "do_not_pursue");
  assert.equal(bandFor(0), "do_not_pursue");
});

test("qualifyProspect totals and bands a perfect prospect", () => {
  const r = qualifyProspect(perfect);
  assert.equal(r.total, 100);
  assert.equal(r.band, "exceptional");
  assert.equal(r.maxTotal, 100);
});

test("qualifyProspect totals an all-zero prospect to do_not_pursue", () => {
  const r = qualifyProspect(zero);
  assert.equal(r.total, 0);
  assert.equal(r.band, "do_not_pursue");
});

test("qualifyProspect sums a mixed prospect correctly", () => {
  const r = qualifyProspect({ ...zero, businessNeed: 18, problemSeverity: 17, abilityToPay: 12 });
  assert.equal(r.total, 47);
  assert.equal(r.band, "nurture");
});

test("qualifyProspect rejects out-of-range, non-integer, and non-finite sub-scores", () => {
  assert.throws(() => qualifyProspect({ ...perfect, abilityToPay: 16 }), QualificationError);
  assert.throws(() => qualifyProspect({ ...perfect, businessNeed: -1 }), QualificationError);
  assert.throws(() => qualifyProspect({ ...perfect, timingTrigger: 5.5 }), QualificationError);
  assert.throws(() => qualifyProspect({ ...perfect, strategicFit: NaN }), QualificationError);
});

test("isPursuable tracks nurture and up, drops only do_not_pursue", () => {
  assert.equal(isPursuable("exceptional"), true);
  assert.equal(isPursuable("qualified"), true);
  assert.equal(isPursuable("nurture"), true);
  assert.equal(isPursuable("do_not_pursue"), false);
});
