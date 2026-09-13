// The approvals route's payload rendering, asserted against the route source.
//
// Same pattern as tests/compliance-tracking.test.mjs, and for the same reason:
// there is no DOM harness for routes in this repo, and what is being protected
// is a CLAIM the page makes to an operator. The fallback branch says "the CRM
// cannot carry this out yet" - true of send_email, false of demo_site the
// moment the Phase 2 handler lands. An Approve button that queues a public
// website, sitting under a sentence promising it will not, is the regression
// this file exists to catch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/crm.approvals.tsx", import.meta.url), "utf8");

test("demo_site has its own branch and no longer falls through to the fallback", () => {
  assert.match(route, /action_type === "demo_site"/);
});

test("the demo_site branch shows the facts being approved", () => {
  // Spec section 3: business name, address, and the record it attaches to.
  // Pin the rendered expression to catch if the render line is deleted.
  assert.match(route, /businessName \|\| "No business name given"/);
  assert.match(route, /payload\?\.address/);
});

test("the demo_site branch restates the gates that approval does not skip", () => {
  // The deal_close branch carries the equivalent line about a signed SOW. An
  // operator should never be able to read this card and believe approving is
  // what makes the deployment permitted.
  assert.match(route, /Approving does not skip them/);
});
