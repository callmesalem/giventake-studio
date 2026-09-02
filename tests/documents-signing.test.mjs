import test from "node:test";
import assert from "node:assert/strict";
import { canSign, validateSignatureInput } from "../src/server/documents/signing.ts";

const base = { status: "pending", expiresAt: "2999-01-01T00:00:00Z" };
const now = new Date("2026-09-02T00:00:00Z");

test("a pending, unexpired request may be signed", () => {
  assert.equal(canSign(base, now).ok, true);
});

test("an expired request may not be signed", () => {
  const r = canSign({ status: "pending", expiresAt: "2026-09-01T00:00:00Z" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "expired");
});

test("an already-signed request may not be signed twice", () => {
  const r = canSign({ ...base, status: "signed" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "already-signed");
});

test("a declined request may not be signed", () => {
  const r = canSign({ ...base, status: "declined" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "declined");
});

test("a viewed request may still be signed", () => {
  assert.equal(canSign({ ...base, status: "viewed" }, now).ok, true);
});

test("signing requires consent", () => {
  const r = validateSignatureInput({ typedName: "Ada Lovelace", consent: false });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-consent");
});

test("signing requires a non-empty typed name", () => {
  const r = validateSignatureInput({ typedName: "   ", consent: true });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-name");
});

test("a valid input is accepted and the name is trimmed", () => {
  const r = validateSignatureInput({ typedName: "  Ada Lovelace  ", consent: true });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.typedName, "Ada Lovelace");
});
