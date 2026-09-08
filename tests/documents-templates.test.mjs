import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fillTemplate,
  findUnfilled,
  finalizeDocument,
  hasUnresolvedReview,
} from "../src/server/documents/templates.ts";

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

test("a bracket spanning a newline IS a candidate", () => {
  // This test used to assert the opposite, and asserting it is what kept a
  // finalised contract able to carry blanks. Real merge fields wrap:
  // sow-template.md's §1 background paragraph and its §10 personal-data
  // field are both bracketed runs that cross a line break. Nothing about a
  // line break makes a bracket prose, and a client reading the wrapped text
  // cannot tell it from a blank.
  assert.deepEqual(findUnfilled("[open\nclose]"), ["open\nclose"]);
});

test("the length bound is generous enough for a real acceptance criterion", () => {
  // sow-template.md §5 carries a 200+ character acceptance criterion. The
  // old {1,80} bound dropped it silently, and nothing covered the bound at
  // all — narrowing it to {1,40} used to survive the entire suite.
  const long = "x".repeat(300);
  assert.deepEqual(findUnfilled("[" + long + "]"), [long]);
});

test("the length bound still exists, so a stray bracket cannot swallow a page", () => {
  assert.deepEqual(findUnfilled("[" + "x".repeat(401) + "]"), []);
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

// --- the cleared SOW: what the banner was hiding ---------------------------
//
// Every other real-file test above stops at reason === "unresolved-review".
// The banner short-circuits finalizeDocument before the placeholder pass ever
// runs, so on these files the detector was never exercised on a body a client
// could actually receive. Attorney clearance is precisely the event that
// removes the short-circuit — and it is the worst possible moment to discover
// that a merge field was invisible. These tests simulate that clearance.

/** Strip the DRAFT banner and resolve the [REVIEW …] markers, i.e. the state
 *  the contract is in the moment counsel signs it off. Asserts the simulation
 *  actually cleared, so it can never silently degrade back into a
 *  "unresolved-review" test that proves nothing. */
function attorneyCleared(body) {
  const cleared = body
    .split("\n")
    .filter((line) => !/NOT FOR USE WITHOUT ATTORNEY REVIEW/i.test(line))
    .join("\n")
    .replace(/\[\s*REVIEW\b[^\]]*\]/gi, "confirmed with counsel");
  assert.equal(hasUnresolvedReview(cleared), false, "the clearance simulation must actually clear");
  return cleared;
}

/** The four genuine merge fields the {1,80}/no-newline candidate pattern could
 *  not see. Matched by prefix rather than by exact text so the test does not
 *  break on a rewrap of the template. */
const SOW_PROSE_BLANKS = [
  ["§1 Background and objective", /^Two or three sentences: what the Client does\b/],
  ["§5 acceptance criteria, Deliverable 1", /^Objective, testable\. e\.g\. "All 6 pages render/],
  ["§5 acceptance criteria, Deliverable 2", /^e\.g\. "Three named users can log in/],
  ["§10 Personal or regulated data", /^none \/ describe — if yes, a DPA is\b/],
];

test("the cleared SOW's wrapped and long merge fields are detected", () => {
  const unfilled = findUnfilled(attorneyCleared(doc("docs/contracts/sow-template.md")));
  for (const [where, pattern] of SOW_PROSE_BLANKS) {
    assert.ok(
      unfilled.some((key) => pattern.test(key)),
      `${where} is a merge field and must be reported as unfilled`,
    );
  }
});

test("a cleared SOW REFUSES while §1 and both §5 acceptance rows are unfilled", () => {
  // The reproduction: clear the review, fill every OTHER field the detector
  // reports, and the document still must not finalize. Before the candidate
  // pattern was widened this returned ok:true on a contract that still said
  // [Objective, testable…] in the table the template itself calls the standard
  // against which material defects are assessed.
  const body = attorneyCleared(doc("docs/contracts/sow-template.md"));
  const data = {};
  for (const key of findUnfilled(body)) {
    if (SOW_PROSE_BLANKS.some(([, pattern]) => pattern.test(key))) continue;
    data[key] = "FILLED";
  }

  const r = finalizeDocument(body, data);
  assert.equal(r.ok, false, "a contract with unfilled acceptance criteria must not finalize");
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
  for (const [where, pattern] of SOW_PROSE_BLANKS) {
    assert.ok(
      r.ok === false && r.placeholders.some((key) => pattern.test(key)),
      `${where} must be named in the refusal`,
    );
  }
});

test("a cleared SOW that DOES finalize carries none of its prose blanks", () => {
  // The other half: once every field findUnfilled reports is supplied, the
  // finalised body must contain no leftover blank at all. Asserted against the
  // literal prose rather than against findUnfilled, so the check is
  // independent of the candidate pattern it is testing.
  const body = attorneyCleared(doc("docs/contracts/sow-template.md"));
  const data = {};
  for (const key of findUnfilled(body)) data[key] = "FILLED";

  const r = finalizeDocument(body, data);
  assert.equal(r.ok, true, "a fully supplied, cleared SOW should finalize");
  for (const prose of [
    "Two or three sentences",
    "Objective, testable",
    "Three named users can log in",
    "a DPA is",
  ]) {
    assert.ok(
      r.ok && !r.body.includes(prose),
      `a finalised contract must not still carry the blank "${prose}"`,
    );
  }
});

/** An independent, deliberately dumb sweep for anything still bracketed in a
 *  finalised body. It does NOT share findUnfilled's candidate pattern — that
 *  is the point: asserting "no blanks remain" with the same regex that decides
 *  what a blank is proves nothing, which is how the {1,80} bound went
 *  unnoticed. Only the three rendered-as-something-else forms are excused. */
function leftoverBlanks(body) {
  const out = [];
  for (const m of body.matchAll(/\[([^\]]*)\]/gs)) {
    const inner = m[1];
    const end = (m.index ?? 0) + m[0].length;
    if (/^![A-Z]+$/.test(inner)) continue; // GitHub callout
    if (body[end] === "(") continue; // markdown link label
    if (/^[ xX]$/.test(inner)) continue; // task-list checkbox
    out.push(inner);
  }
  return out;
}

test("a fully supplied, cleared SOW leaves nothing bracketed behind", () => {
  const body = attorneyCleared(doc("docs/contracts/sow-template.md"));
  const data = {};
  for (const key of findUnfilled(body)) data[key] = "FILLED";

  const r = finalizeDocument(body, data);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && leftoverBlanks(r.body), []);
});

test("a fully supplied, cleared MSA leaves nothing bracketed behind", () => {
  // The same clearance applied to the other contract, as a guard that widening
  // the candidate pattern covers the MSA too and did not swallow anything.
  const body = attorneyCleared(doc("docs/contracts/msa-template.md"));
  const data = {};
  for (const key of findUnfilled(body)) data[key] = "FILLED";

  const r = finalizeDocument(body, data);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && leftoverBlanks(r.body), []);
});

