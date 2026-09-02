import test from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, findUnfilled } from "../src/server/documents/templates.ts";

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
