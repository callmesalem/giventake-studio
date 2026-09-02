import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/server/documents/hash.ts";

test("hashes a known string to its known sha-256", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("the same input always hashes the same", async () => {
  assert.equal(await sha256Hex("Statement of Work"), await sha256Hex("Statement of Work"));
});

test("a one-character change changes the hash", async () => {
  assert.notEqual(await sha256Hex("fee: $5,000"), await sha256Hex("fee: $6,000"));
});

test("hashes empty string without throwing", async () => {
  assert.equal((await sha256Hex("")).length, 64);
});