test("every other contract and template still behaves after the widening", () => {
  // The widened candidate pattern must not start swallowing markdown that is
  // not a blank. These expectations are the pre-widening behaviour of the
  // files on disk, pinned so a future change to the pattern has to justify
  // itself against every real document rather than against two of them.
  const expected = {
    "docs/contracts/ai-use-disclosure.md": [],
    "docs/contracts/README.md": ["BRACKETED"],
    "docs/contracts/subprocessor-list.md": [
      "DATE",
      "Email provider",
      "status",
      "Invoicing / payments",
      "Bookkeeping",
    ],
    "docs/templates/customer-1-weekly-report.md": [],
    "docs/templates/delivery-review-checklist.md": ["CLIENT", "RELEASE", " "],
    "docs/templates/discovery-notes.md": [
      "CLIENT",
      " ",
      "B1–B5",
      "C1–C5",
      "none / describe",
      "date",
    ],
    "docs/templates/handoff-checklist.md": ["CLIENT", "PROJECT", " "],
    "docs/templates/README.md": [],
    "docs/templates/weekly-update.md": [
      "CLIENT",
      "N",
      "TOTAL",
      "DATE",
      "link or scheduled time",
      " ",
    ],
  };
  for (const [path, fields] of Object.entries(expected)) {
    assert.deepEqual(findUnfilled(doc(path)), fields, path);
  }
});

test("the delivery review checklist's 29 task-list checkboxes stay benign", () => {
  const body = doc("docs/templates/delivery-review-checklist.md");
  const listCheckboxes = body.match(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/gm) ?? [];
  assert.equal(listCheckboxes.length, 29, "sanity check on the fixture: 29 task-list checkboxes");
  assert.deepEqual(findUnfilled(body), ["CLIENT", "RELEASE", " "]);
});
