import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex } from "../src/server/documents/hash.ts";

/**
 * node:crypto is imported HERE ONLY. src/ runs on Cloudflare Workers, where it
 * does not exist, so hash.ts stays WebCrypto-only. In the test it is an
 * independent oracle: it lets us pin digests we have not hand-copied from
 * anywhere, which is the only honest way to cover non-ASCII input.
 */
const oracle = (s) => createHash("sha256").update(s, "utf8").digest("hex");

test("hashes a known string to its known sha-256", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("hashes the empty string to the published empty-string vector", async () => {
  assert.equal(
    await sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("agrees with an independent sha-256 on non-ASCII input", async () => {
  // A contract body carries §, em dashes, accents and ≥. If the encoder ever
  // drifted from UTF-8 the digest would silently stop identifying the bytes
  // the signer was shown, and every signature taken would be unverifiable.
  for (const s of [
    "café — §3.1 ≥ 5",
    "Zoë Fürst",
    "李雷 signed on 2026-09-02",
    "é",
    "é",
    "\u{1f512} escrow",
  ]) {
    assert.equal(await sha256Hex(s), oracle(s), `digest mismatch for ${JSON.stringify(s)}`);
  }
});

test("agrees with an independent sha-256 on a whole contract body", async () => {
  const body = [
    "# Statement of Work",
    "",
    "Client: Acme LLC",
    "Fee: $5,000 — due on signature",
    "",
  ].join("\n");
  assert.equal(await sha256Hex(body), oracle(body));
});

test("canonically-equivalent strings are NOT treated as the same bytes", async () => {
  // Precomposed é and e + combining acute look identical to a signer but are
  // different bytes. The hash must distinguish them; it anchors bytes, not
  // glyphs, and nothing here may quietly normalise on the caller's behalf.
  assert.notEqual(await sha256Hex("é"), await sha256Hex("é"));
});

test("always returns 64 lowercase hex characters", async () => {
  for (const s of ["", "abc", "café — §3.1 ≥ 5", "x".repeat(10_000)]) {
    assert.match(await sha256Hex(s), /^[0-9a-f]{64}$/, `bad shape for ${JSON.stringify(s)}`);
  }
});

test("a one-character change changes the hash", async () => {
  assert.notEqual(await sha256Hex("fee: $5,000"), await sha256Hex("fee: $6,000"));
});

test("a trailing whitespace change changes the hash", async () => {
  assert.notEqual(await sha256Hex("Statement of Work"), await sha256Hex("Statement of Work "));
});
