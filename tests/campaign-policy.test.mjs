import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGates } from "../src/server/campaigns/policy.ts";

const store = (over = {}) => ({
  async isSuppressed() {
    return false;
  },
  async isApprovedRecipient() {
    return true;
  },
  ...over,
});

test("allows a suppression-free, approved recipient", async () => {
  const d = await evaluateGates(store(), { email: "a@b.com", sop: "outreach" });
  assert.deepEqual(d, { allow: true });
});

test("refuses a suppressed address", async () => {
  const d = await evaluateGates(
    store({
      async isSuppressed() {
        return true;
      },
    }),
    {
      email: "a@b.com",
      sop: "outreach",
    },
  );
  assert.deepEqual(d, { allow: false, status: "suppressed", reason: "do_not_contact" });
});

test("refuses an address not on the allowlist", async () => {
  const d = await evaluateGates(
    store({
      async isApprovedRecipient() {
        return false;
      },
    }),
    {
      email: "a@b.com",
      sop: "outreach",
    },
  );
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "not_approved" });
});

test("refuses a campaign with no SOP - the gate cannot be evaluated", async () => {
  const d = await evaluateGates(store(), { email: "a@b.com", sop: null });
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "no_sop" });
});

test("refuses an enrollment with no address", async () => {
  const d = await evaluateGates(store(), { email: null, sop: "outreach" });
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "no_address" });
});

test("a throwing suppression check refuses, it does not send", async () => {
  const d = await evaluateGates(
    store({
      async isSuppressed() {
        throw new Error("network");
      },
    }),
    { email: "a@b.com", sop: "outreach" },
  );
  assert.equal(d.allow, false);
});

test("a throwing allowlist check refuses, it does not send", async () => {
  const d = await evaluateGates(
    store({
      async isApprovedRecipient() {
        throw new Error("network");
      },
    }),
    { email: "a@b.com", sop: "outreach" },
  );
  assert.equal(d.allow, false);
});

/* ── Two audiences ──────────────────────────────────────────────────────── */

test("an opt_in campaign sends on recorded consent with no allowlist lookup", async () => {
  let askedAllowlist = false;
  const d = await evaluateGates(
    store({
      async isApprovedRecipient() {
        askedAllowlist = true;
        return false;
      },
    }),
    { email: "a@b.com", sop: null, audienceKind: "opt_in", consentGiven: true },
  );
  assert.deepEqual(d, { allow: true });
  assert.equal(askedAllowlist, false);
});

test("an opt_in campaign refuses a lead with no recorded consent", async () => {
  for (const consentGiven of [false, undefined]) {
    const d = await evaluateGates(store(), {
      email: "a@b.com",
      sop: "outreach",
      audienceKind: "opt_in",
      consentGiven,
    });
    assert.deepEqual(d, { allow: false, status: "stopped", reason: "no_consent" });
  }
});

test("do_not_contact wins over consent", async () => {
  const d = await evaluateGates(
    store({
      async isSuppressed() {
        return true;
      },
    }),
    { email: "a@b.com", sop: null, audienceKind: "opt_in", consentGiven: true },
  );
  assert.deepEqual(d, { allow: false, status: "suppressed", reason: "do_not_contact" });
});

test("a cold campaign ignores consent and still needs the allowlist", async () => {
  const d = await evaluateGates(
    store({
      async isApprovedRecipient() {
        return false;
      },
    }),
    { email: "a@b.com", sop: "outreach", audienceKind: "cold", consentGiven: true },
  );
  assert.deepEqual(d, { allow: false, status: "stopped", reason: "not_approved" });
});
