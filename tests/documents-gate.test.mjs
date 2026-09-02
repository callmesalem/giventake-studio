import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOSE_STAGE_NAME,
  advanceBlockedByUnsignedSow,
  isCloseStage,
} from "../src/lib/crm-guards.ts";

/* ── Stage 4's gate, decided without a database ─────────────────────────────
 *
 * This is the predicate src/server/crm/actions.ts calls before it lets a deal
 * into "Close". It is imported here from the module that ships it, not
 * restated: a test that re-implements the rule proves the test compiles, not
 * that the gate closes.
 *
 * actions.ts itself is not importable under `node --experimental-strip-types`
 * (it resolves "@/lib/crm-guards", an alias only Vite understands), which is
 * exactly why the rule lives in crm-guards.ts and actions.ts re-exports it.
 */

// --- the gate fires for the real value -------------------------------------

test("Close with no signed SOW is blocked", () => {
  assert.equal(advanceBlockedByUnsignedSow("Close", false), true);
});

test("Close with a signed SOW is allowed", () => {
  assert.equal(advanceBlockedByUnsignedSow("Close", true), false);
});

/* The value that actually arrives. crm-data.ts validates toStage as
 * text(d?.toStage, "Stage", 80, true) and crmStages feeds the UI stage NAMES,
 * so the string on the wire is "Close" - and deals.stage stores names, not
 * numbers. The constant is asserted against the literal so a rename of the
 * constant cannot silently change what the gate matches. */
test("the stage the gate matches is the literal name Close", () => {
  assert.equal(CLOSE_STAGE_NAME, "Close");
  assert.equal(advanceBlockedByUnsignedSow(CLOSE_STAGE_NAME, false), true);
});

// --- case and whitespace ---------------------------------------------------

test("close, CLOSE and padded Close are all still blocked without a signature", () => {
  for (const stage of ["close", "CLOSE", " Close ", "\tclose\n", "cLoSe"]) {
    assert.equal(
      advanceBlockedByUnsignedSow(stage, false),
      true,
      `${JSON.stringify(stage)} must be recognised as Close`,
    );
    assert.equal(
      advanceBlockedByUnsignedSow(stage, true),
      false,
      `${JSON.stringify(stage)} must pass once signed`,
    );
  }
});

// --- every other stage is untouched ----------------------------------------

/* The comment on advanceDealStage is right about the other eleven gates:
 * "Problem understood, quantified" is a judgement and no function can witness
 * it. This gate is the single exception and must not leak into its neighbours.
 */
test("stages other than Close are never blocked by this gate", () => {
  for (const stage of [
    "Lead arrives",
    "Scope",
    "Kickoff",
    "Qualify",
    "Discovery",
    "Proposal",
    "Closed won",
    "Closed lost",
    "",
  ]) {
    assert.equal(
      advanceBlockedByUnsignedSow(stage, false),
      false,
      `${JSON.stringify(stage)} must not be gated on a SOW`,
    );
    assert.equal(advanceBlockedByUnsignedSow(stage, true), false);
  }
});

/* "Closed won" starts with "Close". A prefix or substring match would gate it
 * too, which would block a stage this feature has no evidence about. */
test("stage names that merely contain Close are not Close", () => {
  assert.equal(advanceBlockedByUnsignedSow("Closed won", false), false);
  assert.equal(advanceBlockedByUnsignedSow("Close out", false), false);
  assert.equal(advanceBlockedByUnsignedSow("Pre-Close", false), false);
});

// --- the bug this file exists to pin ---------------------------------------

/* An earlier draft of this gate compared toStage === "4".
 *
 * deals.stage holds stage NAMES; pipeline_stages maps 4 = Close, but that
 * number never travels. A gate keyed on "4" would exist, pass its tests, show
 * up in the UI, and let every real deal walk into Close unsigned - because the
 * string on the wire is "Close" and "Close" !== "4".
 *
 * So "4" must NOT be treated as Close. If somebody "simplifies" the predicate
 * back to a stage number, this is the assertion that stops them.
 */
test('the literal "4" is not treated as Close', () => {
  assert.equal(advanceBlockedByUnsignedSow("4", false), false);
  assert.equal(advanceBlockedByUnsignedSow("4", true), false);
  assert.equal(advanceBlockedByUnsignedSow(" 4 ", false), false);
  assert.equal(advanceBlockedByUnsignedSow("stage 4", false), false);
});

/* The same pin one level down. advanceDealStage asks isCloseStage whether to
 * spend the deal_has_signed_sow RPC at all, so if THIS answered true for "4"
 * and false for "Close", the gate would query the wrong advances and skip the
 * right ones. */
test('isCloseStage recognises "Close" and refuses "4"', () => {
  assert.equal(isCloseStage("Close"), true);
  assert.equal(isCloseStage(" close "), true);
  assert.equal(isCloseStage("4"), false);
  assert.equal(isCloseStage(4), false);
  assert.equal(isCloseStage("Closed won"), false);
  assert.equal(isCloseStage("Scope"), false);
});

// --- non-strings cannot open the gate by accident --------------------------

test("a non-string stage is not Close", () => {
  for (const stage of [null, undefined, 4, {}, ["Close"]]) {
    assert.equal(advanceBlockedByUnsignedSow(stage, false), false);
  }
});

/* Anything other than an explicit true is "not signed" - the same posture
 * store.ts takes at dealHasSignedSow, where a null must not read as a pass. */
test("only an explicit true counts as a signature", () => {
  for (const signed of [undefined, null, 0, "", "true", 1, "yes"]) {
    assert.equal(
      advanceBlockedByUnsignedSow("Close", signed),
      true,
      `${JSON.stringify(signed)} must not count as a signed SOW`,
    );
  }
});
