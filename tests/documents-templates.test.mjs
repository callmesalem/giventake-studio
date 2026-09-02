import test from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, findUnfilled, finalizeDocument } from "../src/server/documents/templates.ts";

test("fills a placeholder from the data", () => {
  assert.equal(fillTemplate("Client: [CLIENT LEGAL NAME]", { "CLIENT LEGAL NAME": "Acme LLC" }), "Client: Acme LLC");
});

test("fills every occurrence, not just the first", () => {
  assert.equal(fillTemplate("[NAME] and [NAME]", { NAME: "Ada" }), "Ada and Ada");
});

test("leaves a placeholder alone when no data is supplied", () => {
  assert.equal(fillTemplate("Fee: [AMOUNT]", {}), "Fee: [AMOUNT]");
});

test("findUnfilled lists what is still missing", () => {
  assert.deepEqual(findUnfilled("[A NAME] owes [AMOUNT]"), ["A NAME", "AMOUNT"]);
});

test("findUnfilled returns nothing for a fully filled body", () => {
  assert.deepEqual(findUnfilled("all done"), []);
});

test("findUnfilled does not report ordinary bracketed prose", () => {
  assert.deepEqual(findUnfilled("see clause [4] and [see below]"), []);
});

test("finalize returns the filled body when everything resolves", () => {
  const r = finalizeDocument("Client: [CLIENT LEGAL NAME]", { "CLIENT LEGAL NAME": "Acme LLC" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.body, "Client: Acme LLC");
});

test("finalize REFUSES a body still carrying [REVIEW]", () => {
  const r = finalizeDocument("Indemnity [REVIEW] applies.", {});
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("[REVIEW] is refused even if someone supplies data for it", () => {
  const r = finalizeDocument("Indemnity [REVIEW] applies.", { REVIEW: "fine" });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("finalize REFUSES an unfilled placeholder and names it", () => {
  const r = finalizeDocument("Fee: [AMOUNT]", {});
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
  assert.deepEqual(r.ok === false && r.placeholders, ["AMOUNT"]);
});

test("review is reported before unfilled placeholders", () => {
  const r = finalizeDocument("[REVIEW] and [AMOUNT]", {});
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});
