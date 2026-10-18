// tests/proposals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_SCOPING,
  lineFromItem,
  scopingSuggestions,
  proposalTotals,
  paymentOptions,
  effectiveRate,
  proposalWarnings,
  formatUsd,
} from "../src/lib/proposals.ts";

const item = (key, cents, extra = {}) => ({
  id: key,
  key,
  name: key,
  description: "",
  category: "addon",
  unit: "each",
  unit_price_cents: cents,
  recurring: false,
  price_is_from: false,
  includes: [],
  excludes: [],
  internal_hours: null,
  archived: false,
  sort_order: 0,
  ...extra,
});
const BOOK = [
  item("site_standard", 99900, { category: "website", internal_hours: 10 }),
  item("site_contractor", 199900, { category: "website", internal_hours: 18 }),
  item("extra_page", 14900, { unit: "page" }),
  item("town_page", 9900, { unit: "town" }),
  item("copywriting", 14900, { unit: "page" }),
  item("quote_form", 19900),
  item("booking_embed", 24900),
  item("online_payments", 39900),
  item("site_replacement", 29900),
  item("gbp_setup", 19900),
  item("blog_setup", 29900, { archived: true }),
  item("automation_audit", 74900, { category: "automation" }),
  item("hosting", 4900, { category: "monthly", unit: "month", recurring: true }),
  item("care_plan", 9900, { category: "monthly", unit: "month", recurring: true }),
];
const keys = (r) => r.lines.map((l) => `${l.item_key ?? "custom"}x${l.quantity}`);

test("empty answers suggest only the standard site", () => {
  assert.deepEqual(keys(scopingSuggestions(EMPTY_SCOPING, BOOK)), ["site_standardx1"]);
});

test("a contractor with towns, copy and care gets the matching lines", () => {
  const r = scopingSuggestions(
    {
      ...EMPTY_SCOPING,
      trade: true,
      extraPages: 2,
      townPages: 3,
      copywriting: "us",
      afterLaunch: "care",
    },
    BOOK,
  );
  assert.deepEqual(keys(r), [
    "site_contractorx1",
    "extra_pagex2",
    "town_pagex3",
    "copywritingx7",
    "care_planx1",
  ]);
});

test("zero or junk quantities add no line (Review Focus 1)", () => {
  assert.deepEqual(
    keys(scopingSuggestions({ ...EMPTY_SCOPING, extraPages: 0, townPages: -2 }, BOOK)),
    ["site_standardx1"],
  );
  assert.deepEqual(keys(scopingSuggestions({ ...EMPTY_SCOPING, extraPages: Number.NaN }, BOOK)), [
    "site_standardx1",
  ]);
});

test("quote form is suggested only for standard sites", () => {
  assert.ok(
    keys(scopingSuggestions({ ...EMPTY_SCOPING, quoteForm: true }, BOOK)).includes("quote_formx1"),
  );
  assert.ok(
    !keys(scopingSuggestions({ ...EMPTY_SCOPING, trade: true, quoteForm: true }, BOOK)).includes(
      "quote_formx1",
    ),
  );
});

test("full booking system becomes a needs-discovery custom line", () => {
  const custom = scopingSuggestions({ ...EMPTY_SCOPING, booking: "system" }, BOOK).lines.find(
    (l) => l.item_key === null,
  );
  assert.equal(custom.needs_discovery, true);
  assert.equal(custom.unit_price_cents, 0);
});

test("archived or missing items are skipped and reported", () => {
  const r = scopingSuggestions({ ...EMPTY_SCOPING, blog: true }, BOOK);
  assert.ok(!keys(r).includes("blog_setupx1"));
  assert.deepEqual(r.skipped, ["blog_setup"]);
});

test("lineFromItem snapshots the item", () => {
  const l = lineFromItem(BOOK[0], 1);
  assert.equal(l.item_key, "site_standard");
  assert.equal(l.unit_price_cents, 99900);
  assert.equal(l.internal_hours, 10);
});

test("totals split one-time and monthly, discounts reduce, clamp at zero (Review Focus 2)", () => {
  const discount = {
    ...lineFromItem(BOOK[0], 1),
    item_key: null,
    unit_price_cents: -20000,
    internal_hours: null,
    discount_reason: "Intro",
  };
  assert.deepEqual(
    proposalTotals([
      lineFromItem(BOOK[0], 1),
      lineFromItem(BOOK[2], 2),
      lineFromItem(BOOK[13], 1),
      discount,
    ]),
    { oneTimeCents: 99900 + 29800 - 20000, monthlyCents: 9900 },
  );
  assert.equal(
    proposalTotals([lineFromItem(BOOK[0], 1), { ...discount, unit_price_cents: -500000 }])
      .oneTimeCents,
    0,
  );
});

test("payment options: own-it only at or below $1,788", () => {
  assert.deepEqual(
    paymentOptions({ oneTimeCents: 178800, monthlyCents: 0 }).map((o) => o.key),
    ["full", "milestones", "own_it"],
  );
  assert.deepEqual(
    paymentOptions({ oneTimeCents: 178900, monthlyCents: 0 }).map((o) => o.key),
    ["full", "milestones"],
  );
});

test("milestones split 50/25/25 and the last absorbs rounding", () => {
  const m = paymentOptions({ oneTimeCents: 99900, monthlyCents: 0 }).find(
    (o) => o.key === "milestones",
  );
  assert.deepEqual(
    m.schedule.map((s) => s.amountCents),
    [49950, 24975, 24975],
  );
  const odd = paymentOptions({ oneTimeCents: 100001, monthlyCents: 0 }).find(
    (o) => o.key === "milestones",
  );
  assert.equal(
    odd.schedule.reduce((a, s) => a + s.amountCents, 0),
    100001,
  );
});

test("own-it is always 12 x $149", () => {
  const o = paymentOptions({ oneTimeCents: 99900, monthlyCents: 0 }).find(
    (x) => x.key === "own_it",
  );
  assert.equal(o.schedule.length, 1);
  assert.equal(o.schedule[0].amountCents, 14900);
});

test("effective rate needs hours on every one-time line", () => {
  assert.deepEqual(effectiveRate([lineFromItem(BOOK[0], 1)]), { hours: 10, rateCents: 9990 });
  assert.equal(effectiveRate([lineFromItem(BOOK[0], 1), lineFromItem(BOOK[2], 1)]), null);
});

test("warnings: no lines, under minimum, needs discovery", () => {
  assert.deepEqual(proposalWarnings([]), ["Add at least one line."]);
  assert.ok(proposalWarnings([lineFromItem(BOOK[2], 1)]).some((x) => x.includes("$999")));
  const r = scopingSuggestions({ ...EMPTY_SCOPING, booking: "system" }, BOOK);
  assert.ok(proposalWarnings(r.lines).some((x) => x.includes("quote after discovery")));
});

test("formatUsd drops zero cents", () => {
  assert.equal(formatUsd(99900), "$999");
  assert.equal(formatUsd(49950), "$499.50");
});
