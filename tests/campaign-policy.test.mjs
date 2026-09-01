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
