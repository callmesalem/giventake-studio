import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillTemplate, findUnfilled, finalizeDocument } from "../src/server/documents/templates.ts";

/**
 * Reading the real contracts in a test is a deliberate, small impurity. The
 * inputs that actually matter are the files on disk, and a hand-written
 * fixture is exactly how the previous denylist survived review: every fixture
 * was drawn from the cases the author had already thought of.
 */
const doc = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// --- fillTemplate ---------------------------------------------------------

test("fills a placeholder from the data", () => {
  assert.equal(
    fillTemplate("Client: [CLIENT LEGAL NAME]", { "CLIENT LEGAL NAME": "Acme LLC" }),
    "Client: Acme LLC",
  );
});

test("fills every occurrence, not just the first", () => {
  assert.equal(fillTemplate("[NAME] and [NAME]", { NAME: "Ada" }), "Ada and Ada");
});

test("leaves a placeholder alone when no data is supplied", () => {
  assert.equal(fillTemplate("Fee: [AMOUNT]", {}), "Fee: [AMOUNT]");
});

test("an explicitly-undefined value is NOT supplied — the placeholder stays", () => {
  assert.equal(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: undefined }), "Fee: $[AMOUNT]");
  assert.deepEqual(findUnfilled(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: undefined })), ["AMOUNT"]);
});

test("an empty-string value is NOT supplied — the placeholder stays", () => {
  assert.equal(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: "" }), "Fee: $[AMOUNT]");
});

test("a whitespace-only value is NOT supplied — the placeholder stays", () => {
  assert.equal(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: "   " }), "Fee: $[AMOUNT]");
});

test("a non-string value is NOT supplied — the placeholder stays", () => {
  assert.equal(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: 5000 }), "Fee: $[AMOUNT]");
  assert.equal(fillTemplate("Fee: $[AMOUNT]", { AMOUNT: null }), "Fee: $[AMOUNT]");
});

test("inherited Object properties are not merge values", () => {
  assert.equal(fillTemplate("x [constructor] y", {}), "x [constructor] y");
});

test("benign bracket forms are never substituted, even if data names them", () => {
  const body = "- [ ] task\n> [!NOTE]\nSee [MSA §4.1](../m.md).";
  assert.equal(fillTemplate(body, { " ": "X", "!NOTE": "X", "MSA §4.1": "X" }), body);
});

// --- findUnfilled: the allowlist of benign bracket forms -------------------

test("findUnfilled lists what is still missing", () => {
  assert.deepEqual(findUnfilled("[A NAME] owes [AMOUNT]"), ["A NAME", "AMOUNT"]);
});

test("findUnfilled returns nothing for a fully filled body", () => {
  assert.deepEqual(findUnfilled("all done"), []);
});

test("findUnfilled preserves first-appearance order and deduplicates", () => {
  assert.deepEqual(findUnfilled("[B] [A] [B]"), ["B", "A"]);
});

test("findUnfilled DOES report ordinary bracketed prose — allowlist, not denylist", () => {
  // Previously ignored as "prose". A client cannot tell prose from a blank, so
  // anything bracketed and not on the benign allowlist blocks the send.
  assert.deepEqual(findUnfilled("see clause [4] and [see below]"), ["4", "see below"]);
});

test("real merge fields the SHOUTED regex silently ignored ARE detected", () => {
  assert.deepEqual(findUnfilled("Contact: [NAME, TITLE, EMAIL]"), ["NAME, TITLE, EMAIL"]);
  assert.deepEqual(findUnfilled("Deposit ([50]%)"), ["50"]);
  assert.deepEqual(findUnfilled("Basis: [fixed fee / monthly retainer]"), [
    "fixed fee / monthly retainer",
  ]);
  assert.deepEqual(findUnfilled("[e.g. Responsive marketing site, 6 pages]"), [
    "e.g. Responsive marketing site, 6 pages",
  ]);
  assert.deepEqual(findUnfilled("[description]"), ["description"]);
  assert.deepEqual(findUnfilled("Entity: [GivenTake Devs LLC]"), ["GivenTake Devs LLC"]);
});

