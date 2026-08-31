import test from "node:test";
import assert from "node:assert/strict";
import { extractReferencedMessageIds } from "../src/server/campaigns/reply.ts";

test("reads In-Reply-To", () => {
  assert.deepEqual(extractReferencedMessageIds({ "in-reply-to": "<abc@resend>" }), ["abc@resend"]);
});

test("reads every id in References", () => {
  assert.deepEqual(extractReferencedMessageIds({ references: "<a@x> <b@x>" }), ["a@x", "b@x"]);
});

test("merges both headers without duplicates", () => {
  const ids = extractReferencedMessageIds({ "in-reply-to": "<b@x>", references: "<a@x> <b@x>" });
  assert.deepEqual(ids.sort(), ["a@x", "b@x"]);
});

test("header names are case-insensitive", () => {
  assert.deepEqual(extractReferencedMessageIds({ "In-Reply-To": "<abc@x>" }), ["abc@x"]);
});

test("mail with no threading headers yields nothing", () => {
  assert.deepEqual(extractReferencedMessageIds({ subject: "hi" }), []);
});

test("ignores malformed bracket content rather than throwing", () => {
  assert.deepEqual(extractReferencedMessageIds({ references: "not-bracketed" }), []);
});

test("tolerates undefined header values", () => {
  assert.deepEqual(extractReferencedMessageIds({ references: undefined }), []);
});
