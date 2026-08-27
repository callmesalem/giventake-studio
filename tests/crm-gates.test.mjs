import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSIGNABLE,
  canAssign,
  buildGates,
  isSendable,
  conversionKey,
  isLeadOrigin,
} from "../src/lib/crm-guards.ts";

/* ── assignment allowlist ───────────────────────────────────────────────────
 * Without this list a table name reaching the assign method would be an
 * arbitrary-table write primitive holding the service role key.
 */
test("canAssign permits exactly the declared pairs", () => {
  assert.equal(canAssign("leads", "owner_id"), true);
  assert.equal(canAssign("leads", "assigned_to"), true);
  assert.equal(canAssign("companies", "owner_id"), true);
});

test("canAssign refuses a column the table does not declare", () => {
  // companies has no assignee - only leads, deals and tasks do.
  assert.equal(canAssign("companies", "assigned_to"), false);
  assert.equal(canAssign("notes", "assigned_to"), false);
});

test("canAssign refuses tables that are not on the list at all", () => {
  for (const table of [
    "approval_queue",
    "do_not_contact",
    "approved_recipients",
    "operator_system_control",
    "agent_log",
    "auth.users",
    "users",
  ]) {
    assert.equal(canAssign(table, "owner_id"), false, `must refuse ${table}`);
  }
});

test("canAssign refuses columns that would escalate rather than assign", () => {
  for (const column of [
    "id",
    "synthetic",
    "consent_given",
    "status",
    "stage",
    "amount_cents",
    "ai_processing_allowed",
  ]) {
    assert.equal(canAssign("leads", column), false, `must refuse leads.${column}`);
  }
});

test("canAssign is not fooled by prototype keys", () => {
  // A plain `ASSIGNABLE[table]` lookup would return a function for these.
  for (const table of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(canAssign(table, "owner_id"), false, `must refuse ${table}`);
  }
});

test("canAssign refuses non-string input", () => {
  for (const value of [null, undefined, 1, {}, [], true]) {
    assert.equal(canAssign(value, "owner_id"), false);
    assert.equal(canAssign("leads", value), false);
  }
});

test("every allowlisted column is an ownership column", () => {
  // A guard against someone widening this list to something that is not
  // assignment at all.
  for (const [table, columns] of Object.entries(ASSIGNABLE)) {
    for (const column of columns) {
      assert.match(column, /^(owner_id|assigned_to)$/, `${table}.${column} is not ownership`);
    }
  }
});

/* ── send gates ─────────────────────────────────────────────────────────── */
const allClear = {
  outboundEnabled: true,
  suppressed: false,
  approvedRecipient: true,
  sop: "02-sales-pipeline",
  hasFooter: true,
  hasPostal: true,
};

test("all five gates are always reported, never short-circuited", () => {
  // Being told one reason, fixing it and discovering a second is how people
  // conclude a system is broken.
  const gates = buildGates({ ...allClear, outboundEnabled: false, suppressed: true });
  assert.equal(gates.length, 5);
  assert.deepEqual(
    gates.map((g) => g.id),
    ["kill-switch", "suppression", "approved-recipient", "footer", "postal"],
  );
});

test("sendable only when every blocking gate passes", () => {
  assert.equal(isSendable(buildGates(allClear)), true);
  for (const key of ["suppressed", "approvedRecipient", "hasFooter", "hasPostal"]) {
    const broken = { ...allClear, [key]: key === "suppressed" ? true : false };
    assert.equal(isSendable(buildGates(broken)), false, `${key} must block`);
  }
});

test("the kill switch fails closed for anything that is not exactly true", () => {
  // Unreadable, absent or malformed control must never read as permission.
  for (const value of [false, undefined, null, 0, "", "true", 1, {}]) {
    const gates = buildGates({ ...allClear, outboundEnabled: value });
    const killSwitch = gates.find((g) => g.id === "kill-switch");
    assert.equal(killSwitch.pass, false, `outboundEnabled=${JSON.stringify(value)} must not pass`);
    assert.equal(isSendable(gates), false);
  }
});

test("the kill switch quotes its reason when it has one", () => {
  const gates = buildGates({
    ...allClear,
    outboundEnabled: false,
    outboundReason: "disabled by default",
  });
  assert.match(gates[0].detail, /disabled by default/);
});

test("a blocked gate explains what to do, not just that it failed", () => {
  const gates = buildGates({
    ...allClear,
    approvedRecipient: false,
    hasFooter: false,
    hasPostal: false,
  });
  const byId = Object.fromEntries(gates.map((g) => [g.id, g]));
  assert.match(byId["approved-recipient"].detail, /3\.8|absence is a no/i);
  assert.match(byId.footer.detail, /§5|requires it exactly/i);
  assert.match(byId.postal.detail, /CAN-SPAM|Form 610/i);
});

test("the SOP appears in the approved-recipient detail either way", () => {
  const named = buildGates({ ...allClear, sop: "07-referral" });
  assert.match(named.find((g) => g.id === "approved-recipient").detail, /07-referral/);
  const denied = buildGates({ ...allClear, sop: "07-referral", approvedRecipient: false });
  assert.match(denied.find((g) => g.id === "approved-recipient").detail, /07-referral/);
});

test("every gate is blocking - none of them is advisory", () => {
  for (const gate of buildGates(allClear)) {
    assert.equal(gate.blocking, true, `${gate.id} must block`);
  }
});

/* ── conversion identity and lead origin ────────────────────────────────── */
test("conversionKey is stable for the same lead", () => {
  const id = "033947ad-a0e7-44d3-bea1-1f070c54f5e6";
  assert.equal(conversionKey(id), conversionKey(id));
  assert.equal(conversionKey(id), `lead:${id}`);
});

test("conversionKey differs between leads", () => {
  assert.notEqual(conversionKey("a"), conversionKey("b"));
});

test("isLeadOrigin accepts only the three the database allows", () => {
  for (const ok of ["website_contact_form", "manual_entry", "referral_intake"]) {
    assert.equal(isLeadOrigin(ok), true);
  }
  for (const bad of ["manual", "web", "", null, undefined, "MANUAL_ENTRY", "import"]) {
    assert.equal(isLeadOrigin(bad), false, `must reject ${JSON.stringify(bad)}`);
  }
});