test("markdown checkboxes are benign", () => {
  assert.deepEqual(findUnfilled("- [ ] open\n- [x] done\n- [X] done"), []);
});

test("GitHub callouts are benign", () => {
  assert.deepEqual(findUnfilled("> [!WARNING]\n> [!TIP]\n> [!NOTE]\n> [!IMPORTANT]"), []);
});

test("markdown link labels are benign, because the ] is followed by (", () => {
  assert.deepEqual(findUnfilled("See [MSA §4.1](../contracts/msa-template.md)."), []);
  assert.deepEqual(
    findUnfilled("See [`../business/02-ohio-tax.md`](../business/02-ohio-tax.md)."),
    [],
  );
});

test("a bracketed label NOT followed by ( is a field, not a link", () => {
  assert.deepEqual(findUnfilled("See [MSA §4.1] for detail."), ["MSA §4.1"]);
});

test("a bracket spanning a newline is not a candidate", () => {
  assert.deepEqual(findUnfilled("[open\nclose]"), []);
});

// --- checkbox benign form: list position only ------------------------------
//
// A [ ]/[x]/[X] token is benign ONLY when everything before it on the line is
// a markdown list marker. Anywhere else it is a merge field: $[X] for money,
// **Date:** [ ] for a blank to complete, or plain inline text.

test("a checkbox is benign in list position — dash, x, X, ordered, nested", () => {
  assert.deepEqual(findUnfilled("- [ ] item"), []);
  assert.deepEqual(findUnfilled("- [x] item"), []);
  assert.deepEqual(findUnfilled("1. [ ] item"), []);
  assert.deepEqual(findUnfilled("  * [X] item"), []);
});

test("$[X] is a merge field, not a benign checkbox", () => {
  assert.deepEqual(findUnfilled("Deposit $[X] due"), ["X"]);
});

test("a labelled inline blank is a merge field, not a benign checkbox", () => {
  assert.deepEqual(findUnfilled("**Date:** [ ]"), [" "]);
});

test("an inline [ ] mid-sentence, not in list position, is a merge field", () => {
  assert.deepEqual(findUnfilled("text [ ] more"), [" "]);
});

test("the real SOW's $[X] money fields are now reported as unfilled", () => {
  const unfilled = findUnfilled(doc("docs/contracts/sow-template.md"));
  assert.ok(
    unfilled.includes("X"),
    "$[X] deposit/milestone/tax/change-order fields must be reported",
  );
});

test("the real handoff checklist: task-list checkboxes stay benign, inline blanks do not", () => {
  const body = doc("docs/templates/handoff-checklist.md");
  const listCheckboxes = body.match(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/gm) ?? [];
  assert.equal(listCheckboxes.length, 28, "sanity check on the fixture: 28 task-list checkboxes");

  const unfilled = findUnfilled(body);
  assert.deepEqual(unfilled, ["CLIENT", "PROJECT", " "]);
  // The four inline blanks (Date, SOW, Handed off by, Client confirmation
  // received) all have the same inner text " " and so dedupe to one entry —
  // this is exactly the "templates need distinct field names" problem noted
  // in templates.ts and is separately-tracked template work.
});

// --- the two independent review guards ------------------------------------

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

test("review markers with trailing text, padding or lowercase all refuse", () => {
  for (const marker of [
    "[REVIEW with CPA]",
    "[ REVIEW]",
    "[review]",
    "[Review — ask counsel]",
    "[REVIEW]",
  ]) {
    const r = finalizeDocument(`Tax treatment ${marker} applies.`, {});
    assert.equal(r.ok, false, `${marker} should refuse`);
    assert.equal(r.ok === false && r.reason, "unresolved-review", `${marker} reason`);
  }
});

