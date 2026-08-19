import test from "node:test";
import assert from "node:assert/strict";
import { canPublish, canTransitionReview } from "../src/lib/reputation.ts";

test("canPublish requires permission", () => {
  assert.equal(canPublish(true), true);
  assert.equal(canPublish(false), false);
});

test("publishing is blocked without permission, allowed with", () => {
  assert.equal(canTransitionReview("approved", "published", false), false);
  assert.equal(canTransitionReview("approved", "published", true), true);
});

test("only legal review transitions are allowed", () => {
  assert.equal(canTransitionReview("draft", "approved", false), true);
  assert.equal(canTransitionReview("approved", "draft", false), true);
  assert.equal(canTransitionReview("published", "archived", false), true);
  // illegal
  assert.equal(canTransitionReview("draft", "published", true), false); // must be approved first
  assert.equal(canTransitionReview("archived", "draft", true), false);
});
