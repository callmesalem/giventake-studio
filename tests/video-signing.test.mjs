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

// A missing secret is reported, never thrown: verifySigned's return type
// promises a result and callers treat a throw as a 500.
assert.equal(
  verifySigned({ secret: "", timestamp: ts, nonce, payload, signature: sig, now: NOW }).reason,
  "secret_missing",
);

// undefined fields must not break verification. The sender signs the object it
// holds; the receiver signs what JSON.parse gives back. Those must agree.
const withUndefined = { job_id: "j1", scene_index: undefined, kind: "scene_clip" };
const roundTripped = JSON.parse(JSON.stringify(withUndefined));
assert.equal(
  signPayload(SECRET, ts, nonce, withUndefined),
  signPayload(SECRET, ts, nonce, roundTripped),
  "an undefined field must not change the signature",
);
assert.equal(
  signPayload(SECRET, ts, nonce, { a: [1, undefined, 3] }),
  signPayload(SECRET, ts, nonce, JSON.parse(JSON.stringify({ a: [1, undefined, 3] }))),
  "undefined array holes must not change the signature",
);

// A bare undefined payload must not crash.
assert.doesNotThrow(() => signPayload(SECRET, ts, nonce, undefined));

// Exactly at the skew boundary is still accepted; one millisecond past is not.
assert.equal(
  verifySigned({
    secret: SECRET,
    timestamp: ts,
    nonce,
    payload,
    signature: sig,
    now: NOW + MAX_SKEW_MS,
  }).ok,
  true,
);
assert.equal(
  verifySigned({
    secret: SECRET,
    timestamp: ts,
    nonce,
    payload,
    signature: sig,
    now: NOW + MAX_SKEW_MS + 1,
  }).reason,
  "timestamp_skew",
);

// Pin the output format. A change of digest or encoding that stayed internally
// consistent would otherwise pass unnoticed.
assert.match(sig, /^[0-9a-f]{64}$/);

console.log("video-signing: ok");