test("a homoglyph review marker still refuses — as an unfilled placeholder", () => {
  // Cyrillic Е (U+0415) defeats any ASCII marker match. The broad candidate
  // rule is the second net: it is a bracket, so it is a field, so it blocks.
  const r = finalizeDocument("Indemnity [RЕVIEW] applies.", {});
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
});

test("the draft banner alone refuses, independently of any marker", () => {
  const r = finalizeDocument(
    "> **DRAFT — NOT FOR USE WITHOUT ATTORNEY REVIEW.**\n\nAll clear.",
    {},
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("the draft banner refuses case-insensitively", () => {
  const r = finalizeDocument("not for use without attorney review", {});
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

// --- the real files on disk -----------------------------------------------

test("finalize REFUSES the real SOW even with every detected field supplied", () => {
  const body = doc("docs/contracts/sow-template.md");
  const data = {};
  for (const key of findUnfilled(body)) data[key] = "FILLED";
  const r = finalizeDocument(body, data);
  assert.equal(r.ok, false, "the real SOW must never finalize while it is un-reviewed");
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("the real SOW trips BOTH review guards independently", () => {
  const body = doc("docs/contracts/sow-template.md");
  assert.match(body, /NOT FOR USE WITHOUT ATTORNEY REVIEW/i);
  assert.match(body, /\[\s*REVIEW\b[^\]]*\]/i);
});

test("finalize REFUSES the real MSA", () => {
  const body = doc("docs/contracts/msa-template.md");
  const data = {};
  for (const key of findUnfilled(body)) data[key] = "FILLED";
  const r = finalizeDocument(body, data);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("the real SOW's genuine blanks are detected, not silently ignored", () => {
  const unfilled = findUnfilled(doc("docs/contracts/sow-template.md"));
  for (const key of [
    "NAME, TITLE, EMAIL",
    "50",
    "fixed fee / monthly retainer",
    "GivenTake Devs LLC",
    "CLIENT LEGAL NAME",
    "description",
    "e.g. Responsive marketing site, 6 pages",
  ]) {
    assert.ok(unfilled.includes(key), `[${key}] must be reported as unfilled`);
  }
});

test("the real handoff checklist is NOT blocked by its checkboxes or links, but IS blocked by its inline blanks", () => {
  // Was ["CLIENT", "PROJECT"]. The task-list checkboxes and MSA links are
  // still benign, but the four inline `[ ]` sign-off blanks on lines 3 and
  // 66 (Date, SOW, Handed off by, Client confirmation received) are real,
  // un-named blanks and must now be reported too — see the narrowed rule in
  // src/server/documents/templates.ts.
  const body = doc("docs/templates/handoff-checklist.md");
  assert.deepEqual(findUnfilled(body), ["CLIENT", "PROJECT", " "]);
});

test("the real handoff checklist no longer finalizes on its two named fields alone — its inline blanks are genuinely unfilled", () => {
  // Previously finalized ok:true once CLIENT and PROJECT were supplied. That
  // was the fail-open: the checklist's four inline sign-off blanks (Date,
  // SOW, Handed off by, Client confirmation received) were being swallowed
  // as "checkboxes" and shipped un-filled. Correct behaviour is refusal,
  // naming what is still missing. Giving the blanks distinct field names is
  // separately-tracked template work, not something to fix by widening the
  // benign rule back out.
  const body = doc("docs/templates/handoff-checklist.md");
  const r = finalizeDocument(body, { CLIENT: "Acme LLC", PROJECT: "Website rebuild" });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
  assert.deepEqual(r.ok === false && r.placeholders, [" "]);
});

test("the real delivery review checklist is not blocked by its checkboxes, but IS blocked by its inline blanks", () => {
  // Was ["CLIENT", "RELEASE"]. Reviewed by / Date / Commit / Licence scan
  // result / Cleared to ship / Signature are inline `[ ]` blanks, not
  // checkboxes, and must be reported.
  const body = doc("docs/templates/delivery-review-checklist.md");
  assert.deepEqual(findUnfilled(body), ["CLIENT", "RELEASE", " "]);
});
