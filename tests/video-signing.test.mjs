import assert from "node:assert/strict";
import { signPayload, verifySigned, MAX_SKEW_MS } from "../src/server/video/signing.ts";

const SECRET = "test-secret-value";
const NOW = 1_760_000_000_000;
const payload = { job_id: "j1", kind: "scene_clip", scene_index: 0 };

// A signature verifies against the same inputs.
const ts = String(NOW);
const nonce = "nonce-1";
const sig = signPayload(SECRET, ts, nonce, payload);
assert.equal(
  verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: sig, now: NOW }).ok,
  true,
);

// Key order must not change the signature.
const reordered = { scene_index: 0, kind: "scene_clip", job_id: "j1" };
assert.equal(signPayload(SECRET, ts, nonce, reordered), sig, "canonical payload must sort keys");

// A tampered payload fails.
const tampered = verifySigned({
  secret: SECRET,
  timestamp: ts,
  nonce,
  payload: { ...payload, scene_index: 1 },
  signature: sig,
  now: NOW,
});
assert.equal(tampered.ok, false);
assert.equal(tampered.reason, "signature_mismatch");

// A different secret fails.
assert.equal(
  verifySigned({ secret: "other", timestamp: ts, nonce, payload, signature: sig, now: NOW }).ok,
  false,
);

// A stale timestamp fails, in both directions.
assert.equal(
  verifySigned({
    secret: SECRET,
    timestamp: ts,
    nonce,
    payload,
    signature: sig,
    now: NOW + MAX_SKEW_MS + 1000,
  }).reason,
  "timestamp_skew",
);
assert.equal(
  verifySigned({
    secret: SECRET,
    timestamp: ts,
    nonce,
    payload,
    signature: sig,
    now: NOW - MAX_SKEW_MS - 1000,
  }).reason,
  "timestamp_skew",
);

// A non-numeric timestamp fails rather than throwing.
assert.equal(
  verifySigned({
    secret: SECRET,
    timestamp: "not-a-number",
    nonce,
    payload,
    signature: sig,
    now: NOW,
  }).reason,
  "timestamp_invalid",
);

// A malformed signature fails rather than throwing.
assert.equal(
  verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: "zz", now: NOW }).ok,
  false,
);

// An empty secret is a configuration error, not a soft failure.
assert.throws(() => signPayload("", ts, nonce, payload), /secret/i);

console.log("video-signing: ok");
