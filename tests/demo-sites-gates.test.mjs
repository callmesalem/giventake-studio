// Requesting a demo site queues a PUBLIC WEBSITE to be deployed for a business
// that has not signed anything. That makes it an external action, and the whole
// claim this file tests is: it cannot happen while the charter §10 kill switch
// is off, and it cannot happen twice by accident.
//
// The gate is pure by construction so it can be asserted without a database.
// The server function rebuilds these same gates at submit time from freshly
// read facts (src/lib/demo-sites-data.ts), so what is proved here is what runs.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoSiteGates,
  isDemoSiteRequestable,
  demoSiteInFlight,
  DEMO_SITE_IN_FLIGHT,
} from "../src/lib/crm-guards.ts";

/** A request that should pass everything, so each test can break exactly one
 *  fact and attribute the refusal to it. */
const ok = {
  outboundEnabled: true,
  hasTarget: true,
  businessName: "Trattoria Nino",
  existingStatuses: [],
};

const gate = (gates, id) => gates.find((g) => g.id === id);

test("a clean request passes every gate", () => {
  const gates = buildDemoSiteGates(ok);
  assert.equal(isDemoSiteRequestable(gates), true);
  assert.ok(gates.every((g) => g.pass));
});

test("the kill switch being off refuses the request", () => {
  const gates = buildDemoSiteGates({ ...ok, outboundEnabled: false, outboundReason: "audit" });
  assert.equal(isDemoSiteRequestable(gates), false);
  assert.equal(gate(gates, "kill-switch").pass, false);
  // The reason has to reach the operator; a dead button with no account of
  // itself is what makes people route around gates.
  assert.match(gate(gates, "kill-switch").detail, /audit/);
});

test("an UNREADABLE kill switch refuses too — undefined is not permission", () => {
  // This is the case that matters most. outboundControl() maps a failed read to
  // { outboundEnabled: false }, but the gate must independently refuse anything
  // that is not an explicit true, so a future caller that forgets cannot open it.
  for (const value of [undefined, null, "true", 1]) {
    const gates = buildDemoSiteGates({ ...ok, outboundEnabled: value });
    assert.equal(isDemoSiteRequestable(gates), false, `${String(value)} must not pass`);
  }
});

test("a request attached to neither a company nor a deal is refused", () => {
  const gates = buildDemoSiteGates({ ...ok, hasTarget: false });
  assert.equal(isDemoSiteRequestable(gates), false);
  assert.equal(gate(gates, "target").pass, false);
});

test("a blank or whitespace business name is refused", () => {
  for (const name of ["", "   ", "\t\n"]) {
    const gates = buildDemoSiteGates({ ...ok, businessName: name });
    assert.equal(isDemoSiteRequestable(gates), false);
    assert.equal(gate(gates, "business-name").pass, false);
  }
});

test("a demo already queued or building blocks a second request", () => {
  // The action is external and not idempotent: a second click while the first
  // build runs deploys a second public site, and nothing downstream notices.
  for (const status of DEMO_SITE_IN_FLIGHT) {
    const gates = buildDemoSiteGates({ ...ok, existingStatuses: [status] });
    assert.equal(isDemoSiteRequestable(gates), false, `${status} must block`);
    assert.equal(gate(gates, "no-duplicate").pass, false);
  }
});

test("a live, failed or archived demo does NOT block a rebuild", () => {
  // Deliberate. A demo that exists is a reason a human might want it rebuilt,
  // and a failed build is precisely when a retry is wanted. Refusing either is
  // a judgement this gate has no standing to make.
  for (const status of ["live", "failed", "archived"]) {
    const gates = buildDemoSiteGates({ ...ok, existingStatuses: [status] });
    assert.equal(isDemoSiteRequestable(gates), true, `${status} must not block`);
  }
});

test("every gate is reported, not just the first failure", () => {
  // Being told one reason, fixing it, and discovering a second is how people
  // conclude a system is broken.
  const gates = buildDemoSiteGates({
    outboundEnabled: false,
    hasTarget: false,
    businessName: "",
    existingStatuses: ["building"],
  });
  assert.equal(gates.length, 4);
  assert.ok(gates.every((g) => g.pass === false));
});

test("demoSiteInFlight only counts requested and building", () => {
  assert.equal(demoSiteInFlight("requested"), true);
  assert.equal(demoSiteInFlight("building"), true);
  assert.equal(demoSiteInFlight("live"), false);
  assert.equal(demoSiteInFlight("failed"), false);
  assert.equal(demoSiteInFlight("archived"), false);
  assert.equal(demoSiteInFlight(undefined), false);
});
