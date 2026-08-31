import test from "node:test";
import assert from "node:assert/strict";
import { unsubscribeToken, verifyUnsubscribeToken } from "../src/server/campaigns/tokens.ts";

test("a token round-trips to its enrollment id", async () => {
  const t = await unsubscribeToken("e1", "secret");
  assert.equal(await verifyUnsubscribeToken(t, "secret"), "e1");
});

test("a forged signature is rejected", async () => {
  const t = await unsubscribeToken("e1", "secret");
  const forged = `${t.split(".")[0]}.deadbeef`;
  assert.equal(await verifyUnsubscribeToken(forged, "secret"), null);
});

test("a token signed with another secret is rejected", async () => {
  const t = await unsubscribeToken("e1", "secret");
  assert.equal(await verifyUnsubscribeToken(t, "other"), null);
});

test("swapping the payload invalidates the token", async () => {
  const t = await unsubscribeToken("e1", "secret");
  const other = await unsubscribeToken("e2", "secret");
  const spliced = `${other.split(".")[0]}.${t.split(".")[1]}`;
  assert.equal(await verifyUnsubscribeToken(spliced, "secret"), null);
});

test("malformed input is rejected rather than throwing", async () => {
  for (const bad of ["", "nodot", "a.b.c", "..", "!!.??"]) {
    assert.equal(await verifyUnsubscribeToken(bad, "secret"), null);
  }
});

test("an empty secret never verifies - it must not fail open", async () => {
  const t = await unsubscribeToken("e1", "secret");
  assert.equal(await verifyUnsubscribeToken(t, ""), null);
});

test("different enrollments produce different tokens", async () => {
  const a = await unsubscribeToken("e1", "secret");
  const b = await unsubscribeToken("e2", "secret");
  assert.notEqual(a, b);
});
