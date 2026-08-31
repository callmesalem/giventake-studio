import test from "node:test";
import assert from "node:assert/strict";
import { verifyResendSignature } from "../src/server/campaigns/webhook.ts";

const SECRET = "whsec_" + btoa("super-secret-key");
const BODY = JSON.stringify({ type: "email.bounced" });
const ID = "msg_1";

async function signed(body, id, timestamp, secret = SECRET) {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

const NOW = new Date("2026-08-31T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));
const H = (sig, ts = TS, id = ID) => ({ "svix-id": id, "svix-timestamp": ts, "svix-signature": sig });

test("accepts a correctly signed payload", async () => {
  const sig = await signed(BODY, ID, TS);
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H(`v1,${sig}`) }), true);
});

test("accepts when several signatures are offered and one matches", async () => {
  const sig = await signed(BODY, ID, TS);
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H(`v1,bogus v1,${sig}`) }), true);
});

test("rejects a forged signature", async () => {
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H("v1,ZmFrZQ==") }), false);
});

test("rejects a tampered body - the signature covers the payload", async () => {
  const sig = await signed(BODY, ID, TS);
  assert.equal(await verifyResendSignature({
    body: JSON.stringify({ type: "email.delivered" }), secret: SECRET, now: NOW, headers: H(`v1,${sig}`),
  }), false);
});

test("rejects a replayed request outside the tolerance window", async () => {
  const oldTs = String(Math.floor(NOW.getTime() / 1000) - 3600);
  const sig = await signed(BODY, ID, oldTs);
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H(`v1,${sig}`, oldTs) }), false);
});

test("rejects a timestamp from the far future", async () => {
  const futureTs = String(Math.floor(NOW.getTime() / 1000) + 3600);
  const sig = await signed(BODY, ID, futureTs);
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H(`v1,${sig}`, futureTs) }), false);
});

test("rejects missing headers rather than throwing", async () => {
  for (const headers of [{}, { "svix-id": ID }, { "svix-timestamp": TS }]) {
    assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers }), false);
  }
});

test("rejects when no secret is configured - never fail open", async () => {
  const sig = await signed(BODY, ID, TS);
  assert.equal(await verifyResendSignature({ body: BODY, secret: "", now: NOW, headers: H(`v1,${sig}`) }), false);
});

test("rejects a non-numeric timestamp", async () => {
  const sig = await signed(BODY, ID, TS);
  assert.equal(await verifyResendSignature({ body: BODY, secret: SECRET, now: NOW, headers: H(`v1,${sig}`, "not-a-number") }), false);
});
