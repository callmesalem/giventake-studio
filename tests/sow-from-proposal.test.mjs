import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyProposalToSow } from "../src/lib/sow-from-proposal.ts";

const template = readFileSync("docs/contracts/sow-template.md", "utf8").replace(/\r\n/g, "\n");
const line = (name, cents, extra = {}) => ({
  item_key: null,
  name,
  description: "",
  quantity: 1,
  unit: "each",
  unit_price_cents: cents,
  recurring: false,
  price_is_from: false,
  includes: [],
  excludes: [],
  internal_hours: null,
  needs_discovery: false,
  discount_reason: null,
  ...extra,
});
const p = {
  summary: "A roofer who needs more calls from phone searches.",
  timeline: "3–4 weeks",
  option: "milestones",
  lines: [
    line("Contractor website", 199900, { includes: ["Tap-to-call"], excludes: ["Paid ads"] }),
    line("Town page", 9900, { quantity: 3, unit: "town" }),
    line("Care plan", 9900, { recurring: true, unit: "month" }),
  ],
};
const section = (md, n, next) =>
  md.split(new RegExp(`\n## ${n}\. [^\n]*\n`))[1].split(`\n## ${next}.`)[0];

test("section 1 becomes the summary", () => {
  const s1 = section(applyProposalToSow(template, p), 1, 2);
  assert.match(s1, /A roofer who needs more calls/);
  assert.doesNotMatch(s1, /Two or three sentences/);
});

test("deliverables list every one-time line with includes, keep the standing list", () => {
  const s3 = section(applyProposalToSow(template, p), 3, 4);
  assert.match(s3, /Contractor website \(Tap-to-call\)/);
  assert.match(s3, /Town page × 3/);
  assert.doesNotMatch(s3, /Care plan/);
  assert.match(s3, /Source code and repository access/);
});

test("out of scope lists excludes and keeps the catch-all", () => {
  const s4 = section(applyProposalToSow(template, p), 4, 5);
  assert.match(s4, /- Paid ads/);
  assert.match(s4, /Anything not expressly listed/);
  assert.doesNotMatch(s4, /\[e\.g\./);
});

test("timeline line is added to section 6", () => {
  assert.match(
    section(applyProposalToSow(template, p), 6, 7),
    /Estimated overall timeline:\*\* 3–4 weeks/,
  );
});

test("fees show the total and the 50/25/25 amounts", () => {
  const s7 = applyProposalToSow(template, p).split("## 7. Fees and payment schedule")[1];
  assert.match(s7, /\$2,296/); // 1,999 + 3 × 99
  assert.match(s7, /\$1,148/);
  assert.match(s7, /\$574/);
  assert.match(s7, /Care plan \$99\/mo/);
  assert.doesNotMatch(s7.split("**Tax treatment")[0], /\$\[X\]/);
});

test("own-it fees show 12 x $149 and stay flagged for attorney review", () => {
  const s7 = applyProposalToSow(template, {
    ...p,
    option: "own_it",
    lines: [line("Standard website", 99900)],
  }).split("## 7. Fees and payment schedule")[1];
  assert.match(s7, /12 monthly payments of \$149/);
  assert.match(s7, /\[REVIEW with attorney/);
});

test("sections 2, 5 and 8 are untouched", () => {
  const out = applyProposalToSow(template, p);
  assert.equal(section(out, 2, 3), section(template, 2, 3));
  assert.equal(section(out, 5, 6), section(template, 5, 6));
  assert.equal(section(out, 8, 9), section(template, 8, 9));
});
