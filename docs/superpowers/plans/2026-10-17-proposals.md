# Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Price jobs from an editable price book, scope them with a guided questionnaire, send a proposal the client accepts online (or prints as PDF), and hand the accepted proposal to the SOW.

**Architecture:** Pure pricing/scoping logic in `src/lib/proposals.ts` (unit-tested). Three new tables plus `deals.scoping`, all written through `security definer` RPCs that only `service_role` may execute; reads go through `CrmRead` with select grants. CRM screens follow the existing `crm-data.ts` server-function pattern; the public page `/proposal/$code` uses public server functions that take a link code, hash it, and call RPCs.

**Tech Stack:** TanStack Start (React, server functions, file routes), Supabase Postgres (PL/pgSQL RPCs), Node test runner (`node --experimental-strip-types`), Vitest, Prettier/ESLint/tsc.

**Spec:** `docs/superpowers/specs/2026-10-17-proposals-design.md`

## Global Constraints

- Call them **proposals** everywhere (UI, copy, code). Never "quote" in UI text.
- Prices end in 9. Money is integer **cents** (`bigint` in SQL, `number` in TS).
- Own-it plan: $0 down, `14900` cents × `12` months; offered and accepted only when one-time total ≤ `178800` cents.
- 50/25/25: 50% to start, 25% at build review, 25% at launch; last milestone absorbs rounding.
- Proposals valid 30 days after sending by default.
- Accepting a proposal never changes `deals.stage`. Stage 4 still requires a signed SOW.
- Every new RPC: `security definer`, `set search_path = public, pg_temp`, `revoke all … from public, anon, authenticated`, `grant execute … to service_role`. No table write grants to any API role.
- The public page never returns `internal_hours`, `created_by`, or `token_hash`.
- Copy rules: no invented clients, results or statistics.
- Windows dev box: run tools via node, not `node_modules/.bin` shims (they are broken bun wrappers):
  - types: `node node_modules/typescript/bin/tsc --noEmit`
  - unit: `for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || echo "FAIL $t"; done` (bash)
  - one test: `node --experimental-strip-types tests/proposals.test.mjs`
  - components: `node node_modules/vitest/vitest.mjs run --config vitest.config.ts`
  - lint/format: `node node_modules/eslint/bin/eslint.js <files>`, `node node_modules/prettier/bin/prettier.cjs --write <files>`
  - build (regenerates `src/routeTree.gen.ts`): `node node_modules/vite/bin/vite.js build`
  - Postgres integration tests need Docker (not on this machine; CI runs them in the `migrations` job).
- Migrations are applied to prod only after CI's `migrations` job passes, via the Supabase MCP `apply_migration` on project `qsgijpsttojutuhogbns`.

## Review Focus

1. **Quantity 0 or blank in scoping** (e.g. "extra pages: 0") must produce no line, not a zero-priced line. → Task 1 test.
2. **Discount larger than the subtotal** must not produce a negative one-time total; totals clamp at 0 and send is refused. → Task 1 test + Task 4 RPC check.
3. **Opening an expired or superseded link** must show a clear message and must not accept. → Task 4 integration test + Task 8 page states.
4. **A replayed or double Accept** (two tabs, back button) must return the current state, never create a second task or overwrite the chosen option. → Task 4 integration test.
5. **Price-book edits after sending** must not change a sent proposal's lines or totals. → Task 4 integration test (lines are snapshots).

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/proposals.ts` (create) | Types and pure logic: scoping → lines, totals, payment options, effective rate, warnings |
| `tests/proposals.test.mjs` (create) | Unit tests for the above |
| `supabase/migrations/20261017120000_price_book.sql` (create) | `price_book_items`, seed, `price_book_upsert` |
| `supabase/migrations/20261017130000_proposals.sql` (create) | `deals.scoping`, `proposals`, `proposal_lines`, proposal RPCs |
| `tests/crm-grants.integration.test.mjs` (modify) | Grants + behaviour for new RPCs |
| `src/server/crm/read.ts` (modify) | `listPriceBook`, `listProposalsForDeal`, `getProposal`, `listProposalLines`; member policy |
| `src/server/crm/actions.ts` (modify) | RPC wrappers |
| `tests/crm-actions-rpc.test.mjs` (modify) | RPC wire-shape tests |
| `src/lib/crm-data.ts` (modify) | CRM server functions for price book, scoping, proposals; proposals on deal timeline |
| `src/lib/crm-timeline.ts` (modify) | `"proposal"` event kind and `proposalEvents` |
| `tests/proposal-events.test.mjs` (create) | `proposalEvents` test |
| `src/routes/crm.price-book.tsx` (create) | Price book screen |
| `src/routes/crm.tsx` (modify) | Nav link |
| `src/routes/crm.deals.$id.tsx` (modify) | Scope + Proposals cards |
| `src/components/proposal-document.tsx` (create) | Shared client-facing proposal layout + print CSS |
| `src/routes/crm.proposals.$id.tsx` (create) | Builder |
| `src/routes/crm.proposals.$id.preview.tsx` (create) | Staff preview (never marks viewed) |
| `src/lib/proposal-public.ts` (create) | Public server functions (view, decide) |
| `src/routes/proposal.$code.tsx` (create) | Public page |
| `tests/components/proposal-public-route.test.tsx` (create) | Public page states |
| `src/lib/sow-from-proposal.ts` (create) | Rewrite SOW sections from an accepted proposal |
| `tests/sow-from-proposal.test.mjs` (create) | Tests against the real template |
| `src/lib/documents-data.ts`, `src/server/documents/deal-access.ts` (modify) | `generateSowDraft` uses the accepted proposal |

---

### Task 1: Pure proposal logic

**Files:**
- Create: `src/lib/proposals.ts`
- Test: `tests/proposals.test.mjs`

**Interfaces:**
- Produces (used by Tasks 3, 5–9):
  - `type Category = "website" | "addon" | "automation" | "monthly"`, `type Unit = "each" | "page" | "town" | "month"`
  - `interface PriceBookItem { id; key; name; description; category: Category; unit: Unit; unit_price_cents: number; recurring: boolean; price_is_from: boolean; includes: string[]; excludes: string[]; internal_hours: number | null; archived: boolean; sort_order: number }` (all string fields `string`)
  - `interface ProposalLine { item_key: string | null; name: string; description: string; quantity: number; unit: Unit; unit_price_cents: number; recurring: boolean; price_is_from: boolean; includes: string[]; excludes: string[]; internal_hours: number | null; needs_discovery: boolean; discount_reason: string | null }`
  - `interface ScopingAnswers { trade: boolean; replacing: boolean; extraPages: number; townPages: number; copywriting: "client" | "us"; quoteForm: boolean; booking: "none" | "embed" | "system"; payments: boolean; gbpSetUp: boolean; blog: boolean; automation: boolean; afterLaunch: "nothing" | "hosting" | "care" }`
  - `EMPTY_SCOPING`, `lineFromItem(item, quantity)`, `scopingSuggestions(answers, items) → { lines, skipped: string[] }`, `proposalTotals(lines) → { oneTimeCents, monthlyCents }`, `type PaymentOptionKey = "full" | "milestones" | "own_it"`, `interface PaymentOption { key; label; schedule: { label; amountCents; due }[] }`, `paymentOptions(totals) → PaymentOption[]`, `effectiveRate(lines) → { hours, rateCents } | null`, `proposalWarnings(lines) → string[]`, `formatUsd(cents) → string`
  - constants `OWN_IT_MONTHLY_CENTS = 14900`, `OWN_IT_MONTHS = 12`, `OWN_IT_MAX_ONE_TIME_CENTS = 178800`, `MINIMUM_ONE_TIME_CENTS = 99900`

- [ ] **Step 1: Write the failing tests**

```js
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
  id: key, key, name: key, description: "", category: "addon", unit: "each",
  unit_price_cents: cents, recurring: false, price_is_from: false,
  includes: [], excludes: [], internal_hours: null, archived: false, sort_order: 0,
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
    { ...EMPTY_SCOPING, trade: true, extraPages: 2, townPages: 3, copywriting: "us", afterLaunch: "care" },
    BOOK,
  );
  assert.deepEqual(keys(r), ["site_contractorx1", "extra_pagex2", "town_pagex3", "copywritingx7", "care_planx1"]);
});

test("zero or junk quantities add no line (Review Focus 1)", () => {
  assert.deepEqual(keys(scopingSuggestions({ ...EMPTY_SCOPING, extraPages: 0, townPages: -2 }, BOOK)), ["site_standardx1"]);
  assert.deepEqual(keys(scopingSuggestions({ ...EMPTY_SCOPING, extraPages: Number.NaN }, BOOK)), ["site_standardx1"]);
});

test("quote form is suggested only for standard sites", () => {
  assert.ok(keys(scopingSuggestions({ ...EMPTY_SCOPING, quoteForm: true }, BOOK)).includes("quote_formx1"));
  assert.ok(!keys(scopingSuggestions({ ...EMPTY_SCOPING, trade: true, quoteForm: true }, BOOK)).includes("quote_formx1"));
});

test("full booking system becomes a needs-discovery custom line", () => {
  const custom = scopingSuggestions({ ...EMPTY_SCOPING, booking: "system" }, BOOK).lines.find((l) => l.item_key === null);
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
  const discount = { ...lineFromItem(BOOK[0], 1), item_key: null, unit_price_cents: -20000, internal_hours: null, discount_reason: "Intro" };
  assert.deepEqual(
    proposalTotals([lineFromItem(BOOK[0], 1), lineFromItem(BOOK[2], 2), lineFromItem(BOOK[13], 1), discount]),
    { oneTimeCents: 99900 + 29800 - 20000, monthlyCents: 9900 },
  );
  assert.equal(proposalTotals([lineFromItem(BOOK[0], 1), { ...discount, unit_price_cents: -500000 }]).oneTimeCents, 0);
});

test("payment options: own-it only at or below $1,788", () => {
  assert.deepEqual(paymentOptions({ oneTimeCents: 178800, monthlyCents: 0 }).map((o) => o.key), ["full", "milestones", "own_it"]);
  assert.deepEqual(paymentOptions({ oneTimeCents: 178900, monthlyCents: 0 }).map((o) => o.key), ["full", "milestones"]);
});

test("milestones split 50/25/25 and the last absorbs rounding", () => {
  const m = paymentOptions({ oneTimeCents: 99900, monthlyCents: 0 }).find((o) => o.key === "milestones");
  assert.deepEqual(m.schedule.map((s) => s.amountCents), [49950, 24975, 24975]);
  const odd = paymentOptions({ oneTimeCents: 100001, monthlyCents: 0 }).find((o) => o.key === "milestones");
  assert.equal(odd.schedule.reduce((a, s) => a + s.amountCents, 0), 100001);
});

test("own-it is always 12 x $149", () => {
  const o = paymentOptions({ oneTimeCents: 99900, monthlyCents: 0 }).find((x) => x.key === "own_it");
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types tests/proposals.test.mjs`
Expected: FAIL, cannot find module `../src/lib/proposals.ts`.

- [ ] **Step 3: Implement `src/lib/proposals.ts`**

```ts
/**
 * Pricing and scoping for proposals. Pure: no network, no environment, so the
 * rules are testable and the client page and CRM agree on every number.
 * Money is integer cents throughout.
 */

export type Category = "website" | "addon" | "automation" | "monthly";
export type Unit = "each" | "page" | "town" | "month";

export interface PriceBookItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: Category;
  unit: Unit;
  unit_price_cents: number;
  recurring: boolean;
  price_is_from: boolean;
  includes: string[];
  excludes: string[];
  internal_hours: number | null;
  archived: boolean;
  sort_order: number;
}

export interface ProposalLine {
  item_key: string | null;
  name: string;
  description: string;
  quantity: number;
  unit: Unit;
  unit_price_cents: number;
  recurring: boolean;
  price_is_from: boolean;
  includes: string[];
  excludes: string[];
  internal_hours: number | null;
  needs_discovery: boolean;
  discount_reason: string | null;
}

export interface ScopingAnswers {
  trade: boolean;
  replacing: boolean;
  extraPages: number;
  townPages: number;
  copywriting: "client" | "us";
  quoteForm: boolean;
  booking: "none" | "embed" | "system";
  payments: boolean;
  gbpSetUp: boolean;
  blog: boolean;
  automation: boolean;
  afterLaunch: "nothing" | "hosting" | "care";
}

export const EMPTY_SCOPING: ScopingAnswers = {
  trade: false,
  replacing: false,
  extraPages: 0,
  townPages: 0,
  copywriting: "client",
  quoteForm: false,
  booking: "none",
  payments: false,
  gbpSetUp: true,
  blog: false,
  automation: false,
  afterLaunch: "nothing",
};

export const OWN_IT_MONTHLY_CENTS = 14900;
export const OWN_IT_MONTHS = 12;
export const OWN_IT_MAX_ONE_TIME_CENTS = OWN_IT_MONTHLY_CENTS * OWN_IT_MONTHS; // 178800
export const MINIMUM_ONE_TIME_CENTS = 99900;
const INCLUDED_PAGES = 5;

export function lineFromItem(item: PriceBookItem, quantity: number): ProposalLine {
  return {
    item_key: item.key,
    name: item.name,
    description: item.description,
    quantity,
    unit: item.unit,
    unit_price_cents: item.unit_price_cents,
    recurring: item.recurring,
    price_is_from: item.price_is_from,
    includes: [...item.includes],
    excludes: [...item.excludes],
    internal_hours: item.internal_hours,
    needs_discovery: false,
    discount_reason: null,
  };
}

/** Whole, positive counts only; 0, negatives, NaN and blanks add nothing. */
function count(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function scopingSuggestions(
  answers: ScopingAnswers,
  items: PriceBookItem[],
): { lines: ProposalLine[]; skipped: string[] } {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const lines: ProposalLine[] = [];
  const skipped: string[] = [];
  const add = (key: string, quantity: number) => {
    if (quantity <= 0) return;
    const found = byKey.get(key);
    if (!found || found.archived) {
      skipped.push(key);
      return;
    }
    lines.push(lineFromItem(found, quantity));
  };

  const extra = count(answers.extraPages);
  add(answers.trade ? "site_contractor" : "site_standard", 1);
  if (answers.replacing) add("site_replacement", 1);
  add("extra_page", extra);
  add("town_page", count(answers.townPages));
  if (answers.copywriting === "us") add("copywriting", INCLUDED_PAGES + extra);
  if (answers.quoteForm && !answers.trade) add("quote_form", 1);
  if (answers.booking === "embed") add("booking_embed", 1);
  if (answers.booking === "system") {
    lines.push({
      item_key: null,
      name: "Booking and payments system",
      description: "Self-service booking, deposits and reminders, scoped after discovery.",
      quantity: 1,
      unit: "each",
      unit_price_cents: 0,
      recurring: false,
      price_is_from: false,
      includes: [],
      excludes: [],
      internal_hours: null,
      needs_discovery: true,
      discount_reason: null,
    });
  }
  if (answers.payments) add("online_payments", 1);
  if (!answers.gbpSetUp) add("gbp_setup", 1);
  if (answers.blog) add("blog_setup", 1);
  if (answers.automation) add("automation_audit", 1);
  if (answers.afterLaunch === "hosting") add("hosting", 1);
  if (answers.afterLaunch === "care") add("care_plan", 1);
  return { lines, skipped };
}

export function proposalTotals(lines: ProposalLine[]): { oneTimeCents: number; monthlyCents: number } {
  let oneTime = 0;
  let monthly = 0;
  for (const l of lines) {
    const amount = Math.round(l.unit_price_cents * l.quantity);
    if (l.recurring) monthly += amount;
    else oneTime += amount;
  }
  return { oneTimeCents: Math.max(0, oneTime), monthlyCents: Math.max(0, monthly) };
}

export type PaymentOptionKey = "full" | "milestones" | "own_it";

export interface PaymentOption {
  key: PaymentOptionKey;
  label: string;
  schedule: { label: string; amountCents: number; due: string }[];
}

export function paymentOptions(totals: { oneTimeCents: number; monthlyCents: number }): PaymentOption[] {
  const total = totals.oneTimeCents;
  const first = Math.round(total * 0.5);
  const second = Math.round(total * 0.25);
  const options: PaymentOption[] = [
    {
      key: "full",
      label: "Pay in full",
      schedule: [{ label: "Full payment", amountCents: total, due: "When the SOW is signed" }],
    },
    {
      key: "milestones",
      label: "50 / 25 / 25",
      schedule: [
        { label: "To start", amountCents: first, due: "When the SOW is signed" },
        { label: "Build review", amountCents: second, due: "When you review the build" },
        { label: "Launch", amountCents: total - first - second, due: "At launch" },
      ],
    },
  ];
  if (total <= OWN_IT_MAX_ONE_TIME_CENTS) {
    options.push({
      key: "own_it",
      label: "Own-it plan",
      schedule: [
        {
          label: `${OWN_IT_MONTHS} monthly payments`,
          amountCents: OWN_IT_MONTHLY_CENTS,
          due: `$0 down, then monthly for ${OWN_IT_MONTHS} months; the site is yours after the last payment`,
        },
      ],
    });
  }
  return options;
}

export function effectiveRate(lines: ProposalLine[]): { hours: number; rateCents: number } | null {
  const oneTime = lines.filter((l) => !l.recurring && l.unit_price_cents > 0);
  if (oneTime.length === 0 || oneTime.some((l) => l.internal_hours == null)) return null;
  const hours = oneTime.reduce((a, l) => a + (l.internal_hours ?? 0) * l.quantity, 0);
  if (hours <= 0) return null;
  return { hours, rateCents: Math.round(proposalTotals(lines).oneTimeCents / hours) };
}

export function proposalWarnings(lines: ProposalLine[]): string[] {
  if (lines.length === 0) return ["Add at least one line."];
  const warnings: string[] = [];
  if (proposalTotals(lines).oneTimeCents < MINIMUM_ONE_TIME_CENTS) {
    warnings.push("One-time total is under the $999 minimum.");
  }
  if (lines.some((l) => l.needs_discovery)) {
    warnings.push("A line is marked quote after discovery; price it before sending.");
  }
  return warnings;
}

export function formatUsd(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
```

Note: the "under $999" warning is advisory only (it does not block sending); `needs_discovery` and "no lines" block sending in the builder and in `proposal_send`.

- [ ] **Step 4: Run tests** — `node --experimental-strip-types tests/proposals.test.mjs` → all PASS.

- [ ] **Step 5: Format, lint, commit**

```bash
node node_modules/prettier/bin/prettier.cjs --write src/lib/proposals.ts tests/proposals.test.mjs
node node_modules/eslint/bin/eslint.js src/lib/proposals.ts
git add src/lib/proposals.ts tests/proposals.test.mjs
git commit -m "feat(proposals): pure scoping, totals, payment options and warnings"
```

---

### Task 2: Price book table, seed and write RPC

**Files:**
- Create: `supabase/migrations/20261017120000_price_book.sql`
- Modify: `tests/crm-grants.integration.test.mjs` (`READABLE` ~line 47, `WRITE_RPCS` ~line 52, behaviour block after the `contact_set_next_action` checks)

**Interfaces:**
- Produces: table `public.price_book_items`; RPC `price_book_upsert(p_id uuid, p_key text, p_name text, p_description text, p_category text, p_unit text, p_unit_price_cents bigint, p_recurring boolean, p_price_is_from boolean, p_includes text[], p_excludes text[], p_internal_hours numeric, p_archived boolean, p_sort_order integer) returns uuid`.

- [ ] **Step 1: Failing integration assertions.** Add `"price_book_items"` to `READABLE`, `"price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer)"` to `WRITE_RPCS`, and after the `contact_set_next_action` block:

```js
  // Price book: seeded, and writable only through price_book_upsert.
  assert.equal(as("postgres", "select count(*) from public.price_book_items;"), "16");
  assert.equal(as("postgres", "select unit_price_cents from public.price_book_items where key='site_contractor';"), "199900"); // prettier-ignore
  const pb = as("service_role", "select public.price_book_upsert(null,'test_item','Test','','addon','each',1900,false,false,'{}','{}',null,false,99);"); // prettier-ignore
  as("service_role", `select public.price_book_upsert('${pb}','test_item','Test','','addon','each',2900,false,false,'{}','{}',1.5,true,99);`); // prettier-ignore
  assert.equal(as("postgres", `select unit_price_cents || '|' || archived from public.price_book_items where id='${pb}';`), "2900|true"); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'site_standard','Dup','','website','each',1,false,false,'{}','{}',null,false,0);", /duplicate key/); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'bad_cat','X','','nope','each',1,false,false,'{}','{}',null,false,0);", /check constraint/); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'neg','X','','addon','each',-1,false,false,'{}','{}',null,false,0);", /check constraint/); // prettier-ignore
```

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20261017120000_price_book.sql
-- Price book: the building blocks proposals are priced from. Proposals snapshot
-- these values (20261017130000_proposals.sql), so an edit here never changes a
-- proposal already sent.

create table if not exists public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  category text not null check (category in ('website','addon','automation','monthly')),
  unit text not null check (unit in ('each','page','town','month')),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  recurring boolean not null default false,
  price_is_from boolean not null default false,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  internal_hours numeric check (internal_hours is null or internal_hours >= 0),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.price_book_items enable row level security;
alter table public.price_book_items force row level security;
revoke all on table public.price_book_items from public, anon, authenticated, service_role;
grant select on table public.price_book_items to service_role;

insert into public.price_book_items
  (key, name, description, category, unit, unit_price_cents, recurring, price_is_from, includes, excludes, sort_order)
values
  ('site_standard', 'Standard website', 'A custom site for your business, built around one clear action for visitors.', 'website', 'each', 99900, false, false,
   array['Up to 5 pages','CMS your team can edit','Mobile-first design','SEO fundamentals','Analytics with a compliant consent banner','30 days of tweaks after launch'],
   array['Copywriting','Photography and stock','Brand identity design','Domain and hosting costs'], 10),
  ('site_contractor', 'Contractor website', 'A site built to turn a search on a phone into a call or a quote request.', 'website', 'each', 199900, false, false,
   array['Everything in the standard website','Tap-to-call on every page','Quote request form','Service-area section','Job photo gallery','LocalBusiness schema','Google Business Profile links'],
   array['Paid ads and lead buying','Copywriting beyond core pages','Professional photography','Domain and hosting costs'], 20),
  ('extra_page', 'Extra page', 'An additional page beyond the five included.', 'addon', 'page', 14900, false, false, '{}', '{}', 30),
  ('town_page', 'Town / service-area page', 'A page for one town you serve.', 'addon', 'town', 9900, false, false, '{}', '{}', 40),
  ('copywriting', 'Copywriting', 'We write the words for a page.', 'addon', 'page', 14900, false, false, '{}', '{}', 50),
  ('quote_form', 'Quote form with photo upload', 'A short form that asks the right questions and accepts photos.', 'addon', 'each', 19900, false, false, '{}', '{}', 60),
  ('booking_embed', 'Booking embed', 'A Calendly-style booking widget on your site.', 'addon', 'each', 24900, false, false, '{}', array['Custom booking systems (priced separately)'], 70),
  ('online_payments', 'Online payments', 'Stripe checkout for deposits or payments.', 'addon', 'each', 39900, false, false, '{}', array['Payment processor fees'], 80),
  ('site_replacement', 'Replace an existing site', 'Redirects mapped so you keep the search traffic you already have.', 'addon', 'each', 29900, false, false, '{}', '{}', 90),
  ('gbp_setup', 'Google Business Profile setup', 'Profile created or cleaned up and linked to your site.', 'addon', 'each', 19900, false, false, '{}', '{}', 100),
  ('blog_setup', 'Blog setup', 'A blog section you can post to yourself.', 'addon', 'each', 29900, false, false, '{}', array['Writing blog posts'], 110),
  ('automation_audit', 'Automation audit', 'One process mapped end to end, with a written plan and fixed price. Credited in full toward the build if you sign within 30 days.', 'automation', 'each', 74900, false, false, '{}', '{}', 120),
  ('automation_build', 'Automation build', 'One repetitive process automated end to end.', 'automation', 'each', 399900, false, true, '{}', array['Licences for integrated systems','AI model usage costs'], 130),
  ('hosting', 'Hosting only', 'Hosting, SSL and backups.', 'monthly', 'month', 4900, true, false, array['Hosting','SSL','Backups'], array['Edits (priced per request)'], 140),
  ('care_plan', 'Care plan', 'Hosting, updates, small edits and a monthly report.', 'monthly', 'month', 9900, true, false, array['Hosting and security updates','Backups and uptime monitoring','A few small edits a month','Monthly report'], array['New pages','New features','Redesigns'], 150),
  ('automation_retainer', 'Automation retainer', 'Monitoring, fixes and small changes, about 4 hours a month.', 'monthly', 'month', 49900, true, true, '{}', '{}', 160)
on conflict (key) do nothing;

create or replace function public.price_book_upsert(
  p_id uuid, p_key text, p_name text, p_description text, p_category text, p_unit text,
  p_unit_price_cents bigint, p_recurring boolean, p_price_is_from boolean,
  p_includes text[], p_excludes text[], p_internal_hours numeric, p_archived boolean,
  p_sort_order integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into price_book_items (key, name, description, category, unit, unit_price_cents,
      recurring, price_is_from, includes, excludes, internal_hours, archived, sort_order)
    values (p_key, btrim(p_name), coalesce(p_description, ''), p_category, p_unit, p_unit_price_cents,
      coalesce(p_recurring, false), coalesce(p_price_is_from, false), coalesce(p_includes, '{}'),
      coalesce(p_excludes, '{}'), p_internal_hours, coalesce(p_archived, false), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update price_book_items set
      key = p_key, name = btrim(p_name), description = coalesce(p_description, ''),
      category = p_category, unit = p_unit, unit_price_cents = p_unit_price_cents,
      recurring = coalesce(p_recurring, false), price_is_from = coalesce(p_price_is_from, false),
      includes = coalesce(p_includes, '{}'), excludes = coalesce(p_excludes, '{}'),
      internal_hours = p_internal_hours, archived = coalesce(p_archived, false),
      sort_order = coalesce(p_sort_order, 0), updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'price book item not found: %', p_id; end if;
  end if;
  return v_id;
end $$;

revoke all on function public.price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer) from public, anon, authenticated;
grant execute on function public.price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer) to service_role;
```

- [ ] **Step 3: Unit loop still green** (bash loop from Global Constraints). The integration test runs in CI.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261017120000_price_book.sql tests/crm-grants.integration.test.mjs
git commit -m "feat(db): price book table, seed and price_book_upsert"
```

---

### Task 3: Price book screen

**Files:**
- Modify: `src/server/crm/read.ts` (method after `listContacts`; `MEMBER_TABLE_POLICY` at line 38)
- Modify: `src/server/crm/actions.ts` (method after `setContactNextAction`)
- Modify: `src/lib/crm-data.ts` (server fns after `setContactNextAction`)
- Create: `src/routes/crm.price-book.tsx`
- Modify: `src/routes/crm.tsx` (NAV, line ~57; lucide import)
- Test: `tests/crm-actions-rpc.test.mjs`

**Interfaces:**
- Consumes: `PriceBookItem`, `formatUsd` (Task 1); `price_book_upsert` (Task 2).
- Produces: `CrmRead.listPriceBook<T>()`; `CrmActions.upsertPriceBookItem(input) → Promise<string>`; `toPriceBookItem(row) → PriceBookItem` (module-private in crm-data, reused by Task 5); server fns `crmPriceBook() → PriceBookItem[]` (any session), `savePriceBookItem({ data })` (admin only).

- [ ] **Step 1: Failing RPC-shape test** (append to `tests/crm-actions-rpc.test.mjs`, before the `assign` test)

```js
test("upsertPriceBookItem goes through price_book_upsert", async () => {
  const { actions, calls } = harness(() => json("99999999-9999-4999-8999-999999999999"));
  const id = await actions.upsertPriceBookItem({
    id: null, key: "extra_page", name: "Extra page", description: "", category: "addon",
    unit: "page", unit_price_cents: 14900, recurring: false, price_is_from: false,
    includes: [], excludes: [], internal_hours: 1.5, archived: false, sort_order: 30,
  });
  assert.equal(id, "99999999-9999-4999-8999-999999999999");
  assert.equal(calls[0].path, "/rest/v1/rpc/price_book_upsert");
  assert.deepEqual(calls[0].body, {
    p_id: null, p_key: "extra_page", p_name: "Extra page", p_description: "",
    p_category: "addon", p_unit: "page", p_unit_price_cents: 14900, p_recurring: false,
    p_price_is_from: false, p_includes: [], p_excludes: [], p_internal_hours: 1.5,
    p_archived: false, p_sort_order: 30,
  });
});
```

Run `node --experimental-strip-types tests/crm-actions-rpc.test.mjs` → FAIL (`upsertPriceBookItem is not a function`).

- [ ] **Step 2: Action** (new method on `CrmActions`)

```ts
  /** Create (id null) or update a price book item; returns its id. */
  upsertPriceBookItem(input: {
    id: string | null;
    key: string;
    name: string;
    description: string;
    category: string;
    unit: string;
    unit_price_cents: number;
    recurring: boolean;
    price_is_from: boolean;
    includes: string[];
    excludes: string[];
    internal_hours: number | null;
    archived: boolean;
    sort_order: number;
  }): Promise<string> {
    return this.#rpc<string>("price_book_upsert", {
      p_id: input.id,
      p_key: input.key,
      p_name: input.name,
      p_description: input.description,
      p_category: input.category,
      p_unit: input.unit,
      p_unit_price_cents: input.unit_price_cents,
      p_recurring: input.recurring,
      p_price_is_from: input.price_is_from,
      p_includes: input.includes,
      p_excludes: input.excludes,
      p_internal_hours: input.internal_hours,
      p_archived: input.archived,
      p_sort_order: input.sort_order,
    });
  }
```

Re-run the RPC test → PASS.

- [ ] **Step 3: Read + policy** (`src/server/crm/read.ts`): add `price_book_items: "shared",` to `MEMBER_TABLE_POLICY` and

```ts
  listPriceBook<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "price_book_items",
      "select=id,key,name,description,category,unit,unit_price_cents,recurring,price_is_from,includes,excludes,internal_hours,archived,sort_order&order=sort_order.asc&limit=500",
    );
  }
```

- [ ] **Step 4: Server functions** (`src/lib/crm-data.ts`; add `import type { PriceBookItem } from "@/lib/proposals";`; ensure `dollarsToCents` is in the `@/lib/crm-guards` import — it already exists there and throws a 400 `Response` on bad input)

```ts
function toPriceBookItem(r: Record<string, unknown>): PriceBookItem {
  return {
    id: String(r.id),
    key: String(r.key),
    name: str(r.name) ?? "",
    description: str(r.description) ?? "",
    category: String(r.category) as PriceBookItem["category"],
    unit: String(r.unit) as PriceBookItem["unit"],
    unit_price_cents: Number(r.unit_price_cents) || 0,
    recurring: Boolean(r.recurring),
    price_is_from: Boolean(r.price_is_from),
    includes: Array.isArray(r.includes) ? r.includes.map(String) : [],
    excludes: Array.isArray(r.excludes) ? r.excludes.map(String) : [],
    internal_hours: r.internal_hours == null ? null : Number(r.internal_hours),
    archived: Boolean(r.archived),
    sort_order: Number(r.sort_order) || 0,
  };
}

export const crmPriceBook = createServerFn({ method: "GET" }).handler(
  async (): Promise<PriceBookItem[]> => {
    const read = await reader();
    return (await read.listPriceBook<Record<string, unknown>>()).map(toPriceBookItem);
  },
);

/** One entry per line; blank lines dropped. */
function textLines(value: unknown, field: string): string[] {
  return (text(value, field, 4000) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const savePriceBookItem = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => {
    const hoursRaw = d?.internalHours;
    const hours = hoursRaw === "" || hoursRaw == null ? null : Number(hoursRaw);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      throw new Response("Hours must be a positive number", { status: 400 });
    }
    const category = String(d?.category ?? "");
    const unit = String(d?.unit ?? "");
    if (!["website", "addon", "automation", "monthly"].includes(category)) {
      throw new Response("Category is not valid", { status: 400 });
    }
    if (!["each", "page", "town", "month"].includes(unit)) {
      throw new Response("Unit is not valid", { status: 400 });
    }
    return {
      id: optionalUuid(d?.id),
      key: (text(d?.key, "Key", 60, true) as string).toLowerCase(),
      name: text(d?.name, "Name", 120, true) as string,
      description: text(d?.description, "Description", 600) ?? "",
      category,
      unit,
      unit_price_cents: dollarsToCents(d?.price),
      recurring: unit === "month",
      price_is_from: d?.priceIsFrom === "on" || d?.priceIsFrom === true,
      includes: textLines(d?.includes, "Includes"),
      excludes: textLines(d?.excludes, "Excludes"),
      internal_hours: hours,
      archived: d?.archived === "on" || d?.archived === true,
      sort_order: Number(d?.sortOrder) || 0,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions, session } = await writer();
    assertAdmin(session);
    await actions.upsertPriceBookItem(data);
    return { ok: true };
  });
```

- [ ] **Step 5: Route `src/routes/crm.price-book.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { crmPriceBook, savePriceBookItem } from "@/lib/crm-data";
import { formatUsd, type PriceBookItem } from "@/lib/proposals";
import { PageHeader, Card, Disclosure, EntityForm, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/price-book")({
  loader: () => crmPriceBook(),
  component: PriceBook,
});

const CATEGORY_LABEL: Record<PriceBookItem["category"], string> = {
  website: "Websites",
  addon: "Add-ons",
  automation: "Automation",
  monthly: "Monthly",
};
const UNIT_LABEL: Record<PriceBookItem["unit"], string> = {
  each: "",
  page: " / page",
  town: " / town",
  month: " / mo",
};

const FIELDS: Parameters<typeof EntityForm>[0]["fields"] = [
  { name: "name", label: "Name", required: true },
  { name: "key", label: "Key (lowercase, e.g. extra_page)", required: true },
  { name: "price", label: "Price (USD)", required: true, placeholder: "149" },
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    name: "unit",
    label: "Unit",
    type: "select",
    required: true,
    options: [
      { value: "each", label: "Each" },
      { value: "page", label: "Per page" },
      { value: "town", label: "Per town" },
      { value: "month", label: "Per month" },
    ],
  },
  { name: "internalHours", label: "Internal hours (never shown to clients)", type: "number" },
  { name: "description", label: "Description", type: "textarea", rows: 2 },
  { name: "includes", label: "Includes (one per line)", type: "textarea", rows: 3 },
  { name: "excludes", label: "Excludes (one per line)", type: "textarea", rows: 3 },
  { name: "priceIsFrom", label: "Show as a 'from' price", type: "checkbox" },
  { name: "archived", label: "Archived", type: "checkbox" },
  { name: "sortOrder", label: "Sort order", type: "number" },
];

function PriceBook() {
  const items = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const isAdmin = session?.role === "admin";
  const categories = Object.keys(CATEGORY_LABEL) as PriceBookItem["category"][];

  return (
    <div>
      <PageHeader title="Price book" subtitle="The building blocks proposals are priced from." />
      {isAdmin && (
        <div className="mb-5">
          <Disclosure label="New item">
            <EntityForm columns={2} fields={FIELDS} submitLabel="Add item" onSubmit={(data) => savePriceBookItem({ data })} />
          </Disclosure>
        </div>
      )}
      <div className="space-y-5">
        {categories.map((c) => {
          const group = items.filter((i) => i.category === c);
          return (
            <Card key={c} title={CATEGORY_LABEL[c]}>
              <ul className="divide-y divide-border">
                {group.map((i) => (
                  <li key={i.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {i.name} {i.archived && <Badge value="Archived" />}
                      </p>
                      <p className="text-sm tabular-nums text-foreground">
                        {i.price_is_from ? "from " : ""}
                        {formatUsd(i.unit_price_cents)}
                        {UNIT_LABEL[i.unit]}
                        {i.internal_hours != null && (
                          <span className="ml-2 text-xs text-muted-foreground">{i.internal_hours} h</span>
                        )}
                      </p>
                    </div>
                    {i.description && <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>}
                    {isAdmin && (
                      <div className="mt-2">
                        <Disclosure label="Edit">
                          <EntityForm
                            columns={2}
                            fields={FIELDS}
                            values={{
                              name: i.name,
                              key: i.key,
                              price: (i.unit_price_cents / 100).toString(),
                              category: i.category,
                              unit: i.unit,
                              internalHours: i.internal_hours ?? "",
                              description: i.description,
                              includes: i.includes.join("\n"),
                              excludes: i.excludes.join("\n"),
                              priceIsFrom: i.price_is_from ? "on" : "",
                              archived: i.archived ? "on" : "",
                              sortOrder: String(i.sort_order),
                            }}
                            submitLabel="Save"
                            onSubmit={(data) => savePriceBookItem({ data: { ...data, id: i.id } })}
                          />
                        </Disclosure>
                      </div>
                    )}
                  </li>
                ))}
                {group.length === 0 && <li className="py-3 text-sm text-muted-foreground">No items.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

If `Parameters<typeof EntityForm>[0]["fields"]` doesn't type-check, import the field type: `FormFieldDef` from `@/components/crm/ui` (exported at ~line 322; export it if it isn't).

- [ ] **Step 6: Nav** (`src/routes/crm.tsx`): add `ReceiptText` to the `lucide-react` import; after the Playbook entry add `{ to: "/crm/price-book", label: "Price book", icon: ReceiptText, exact: false },`.

- [ ] **Step 7: Verify** — tsc (0 errors), unit loop (no FAIL), vitest, eslint on changed files, build (exit 0, route tree regenerated).

- [ ] **Step 8: Commit**

```bash
git add src/server/crm/read.ts src/server/crm/actions.ts src/lib/crm-data.ts src/routes/crm.price-book.tsx src/routes/crm.tsx src/routeTree.gen.ts src/components/crm/ui.tsx tests/crm-actions-rpc.test.mjs
git commit -m "feat(crm): editable price book page"
```

---

### Task 4: Proposals schema and RPCs

**Files:**
- Create: `supabase/migrations/20261017130000_proposals.sql`
- Modify: `tests/crm-grants.integration.test.mjs`

**Interfaces:**
- Produces (RPCs, service_role only):
  - `deal_set_scoping(p_deal_id uuid, p_scoping jsonb) returns void`
  - `proposal_save_draft(p_id uuid, p_deal_id uuid, p_title text, p_summary text, p_timeline text, p_lines jsonb, p_actor text) returns uuid` — `p_id` null creates the deal's next version; otherwise updates a draft and replaces its lines. `p_lines` is a JSON array of `ProposalLine` objects (Task 1 field names).
  - `proposal_send(p_id uuid, p_token_hash text, p_valid_days integer) returns void`
  - `proposal_revise(p_id uuid, p_actor text) returns uuid`
  - `proposal_public(p_token_hash text) returns jsonb` — client-facing fields, `lines`, `client`, and computed `state` (`open` | `accepted` | `declined` | `expired` | `superseded`); null for unknown hashes and drafts
  - `proposal_mark_viewed(p_token_hash text) returns void`
  - `proposal_decide(p_token_hash text, p_decision text, p_option text, p_name text, p_reason text) returns jsonb` — `{ "status": ... }`
- Select grants on `proposals`, `proposal_lines` to service_role.

- [ ] **Step 1: Failing integration assertions.** Add `"proposals", "proposal_lines"` to `READABLE`; add to `WRITE_RPCS`: `"deal_set_scoping(uuid,jsonb)"`, `"proposal_save_draft(uuid,uuid,text,text,text,jsonb,text)"`, `"proposal_send(uuid,text,integer)"`, `"proposal_revise(uuid,text)"`, `"proposal_public(text)"`, `"proposal_mark_viewed(text)"`, `"proposal_decide(text,text,text,text,text)"`. Append:

```js
  // Proposals: draft → send → view → decide, with snapshots and one-way moves.
  as("service_role", `select public.deal_set_scoping('${deal}', '{"trade":true,"townPages":3}'::jsonb);`);
  assert.equal(as("postgres", `select scoping->>'townPages' from public.deals where id='${deal}';`), "3");
  const line = (name, cents, extra = "") =>
    `{"item_key":null,"name":"${name}","description":"","quantity":1,"unit":"each","unit_price_cents":${cents},"recurring":false,"price_is_from":false,"includes":["A"],"excludes":["B"],"internal_hours":null,"needs_discovery":false,"discount_reason":${cents < 0 ? '"Intro"' : "null"}${extra}}`;
  const draftOf = (title, lines) =>
    as("service_role", `select public.proposal_save_draft(null,'${deal}','${title}','','', '[${lines.join(",")}]'::jsonb,'crm:test');`); // prettier-ignore
  refuses("service_role", `select public.proposal_send('${draftOf("Empty", [])}','hash-empty',30);`, /no lines/);
  refuses("service_role", `select public.proposal_send('${draftOf("Disc", [line("Site", 99900, ',"needs_discovery":true')])}','hash-disc',30);`, /discovery/); // prettier-ignore
  refuses("service_role", `select public.proposal_send('${draftOf("Neg", [line("Site", 99900), line("Discount", -200000)])}','hash-neg',30);`, /total/); // Review Focus 2
  const p = draftOf("Website", [line("Site", 99900)]);
  as("service_role", `select public.proposal_send('${p}','hash-p',30);`);
  refuses("service_role", `select public.proposal_save_draft('${p}','${deal}','Edit','','', '[]'::jsonb,'crm:test');`, /draft/);
  // Snapshot: price book edits never reach a sent proposal (Review Focus 5).
  as("postgres", "update public.price_book_items set unit_price_cents = 1 where key='site_standard';");
  assert.equal(as("postgres", `select unit_price_cents from public.proposal_lines where proposal_id='${p}';`), "99900"); // prettier-ignore
  const pub = JSON.parse(as("service_role", "select public.proposal_public('hash-p');"));
  assert.equal(pub.state, "open");
  assert.equal(pub.lines[0].internal_hours, undefined);
  assert.equal(pub.created_by, undefined);
  assert.equal(pub.token_hash, undefined);
  assert.equal(as("service_role", "select public.proposal_public('nope') is null;"), "t");
  as("service_role", "select public.proposal_mark_viewed('hash-p');");
  assert.equal(as("postgres", `select status from public.proposals where id='${p}';`), "viewed");
  refuses("service_role", "select public.proposal_decide('hash-p','accept','own_it_typo','Alex','');", /option/);
  refuses("service_role", "select public.proposal_decide('hash-p','accept','full','A','');", /name/);
  assert.equal(JSON.parse(as("service_role", "select public.proposal_decide('hash-p','accept','own_it','Alex Fixture','');")).status, "accepted"); // prettier-ignore
  assert.equal(as("postgres", `select value_usd::int from public.deals where id='${deal}';`), "999");
  assert.equal(as("postgres", `select stage from public.deals where id='${deal}';`), "Lead arrives"); // never moves the stage
  assert.equal(as("postgres", `select count(*) from public.tasks where source='proposal' and source_record_id='${p}';`), "1"); // prettier-ignore
  // Replay is a no-op (Review Focus 4).
  assert.equal(JSON.parse(as("service_role", "select public.proposal_decide('hash-p','decline','','Someone','late');")).status, "accepted"); // prettier-ignore
  assert.equal(as("postgres", `select accepted_option from public.proposals where id='${p}';`), "own_it");
  assert.equal(as("postgres", `select count(*) from public.tasks where source='proposal' and source_record_id='${p}';`), "1"); // prettier-ignore
  // Own-it refused above $1,788.
  const big = draftOf("Big", [line("Site", 199900)]);
  as("service_role", `select public.proposal_send('${big}','hash-big',30);`);
  refuses("service_role", "select public.proposal_decide('hash-big','accept','own_it','Alex','');", /own-it/);
  // Revise supersedes; superseded and expired links cannot be accepted (Review Focus 3).
  refuses("service_role", `select public.proposal_revise('${p}','crm:test');`, /revised/); // accepted can't be revised
  const v2 = as("service_role", `select public.proposal_revise('${big}','crm:test');`);
  assert.equal(as("postgres", `select status || '|' || (superseded_by = '${v2}') from public.proposals where id='${big}';`), "superseded|true"); // prettier-ignore
  assert.equal(as("postgres", `select count(*) from public.proposal_lines where proposal_id='${v2}';`), "1");
  assert.equal(JSON.parse(as("service_role", "select public.proposal_public('hash-big');")).state, "superseded");
  assert.equal(JSON.parse(as("service_role", "select public.proposal_decide('hash-big','accept','full','Alex','');")).status, "superseded"); // prettier-ignore
  as("service_role", `select public.proposal_send('${v2}','hash-v2',30);`);
  as("postgres", `update public.proposals set valid_until = current_date - 1 where id='${v2}';`);
  assert.equal(JSON.parse(as("service_role", "select public.proposal_public('hash-v2');")).state, "expired");
  assert.equal(JSON.parse(as("service_role", "select public.proposal_decide('hash-v2','accept','full','Alex','');")).status, "expired"); // prettier-ignore
```

(Check that the fixture `deal` at line ~150 is inserted with stage `'Lead arrives'`; it is.)

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20261017130000_proposals.sql
-- Proposals: priced offers built from the price book, sent as a private link,
-- accepted or declined by the client. Not the contract: accepting never moves
-- deals.stage (stage 4 still requires a signed SOW). Lines are snapshots, so
-- price book edits never change a proposal already sent.

alter table public.deals add column if not exists scoping jsonb not null default '{}'
  check (jsonb_typeof(scoping) = 'object');

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  version integer not null default 1,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '' check (length(summary) <= 4000),
  timeline text not null default '' check (length(timeline) <= 200),
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','declined','expired','superseded')),
  token_hash text unique,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  accepted_option text check (accepted_option in ('full','milestones','own_it')),
  accepted_name text,
  decline_reason text,
  superseded_by uuid references public.proposals(id),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, version)
);

create table if not exists public.proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  position integer not null,
  item_key text,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '',
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('each','page','town','month')),
  unit_price_cents bigint not null,
  recurring boolean not null default false,
  price_is_from boolean not null default false,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  internal_hours numeric,
  needs_discovery boolean not null default false,
  discount_reason text,
  check (unit_price_cents >= 0 or (discount_reason is not null and btrim(discount_reason) <> ''))
);

create index if not exists proposal_lines_proposal_idx on public.proposal_lines (proposal_id, position);
create index if not exists proposals_deal_idx on public.proposals (deal_id, version desc);

alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.proposal_lines enable row level security;
alter table public.proposal_lines force row level security;
revoke all on table public.proposals, public.proposal_lines from public, anon, authenticated, service_role;
grant select on table public.proposals, public.proposal_lines to service_role;

-- One-time total in cents, clamped at zero (matches proposalTotals in src/lib/proposals.ts).
create or replace function public.proposal_one_time_cents(p_id uuid)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce(sum(round(unit_price_cents * quantity)), 0))::bigint
  from proposal_lines where proposal_id = p_id and not recurring;
$$;
revoke all on function public.proposal_one_time_cents(uuid) from public, anon, authenticated;

create or replace function public.deal_set_scoping(p_deal_id uuid, p_scoping jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_scoping is null or jsonb_typeof(p_scoping) <> 'object' then
    raise exception 'scoping must be a JSON object';
  end if;
  update deals set scoping = p_scoping, updated_at = now() where id = p_deal_id;
  if not found then raise exception 'deal not found: %', p_deal_id; end if;
end $$;

create or replace function public.proposal_save_draft(
  p_id uuid, p_deal_id uuid, p_title text, p_summary text, p_timeline text, p_lines jsonb, p_actor text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_status text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be a JSON array';
  end if;
  if p_id is null then
    perform 1 from deals where id = p_deal_id for update;
    if not found then raise exception 'deal not found: %', p_deal_id; end if;
    insert into proposals (deal_id, version, title, summary, timeline, created_by)
    values (p_deal_id,
            coalesce((select max(version) from proposals where deal_id = p_deal_id), 0) + 1,
            btrim(p_title), coalesce(p_summary, ''), coalesce(p_timeline, ''), p_actor)
    returning id into v_id;
  else
    select status into v_status from proposals where id = p_id and deal_id = p_deal_id for update;
    if not found then raise exception 'proposal not found: %', p_id; end if;
    if v_status <> 'draft' then raise exception 'only a draft proposal can be edited'; end if;
    update proposals set title = btrim(p_title), summary = coalesce(p_summary, ''),
      timeline = coalesce(p_timeline, ''), updated_at = now()
    where id = p_id returning id into v_id;
    delete from proposal_lines where proposal_id = v_id;
  end if;

  insert into proposal_lines (proposal_id, position, item_key, name, description, quantity, unit,
    unit_price_cents, recurring, price_is_from, includes, excludes, internal_hours,
    needs_discovery, discount_reason)
  select v_id, l.ord::int, nullif(l.v->>'item_key', ''), l.v->>'name', coalesce(l.v->>'description', ''),
    (l.v->>'quantity')::numeric, l.v->>'unit', (l.v->>'unit_price_cents')::bigint,
    coalesce((l.v->>'recurring')::boolean, false), coalesce((l.v->>'price_is_from')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(coalesce(l.v->'includes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(l.v->'excludes', '[]'::jsonb))), '{}'),
    nullif(l.v->>'internal_hours', '')::numeric,
    coalesce((l.v->>'needs_discovery')::boolean, false), nullif(l.v->>'discount_reason', '')
  from jsonb_array_elements(p_lines) with ordinality as l(v, ord);

  return v_id;
end $$;

create or replace function public.proposal_send(p_id uuid, p_token_hash text, p_valid_days integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  select status into v_status from proposals where id = p_id for update;
  if not found then raise exception 'proposal not found: %', p_id; end if;
  if v_status <> 'draft' then raise exception 'only a draft proposal can be sent'; end if;
  if not exists (select 1 from proposal_lines where proposal_id = p_id) then
    raise exception 'a proposal with no lines cannot be sent';
  end if;
  if exists (select 1 from proposal_lines where proposal_id = p_id and needs_discovery) then
    raise exception 'price every quote-after-discovery line before sending';
  end if;
  if (select coalesce(sum(round(unit_price_cents * quantity)), 0) from proposal_lines
      where proposal_id = p_id and not recurring) <= 0 then
    raise exception 'the one-time total must be above zero';
  end if;
  if p_token_hash is null or length(p_token_hash) < 8 then raise exception 'token hash is required'; end if;
  update proposals set status = 'sent', token_hash = p_token_hash, sent_at = now(),
    valid_until = current_date + greatest(1, coalesce(p_valid_days, 30)), updated_at = now()
  where id = p_id;
end $$;

create or replace function public.proposal_revise(p_id uuid, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old proposals; v_new uuid;
begin
  select * into v_old from proposals where id = p_id for update;
  if not found then raise exception 'proposal not found: %', p_id; end if;
  if v_old.status in ('draft', 'accepted', 'superseded') then
    raise exception 'only a sent, viewed, declined or expired proposal can be revised';
  end if;
  insert into proposals (deal_id, version, title, summary, timeline, created_by)
  values (v_old.deal_id, (select max(version) from proposals where deal_id = v_old.deal_id) + 1,
          v_old.title, v_old.summary, v_old.timeline, p_actor)
  returning id into v_new;
  insert into proposal_lines (proposal_id, position, item_key, name, description, quantity, unit,
    unit_price_cents, recurring, price_is_from, includes, excludes, internal_hours,
    needs_discovery, discount_reason)
  select v_new, position, item_key, name, description, quantity, unit, unit_price_cents, recurring,
    price_is_from, includes, excludes, internal_hours, needs_discovery, discount_reason
  from proposal_lines where proposal_id = p_id;
  update proposals set status = 'superseded', superseded_by = v_new, updated_at = now() where id = p_id;
  return v_new;
end $$;

-- Client-facing view. Never returns internal_hours, created_by or token_hash.
create or replace function public.proposal_public(p_token_hash text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'summary', p.summary,
    'timeline', p.timeline,
    'valid_until', p.valid_until,
    'state', case
      when p.status = 'accepted' then 'accepted'
      when p.status = 'declined' then 'declined'
      when p.status = 'superseded' then 'superseded'
      when p.status = 'expired' or p.valid_until < current_date then 'expired'
      else 'open' end,
    'accepted_option', p.accepted_option,
    'client', (select c.name from deals d left join companies c on c.id = d.company_id where d.id = p.deal_id),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', l.name, 'description', l.description, 'quantity', l.quantity, 'unit', l.unit,
        'unit_price_cents', l.unit_price_cents, 'recurring', l.recurring,
        'price_is_from', l.price_is_from, 'includes', l.includes, 'excludes', l.excludes,
        'discount_reason', l.discount_reason) order by l.position)
      from proposal_lines l where l.proposal_id = p.id), '[]'::jsonb)
  )
  from proposals p
  where p.token_hash = p_token_hash and p.status <> 'draft';
$$;

-- Advisory and one-way, like document_mark_viewed: mail scanners may trigger it.
create or replace function public.proposal_mark_viewed(p_token_hash text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update proposals set status = 'viewed', viewed_at = now(), updated_at = now()
  where token_hash = p_token_hash and status = 'sent' and valid_until >= current_date;
$$;

create or replace function public.proposal_decide(
  p_token_hash text, p_decision text, p_option text, p_name text, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v proposals; v_total bigint; v_deal deals;
begin
  select * into v from proposals where token_hash = p_token_hash for update;
  if not found then raise exception 'proposal not found'; end if;

  if v.status in ('sent', 'viewed') and v.valid_until < current_date then
    update proposals set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('status', 'expired');
  end if;
  -- Replays, double clicks and late clicks return the current state unchanged.
  if v.status not in ('sent', 'viewed') then
    return jsonb_build_object('status', v.status);
  end if;

  if p_decision = 'decline' then
    update proposals set status = 'declined', decided_at = now(),
      decline_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), ''), updated_at = now()
    where id = v.id;
    return jsonb_build_object('status', 'declined');
  end if;

  if p_decision is distinct from 'accept' then raise exception 'decision must be accept or decline'; end if;
  if p_option is null or p_option not in ('full', 'milestones', 'own_it') then
    raise exception 'payment option is not valid';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(p_name) > 200 then
    raise exception 'type your full name to accept';
  end if;
  v_total := proposal_one_time_cents(v.id);
  if p_option = 'own_it' and v_total > 178800 then
    raise exception 'the own-it plan is only available for one-time totals of $1,788 or less';
  end if;

  update proposals set status = 'accepted', decided_at = now(), accepted_option = p_option,
    accepted_name = btrim(p_name), updated_at = now()
  where id = v.id;

  select * into v_deal from deals where id = v.deal_id for update;
  update deals set value_usd = v_total / 100.0, updated_at = now() where id = v.deal_id;

  insert into tasks (source, source_record_id, company_id, content, deadline_at, metadata)
  values ('proposal', v.id::text, v_deal.company_id,
          'Send SOW to ' || coalesce(v_deal.name, 'client') || ' (proposal accepted)',
          now() + interval '1 day', jsonb_build_object('deal_id', v.deal_id))
  on conflict (source, source_record_id) do nothing;

  return jsonb_build_object('status', 'accepted');
end $$;

revoke all on function public.deal_set_scoping(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.proposal_save_draft(uuid, uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.proposal_send(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.proposal_revise(uuid, text) from public, anon, authenticated;
revoke all on function public.proposal_public(text) from public, anon, authenticated;
revoke all on function public.proposal_mark_viewed(text) from public, anon, authenticated;
revoke all on function public.proposal_decide(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.deal_set_scoping(uuid, jsonb) to service_role;
grant execute on function public.proposal_save_draft(uuid, uuid, text, text, text, jsonb, text) to service_role;
grant execute on function public.proposal_send(uuid, text, integer) to service_role;
grant execute on function public.proposal_revise(uuid, text) to service_role;
grant execute on function public.proposal_public(text) to service_role;
grant execute on function public.proposal_mark_viewed(text) to service_role;
grant execute on function public.proposal_decide(text, text, text, text, text) to service_role;
```

Note: `tasks.owner_id` is left null (an accepted proposal comes from the client, not a user); both current users are admins and see unowned tasks.

- [ ] **Step 3: Unit loop still green** (bash loop). Integration runs in CI.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261017130000_proposals.sql tests/crm-grants.integration.test.mjs
git commit -m "feat(db): proposals, lines, scoping and the proposal state machine"
```

---

### Task 5: CRM server functions for scoping and proposals

**Files:**
- Modify: `src/server/crm/actions.ts`, `src/server/crm/read.ts`, `src/lib/crm-data.ts`, `src/lib/crm-timeline.ts`
- Test: `tests/crm-actions-rpc.test.mjs`, create `tests/proposal-events.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports; Task 3 `toPriceBookItem`; Task 4 RPCs.
- Produces:
  - `CrmActions.setDealScoping(dealId: string, scoping: ScopingAnswers): Promise<void>`
  - `CrmActions.saveProposalDraft(input: { id: string | null; dealId: string; title: string; summary: string; timeline: string; lines: ProposalLine[]; actor: string }): Promise<string>`
  - `CrmActions.sendProposal(id: string, tokenHash: string, validDays: number): Promise<void>`
  - `CrmActions.reviseProposal(id: string, actor: string): Promise<string>`
  - `CrmRead.listProposalsForDeal<T>(dealId)`, `CrmRead.getProposal<T>(id): Promise<T | null>`, `CrmRead.listProposalLines<T>(proposalId)`
  - `interface ProposalSummary { id: string; version: number; title: string; status: string; sent_at: string | null; decided_at: string | null; accepted_option: string | null; one_time_cents: number; monthly_cents: number }` (exported from `crm-data.ts`)
  - `interface ProposalDetail extends ProposalSummary { deal_id: string; deal_name: string; summary: string; timeline: string; valid_until: string | null; decline_reason: string | null; accepted_name: string | null; lines: ProposalLine[] }`
  - `proposalEvents(rows) → TimelineEvent[]` in `src/lib/crm-timeline.ts`
  - server fns: `saveDealScoping({ data })`, `buildProposalFromScoping({ data: { dealId } }) → { id: string; skipped: string[] }`, `crmProposal({ data: { id } }) → ProposalDetail`, `saveProposal({ data: { id, dealId, title, summary, timeline, lines } })`, `sendProposal({ data: { id } }) → { url: string }`, `reviseProposal({ data: { id } }) → { id: string }`
  - `crmDeal` result gains `scoping: ScopingAnswers` and `proposals: ProposalSummary[]`; timeline gains proposal events.

- [ ] **Step 1: Failing tests**

Append to `tests/crm-actions-rpc.test.mjs` (before `assign`):

```js
test("proposal RPCs keep their wire shape", async () => {
  const { actions, calls } = harness(() => json("66666666-6666-4666-8666-666666666666"));
  await actions.setDealScoping(DEAL, { trade: true });
  const id = await actions.saveProposalDraft({
    id: null, dealId: DEAL, title: "Website", summary: "S", timeline: "3 weeks", lines: [], actor: "crm:a@b",
  });
  await actions.sendProposal(id, "hash", 30);
  await actions.reviseProposal(id, "crm:a@b");
  assert.deepEqual(calls.map((c) => c.path), [
    "/rest/v1/rpc/deal_set_scoping",
    "/rest/v1/rpc/proposal_save_draft",
    "/rest/v1/rpc/proposal_send",
    "/rest/v1/rpc/proposal_revise",
  ]);
  assert.deepEqual(calls[0].body, { p_deal_id: DEAL, p_scoping: { trade: true } });
  assert.deepEqual(calls[1].body, {
    p_id: null, p_deal_id: DEAL, p_title: "Website", p_summary: "S", p_timeline: "3 weeks", p_lines: [], p_actor: "crm:a@b",
  });
  assert.deepEqual(calls[2].body, { p_id: id, p_token_hash: "hash", p_valid_days: 30 });
  assert.deepEqual(calls[3].body, { p_id: id, p_actor: "crm:a@b" });
});
```

Create `tests/proposal-events.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { proposalEvents } from "../src/lib/crm-timeline.ts";

const base = {
  id: "p1", version: 2, title: "Site", status: "accepted",
  sent_at: "2026-10-01T00:00:00Z", decided_at: "2026-10-02T00:00:00Z", accepted_option: "full",
};

test("proposal events: sent always, decided only when accepted or declined", () => {
  assert.deepEqual(proposalEvents([base]).map((e) => e.title), ["Proposal v2 sent", "Proposal v2 accepted"]);
  assert.deepEqual(proposalEvents([{ ...base, status: "superseded" }]).map((e) => e.title), ["Proposal v2 sent"]);
  assert.deepEqual(proposalEvents([{ ...base, sent_at: null, decided_at: null, status: "draft" }]), []);
  assert.equal(proposalEvents([base])[0].kind, "proposal");
});
```

Run both → FAIL.

- [ ] **Step 2: Actions** (`src/server/crm/actions.ts`; add `import type { ProposalLine, ScopingAnswers } from "@/lib/proposals";`)

```ts
  async setDealScoping(dealId: string, scoping: Partial<ScopingAnswers>): Promise<void> {
    await this.#rpc<unknown>("deal_set_scoping", { p_deal_id: dealId, p_scoping: scoping });
  }

  saveProposalDraft(input: {
    id: string | null;
    dealId: string;
    title: string;
    summary: string;
    timeline: string;
    lines: ProposalLine[];
    actor: string;
  }): Promise<string> {
    return this.#rpc<string>("proposal_save_draft", {
      p_id: input.id,
      p_deal_id: input.dealId,
      p_title: input.title,
      p_summary: input.summary,
      p_timeline: input.timeline,
      p_lines: input.lines,
      p_actor: input.actor,
    });
  }

  async sendProposal(id: string, tokenHash: string, validDays: number): Promise<void> {
    await this.#rpc<unknown>("proposal_send", {
      p_id: id,
      p_token_hash: tokenHash,
      p_valid_days: validDays,
    });
  }

  reviseProposal(id: string, actor: string): Promise<string> {
    return this.#rpc<string>("proposal_revise", { p_id: id, p_actor: actor });
  }
```

- [ ] **Step 3: Timeline** (`src/lib/crm-timeline.ts`): add `| "proposal"` to `TimelineEvent.kind`, then:

```ts
export function proposalEvents(
  rows: {
    id: string;
    version: number;
    title: string;
    status: string;
    sent_at: string | null;
    decided_at: string | null;
    accepted_option: string | null;
  }[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const p of rows) {
    if (p.sent_at) {
      events.push({ id: `ps-${p.id}`, at: p.sent_at, kind: "proposal", title: `Proposal v${p.version} sent`, detail: p.title, actor: null });
    }
    if (p.decided_at && (p.status === "accepted" || p.status === "declined")) {
      events.push({ id: `pd-${p.id}`, at: p.decided_at, kind: "proposal", title: `Proposal v${p.version} ${p.status}`, detail: p.accepted_option, actor: "client" });
    }
  }
  return events;
}
```

If `Timeline` in `src/components/crm/ui.tsx` maps `kind` to an icon/label record, add a `proposal` entry there (search `kind` in `ui.tsx`).

Run both tests → PASS.

- [ ] **Step 4: Reads** (`src/server/crm/read.ts`): add `proposals: "shared", proposal_lines: "shared",` to `MEMBER_TABLE_POLICY` (every server function below first reads the deal through the scoped reader, which is the real access check), and:

```ts
  listProposalsForDeal<T = Record<string, unknown>>(dealId: string): Promise<T[]> {
    return this.relatedBy<T>(
      "proposals",
      "deal_id",
      dealId,
      "id,version,title,status,sent_at,decided_at,accepted_option",
      "version.desc",
      50,
    );
  }
  async getProposal<T = Record<string, unknown>>(id: string): Promise<T | null> {
    const rows = await this.relatedBy<T>(
      "proposals",
      "id",
      id,
      "id,deal_id,version,title,summary,timeline,status,valid_until,sent_at,decided_at,accepted_option,accepted_name,decline_reason",
      "version.desc",
      1,
    );
    return rows[0] ?? null;
  }
  listProposalLines<T = Record<string, unknown>>(proposalId: string): Promise<T[]> {
    return this.relatedBy<T>(
      "proposal_lines",
      "proposal_id",
      proposalId,
      "item_key,name,description,quantity,unit,unit_price_cents,recurring,price_is_from,includes,excludes,internal_hours,needs_discovery,discount_reason,position",
      "position.asc",
      200,
    );
  }
```

- [ ] **Step 5: Server functions** (`src/lib/crm-data.ts`; import `EMPTY_SCOPING, scopingSuggestions, proposalTotals, type ProposalLine, type ScopingAnswers` from `@/lib/proposals`, and `proposalEvents` from `@/lib/crm-timeline`)

```ts
export interface ProposalSummary {
  id: string;
  version: number;
  title: string;
  status: string;
  sent_at: string | null;
  decided_at: string | null;
  accepted_option: string | null;
  one_time_cents: number;
  monthly_cents: number;
}

export interface ProposalDetail extends ProposalSummary {
  deal_id: string;
  deal_name: string;
  summary: string;
  timeline: string;
  valid_until: string | null;
  decline_reason: string | null;
  accepted_name: string | null;
  lines: ProposalLine[];
}

function toLine(r: Record<string, unknown>): ProposalLine {
  return {
    item_key: str(r.item_key),
    name: str(r.name) ?? "",
    description: str(r.description) ?? "",
    quantity: Number(r.quantity) || 0,
    unit: (str(r.unit) ?? "each") as ProposalLine["unit"],
    unit_price_cents: Number(r.unit_price_cents) || 0,
    recurring: Boolean(r.recurring),
    price_is_from: Boolean(r.price_is_from),
    includes: Array.isArray(r.includes) ? r.includes.map(String) : [],
    excludes: Array.isArray(r.excludes) ? r.excludes.map(String) : [],
    internal_hours: r.internal_hours == null ? null : Number(r.internal_hours),
    needs_discovery: Boolean(r.needs_discovery),
    discount_reason: str(r.discount_reason),
  };
}

/** Stored scoping JSON onto the full answer shape; unknown or bad values fall back. */
function toScoping(raw: unknown): ScopingAnswers {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = <K extends keyof ScopingAnswers>(k: K, ok: (v: unknown) => boolean): ScopingAnswers[K] =>
    (ok(o[k]) ? o[k] : EMPTY_SCOPING[k]) as ScopingAnswers[K];
  const isBool = (v: unknown) => typeof v === "boolean";
  const isCount = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100;
  return {
    trade: pick("trade", isBool),
    replacing: pick("replacing", isBool),
    extraPages: pick("extraPages", isCount),
    townPages: pick("townPages", isCount),
    copywriting: pick("copywriting", (v) => v === "client" || v === "us"),
    quoteForm: pick("quoteForm", isBool),
    booking: pick("booking", (v) => v === "none" || v === "embed" || v === "system"),
    payments: pick("payments", isBool),
    gbpSetUp: pick("gbpSetUp", isBool),
    blog: pick("blog", isBool),
    automation: pick("automation", isBool),
    afterLaunch: pick("afterLaunch", (v) => v === "nothing" || v === "hosting" || v === "care"),
  };
}

/** Form values arrive as strings ("yes"/"no", numbers as text). */
function scopingFromForm(d: Record<string, unknown>): ScopingAnswers {
  const yes = (k: string) => d[k] === "yes" || d[k] === "on" || d[k] === true;
  const n = (k: string) => Math.min(100, Math.max(0, Math.floor(Number(d[k]) || 0)));
  return toScoping({
    trade: yes("trade"),
    replacing: yes("replacing"),
    extraPages: n("extraPages"),
    townPages: n("townPages"),
    copywriting: d.copywriting === "us" ? "us" : "client",
    quoteForm: yes("quoteForm"),
    booking: d.booking,
    payments: yes("payments"),
    gbpSetUp: !yes("needsGbp"),
    blog: yes("blog"),
    automation: yes("automation"),
    afterLaunch: d.afterLaunch,
  });
}

type Reader = Awaited<ReturnType<typeof reader>>;

/** The deal must be visible to the caller; the scoped reader returns null otherwise. */
async function visibleDeal(read: Reader, dealId: string): Promise<Record<string, unknown>> {
  const deal = await read.getById<Record<string, unknown>>("deals", dealId, "id,name,company_id,scoping,owner_id,assigned_to");
  notFound(deal);
  return deal;
}

async function proposalSummaries(read: Reader, dealId: string): Promise<ProposalSummary[]> {
  const rows = await read.listProposalsForDeal<Record<string, unknown>>(dealId).catch(() => []);
  return Promise.all(
    rows.map(async (r) => {
      const lines = (await read.listProposalLines<Record<string, unknown>>(String(r.id))).map(toLine);
      const totals = proposalTotals(lines);
      return {
        id: String(r.id),
        version: Number(r.version) || 1,
        title: str(r.title) ?? "",
        status: str(r.status) ?? "draft",
        sent_at: str(r.sent_at),
        decided_at: str(r.decided_at),
        accepted_option: str(r.accepted_option),
        one_time_cents: totals.oneTimeCents,
        monthly_cents: totals.monthlyCents,
      };
    }),
  );
}

export const saveDealScoping = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId),
    scoping: scopingFromForm(d ?? {}),
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions } = await writer();
    await visibleDeal(await reader(), data.dealId);
    await actions.setDealScoping(data.dealId, data.scoping);
    return { ok: true };
  });

export const buildProposalFromScoping = createServerFn({ method: "POST" })
  .validator((d: { dealId: string }) => ({ dealId: requireUuid(d?.dealId) }))
  .handler(async ({ data }): Promise<{ id: string; skipped: string[] }> => {
    const { actions, actor } = await writer();
    const read = await reader();
    const deal = await visibleDeal(read, data.dealId);
    const items = (await read.listPriceBook<Record<string, unknown>>()).map(toPriceBookItem);
    const { lines, skipped } = scopingSuggestions(toScoping(deal.scoping), items);
    const id = await actions.saveProposalDraft({
      id: null,
      dealId: data.dealId,
      title: `Proposal for ${str(deal.name) ?? "your project"}`,
      summary: "",
      timeline: "",
      lines,
      actor,
    });
    return { id, skipped };
  });

export const crmProposal = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => ({ id: requireUuid(d?.id) }))
  .handler(async ({ data }): Promise<ProposalDetail> => {
    const read = await reader();
    const p = await read.getProposal<Record<string, unknown>>(data.id);
    notFound(p);
    const deal = await visibleDeal(read, String(p.deal_id));
    const lines = (await read.listProposalLines<Record<string, unknown>>(data.id)).map(toLine);
    const totals = proposalTotals(lines);
    return {
      id: String(p.id),
      deal_id: String(p.deal_id),
      deal_name: str(deal.name) ?? "(unnamed)",
      version: Number(p.version) || 1,
      title: str(p.title) ?? "",
      summary: str(p.summary) ?? "",
      timeline: str(p.timeline) ?? "",
      status: str(p.status) ?? "draft",
      valid_until: str(p.valid_until),
      sent_at: str(p.sent_at),
      decided_at: str(p.decided_at),
      accepted_option: str(p.accepted_option),
      accepted_name: str(p.accepted_name),
      decline_reason: str(p.decline_reason),
      one_time_cents: totals.oneTimeCents,
      monthly_cents: totals.monthlyCents,
      lines,
    };
  });

function validLine(raw: unknown): ProposalLine {
  const line = toLine((raw ?? {}) as Record<string, unknown>);
  if (!line.name.trim() || line.name.length > 200) {
    throw new Response("Every line needs a name", { status: 400 });
  }
  if (!(line.quantity > 0)) throw new Response(`${line.name}: quantity must be above zero`, { status: 400 });
  if (!Number.isInteger(line.unit_price_cents)) {
    throw new Response(`${line.name}: price is not valid`, { status: 400 });
  }
  if (line.unit_price_cents < 0 && !line.discount_reason?.trim()) {
    throw new Response(`${line.name}: a discount needs a reason`, { status: 400 });
  }
  return line;
}

export const saveProposal = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    id: requireUuid(d?.id),
    dealId: requireUuid(d?.dealId),
    title: text(d?.title, "Title", 200, true) as string,
    summary: text(d?.summary, "What you told us", 4000) ?? "",
    timeline: text(d?.timeline, "Timeline", 200) ?? "",
    lines: Array.isArray(d?.lines) ? (d.lines as unknown[]).slice(0, 100).map(validLine) : [],
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions, actor } = await writer();
    await visibleDeal(await reader(), data.dealId);
    await actions.saveProposalDraft({ ...data, actor });
    return { ok: true };
  });

export const sendProposal = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: requireUuid(d?.id) }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { actions } = await writer();
    const read = await reader();
    const p = await read.getProposal<Record<string, unknown>>(data.id);
    notFound(p);
    await visibleDeal(read, String(p.deal_id));
    const { randomBytes, createHash } = await import("node:crypto");
    const code = randomBytes(32).toString("base64url"); // 43 chars
    await actions.sendProposal(data.id, createHash("sha256").update(code).digest("hex"), 30);
    const base = (process.env.SITE_BASE_URL ?? "https://giventakedevs.com").replace(/\/$/, "");
    return { url: `${base}/proposal/${code}` };
  });

export const reviseProposal = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => ({ id: requireUuid(d?.id) }))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { actions, actor } = await writer();
    const read = await reader();
    const p = await read.getProposal<Record<string, unknown>>(data.id);
    notFound(p);
    await visibleDeal(read, String(p.deal_id));
    return { id: await actions.reviseProposal(data.id, actor) };
  });
```

**Link-code decision (resolves a spec gap):** only the code's hash is stored, so the link exists only in `sendProposal`'s response. The builder shows it once with "Save this link: for security it can't be shown again. If it's lost, use Revise to send a fresh version." This keeps the spec's "only the hash is stored".

Then extend `crmDeal`: call `proposalSummaries(read, data.id)` in its `Promise.all`; return `scoping: toScoping(row.scoping)` and `proposals`; change `events` to `[...stageHistory, ...related, ...proposalEvents(proposals)].sort(byNewestFirst)`. Add `scoping: ScopingAnswers; proposals: ProposalSummary[];` to the deal-detail interface. If `crmDeal`'s `getById` uses an explicit column list, add `scoping` to it.

- [ ] **Step 6: Verify** — tsc, unit loop, vitest, eslint on changed files.

- [ ] **Step 7: Commit**

```bash
git add src/server/crm/actions.ts src/server/crm/read.ts src/lib/crm-data.ts src/lib/crm-timeline.ts src/components/crm/ui.tsx tests/crm-actions-rpc.test.mjs tests/proposal-events.test.mjs
git commit -m "feat(crm): server functions for scoping and proposals"
```

---

### Task 6: Deal page Scope and Proposals cards

**Files:**
- Modify: `src/routes/crm.deals.$id.tsx` (main column, right after the `<Card title="This stage">` block at ~line 121; components at file end)

**Interfaces:**
- Consumes: `deal.scoping`, `deal.proposals`, `saveDealScoping`, `buildProposalFromScoping` (Task 5); `formatUsd` (Task 1).

- [ ] **Step 1: Imports** — add `saveDealScoping, buildProposalFromScoping` to the `@/lib/crm-data` import; `import { formatUsd } from "@/lib/proposals";`; add `useNavigate` to the `@tanstack/react-router` import.

- [ ] **Step 2: Render** — after the "This stage" card insert `<ScopeCard deal={deal} />` and `<ProposalsCard deal={deal} />`, and append:

```tsx
type DealData = ReturnType<typeof Route.useLoaderData>["deal"];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function ScopeCard({ deal }: { deal: DealData }) {
  const s = deal.scoping;
  const yn = (b: boolean) => (b ? "yes" : "no");
  return (
    <Card title="Scope">
      <Disclosure label="Edit scope" openLabel="Scope this job">
        <EntityForm
          columns={2}
          fields={[
            { name: "trade", label: "Trade or home-service business?", type: "select", options: YES_NO },
            { name: "replacing", label: "Replacing an existing site?", type: "select", options: YES_NO },
            { name: "extraPages", label: "Pages beyond the included 5", type: "number" },
            { name: "townPages", label: "Towns that need their own page", type: "number" },
            {
              name: "copywriting",
              label: "Who writes the words?",
              type: "select",
              options: [
                { value: "client", label: "The client" },
                { value: "us", label: "Us" },
              ],
            },
            { name: "quoteForm", label: "Quote form with photos? (standard sites)", type: "select", options: YES_NO },
            {
              name: "booking",
              label: "Booking",
              type: "select",
              options: [
                { value: "none", label: "None" },
                { value: "embed", label: "Simple embed" },
                { value: "system", label: "Full booking system" },
              ],
            },
            { name: "payments", label: "Take payments online?", type: "select", options: YES_NO },
            { name: "needsGbp", label: "Needs Google Business Profile setup?", type: "select", options: YES_NO },
            { name: "blog", label: "Blog?", type: "select", options: YES_NO },
            { name: "automation", label: "Repetitive process eating their time?", type: "select", options: YES_NO },
            {
              name: "afterLaunch",
              label: "After launch",
              type: "select",
              options: [
                { value: "nothing", label: "Nothing" },
                { value: "hosting", label: "Hosting only" },
                { value: "care", label: "Care plan" },
              ],
            },
          ]}
          values={{
            trade: yn(s.trade),
            replacing: yn(s.replacing),
            extraPages: String(s.extraPages),
            townPages: String(s.townPages),
            copywriting: s.copywriting,
            quoteForm: yn(s.quoteForm),
            booking: s.booking,
            payments: yn(s.payments),
            needsGbp: yn(!s.gbpSetUp),
            blog: yn(s.blog),
            automation: yn(s.automation),
            afterLaunch: s.afterLaunch,
          }}
          submitLabel="Save scope"
          onSubmit={(data) => saveDealScoping({ data: { ...data, dealId: deal.id } })}
        />
      </Disclosure>
    </Card>
  );
}

function ProposalsCard({ deal }: { deal: DealData }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function build() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await buildProposalFromScoping({ data: { dealId: deal.id } });
      await navigate({ to: "/crm/proposals/$id", params: { id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build a proposal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={`Proposals (${deal.proposals.length})`}>
      <button
        type="button"
        onClick={build}
        disabled={busy}
        className="mb-3 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Building…" : "Build proposal from scope"}
      </button>
      {error && <p role="alert" className="mb-2 text-xs font-medium text-red-600">{error}</p>}
      {deal.proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposals yet. Save the scope first, then build one.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {deal.proposals.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <a href={`/crm/proposals/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                v{p.version} · {p.title}
              </a>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {formatUsd(p.one_time_cents)}
                {p.monthly_cents > 0 && ` + ${formatUsd(p.monthly_cents)}/mo`}
                <Badge value={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

(Add `Badge`, `Card`, `Disclosure`, `EntityForm`, `useState` to imports if not already present.)

Skipped (archived or missing) price-book keys are shown on the builder: in `build()` destructure `{ id, skipped }` and navigate with `navigate({ to: "/crm/proposals/$id", params: { id }, search: { skipped: skipped.join(",") } })`. Task 7 Step 2b declares and renders that search param.

- [ ] **Step 3: Decline reason when marking lost.** The spec says a declined proposal's reason is shown when the deal is marked lost. In the existing **Mark lost** `Disclosure` (search `LOST_REASONS` in this file), add above the form:

```tsx
{(() => {
  const declined = deal.proposals.find((x) => x.status === "declined");
  return declined ? (
    <p className="mb-2 text-xs text-muted-foreground">
      The client declined proposal v{declined.version}. Check its page for their reason.
    </p>
  ) : null;
})()}
```

(`ProposalSummary` deliberately doesn't carry `decline_reason`; the builder page shows it.)

- [ ] **Step 4: Verify** — tsc, eslint on the file, build.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/crm.deals.\$id.tsx" src/routeTree.gen.ts
git commit -m "feat(crm): scope and proposals cards on the deal page"
```

---

### Task 7: Shared proposal document, builder and staff preview

**Files:**
- Create: `src/components/proposal-document.tsx`
- Create: `src/routes/crm.proposals.$id.tsx`
- Create: `src/routes/crm.proposals.$id.preview.tsx`

**Interfaces:**
- Consumes: Task 1 (`proposalTotals`, `paymentOptions`, `effectiveRate`, `proposalWarnings`, `formatUsd`, `lineFromItem`, `ProposalLine`); Task 3 (`crmPriceBook`); Task 5 (`crmProposal`, `saveProposal`, `sendProposal`, `reviseProposal`).
- Produces: `ProposalDocument(props: { title: string; client: string | null; summary: string; timeline: string; validUntil: string | null; lines: DocLine[]; children?: ReactNode })` where `DocLine = Pick<ProposalLine, "name" | "description" | "quantity" | "unit" | "unit_price_cents" | "recurring" | "price_is_from" | "includes" | "excludes" | "discount_reason">`; exported type `DocLine`.

- [ ] **Step 1: `src/components/proposal-document.tsx`**

```tsx
import type { ReactNode } from "react";
import { formatUsd, type ProposalLine } from "@/lib/proposals";

export type DocLine = Pick<
  ProposalLine,
  | "name"
  | "description"
  | "quantity"
  | "unit"
  | "unit_price_cents"
  | "recurring"
  | "price_is_from"
  | "includes"
  | "excludes"
  | "discount_reason"
>;

const UNIT: Record<string, string> = { each: "", page: " pages", town: " towns", month: " months" };

function amount(l: DocLine): string {
  return `${l.price_is_from ? "from " : ""}${formatUsd(Math.round(l.unit_price_cents * l.quantity))}`;
}

/** The client-facing proposal, shared by the public page and the staff preview,
 *  so what you preview is exactly what the client sees. */
export function ProposalDocument(props: {
  title: string;
  client: string | null;
  summary: string;
  timeline: string;
  validUntil: string | null;
  lines: DocLine[];
  children?: ReactNode;
}) {
  const oneTime = props.lines.filter((l) => !l.recurring);
  const monthly = props.lines.filter((l) => l.recurring);
  const excludes = [...new Set(props.lines.flatMap((l) => l.excludes))];
  const oneTimeCents = Math.max(
    0,
    oneTime.reduce((a, l) => a + Math.round(l.unit_price_cents * l.quantity), 0),
  );
  return (
    <article className="proposal mx-auto max-w-3xl bg-white px-6 py-10 text-ink print:px-0 print:py-0">
      <style>{`@media print { header, footer, nav, .no-print { display: none !important; } body { background: #fff; } .proposal { max-width: none; } }`}</style>
      <p className="text-[13px] font-medium text-violet">GivenTake Devs · Proposal</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.02em]">{props.title}</h1>
      {props.client && <p className="mt-1 text-sm text-muted-ink">Prepared for {props.client}</p>}

      {props.summary && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What you told us</h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{props.summary}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What we&rsquo;ll build</h2>
        <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
          {oneTime.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 py-3">
              <div>
                <p className="font-medium">
                  {l.name}
                  {l.quantity !== 1 && ` × ${l.quantity}${UNIT[l.unit] ?? ""}`}
                </p>
                {l.description && <p className="text-sm text-muted-ink">{l.description}</p>}
                {l.discount_reason && <p className="text-sm text-muted-ink">{l.discount_reason}</p>}
                {l.includes.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-ink">
                    {l.includes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="shrink-0 tabular-nums">{amount(l)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-lg font-semibold tabular-nums">
          One-time total {formatUsd(oneTimeCents)}
        </p>
      </section>

      {monthly.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Monthly, after launch</h2>
          <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
            {monthly.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{l.name}</p>
                  {l.includes.length > 0 && <p className="text-sm text-muted-ink">{l.includes.join(" · ")}</p>}
                </div>
                <p className="shrink-0 tabular-nums">{amount(l)}/mo</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {excludes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Not included</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-ink">
            {excludes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-2 text-sm sm:grid-cols-2">
        {props.timeline && (
          <p>
            <span className="font-semibold">Timeline:</span> {props.timeline}
          </p>
        )}
        {props.validUntil && (
          <p>
            <span className="font-semibold">Valid until:</span>{" "}
            {new Date(`${props.validUntil}T12:00:00`).toLocaleDateString()}
          </p>
        )}
      </section>

      {props.children}
    </article>
  );
}
```

- [ ] **Step 2: Builder `src/routes/crm.proposals.$id.tsx`**

```tsx
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { crmProposal, crmPriceBook, saveProposal, sendProposal, reviseProposal } from "@/lib/crm-data";
import {
  effectiveRate,
  formatUsd,
  lineFromItem,
  proposalTotals,
  proposalWarnings,
  type ProposalLine,
} from "@/lib/proposals";
import { PageHeader, Card, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/proposals/$id")({
  loader: async ({ params }) => ({
    proposal: await crmProposal({ data: { id: params.id } }),
    items: await crmPriceBook(),
  }),
  component: Builder,
});

const field = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm";

const blank = (patch: Partial<ProposalLine>): ProposalLine => ({
  item_key: null,
  name: "Custom item",
  description: "",
  quantity: 1,
  unit: "each",
  unit_price_cents: 0,
  recurring: false,
  price_is_from: false,
  includes: [],
  excludes: [],
  internal_hours: null,
  needs_discovery: false,
  discount_reason: null,
  ...patch,
});

function Builder() {
  const { proposal, items } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const draft = proposal.status === "draft";
  const [title, setTitle] = useState(proposal.title);
  const [summary, setSummary] = useState(proposal.summary);
  const [timeline, setTimeline] = useState(proposal.timeline);
  const [lines, setLines] = useState<ProposalLine[]>(proposal.lines);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = proposalTotals(lines);
  const rate = effectiveRate(lines);
  const warnings = proposalWarnings(lines);
  const blocking = lines.length === 0 || lines.some((l) => l.needs_discovery);
  const set = (i: number, patch: Partial<ProposalLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = () =>
    saveProposal({ data: { id: proposal.id, dealId: proposal.deal_id, title, summary, timeline, lines } });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={`Proposal v${proposal.version}`} subtitle={`${proposal.deal_name} · ${proposal.status}`} />
      <p className="mb-4 text-sm">
        <a href={`/crm/deals/${proposal.deal_id}`} className="underline underline-offset-2">
          ← Back to deal
        </a>
        {" · "}
        <a href={`/crm/proposals/${proposal.id}/preview`} className="underline underline-offset-2">
          Preview / PDF
        </a>
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <Card title="Proposal">
            <div className="space-y-3">
              <input className={field} value={title} disabled={!draft} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
              <textarea
                className={field}
                rows={3}
                value={summary}
                disabled={!draft}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What you told us: their problem, in their words"
                aria-label="What you told us"
              />
              <input
                className={field}
                value={timeline}
                disabled={!draft}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="Timeline, e.g. 3–4 weeks"
                aria-label="Timeline"
              />
            </div>
          </Card>

          <Card title="Lines">
            <ul className="space-y-3">
              {lines.map((l, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_80px_120px_auto]">
                    <input className={field} value={l.name} disabled={!draft} onChange={(e) => set(i, { name: e.target.value })} aria-label="Line name" />
                    <input
                      className={field}
                      type="number"
                      min={1}
                      value={l.quantity}
                      disabled={!draft}
                      onChange={(e) => set(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      aria-label="Quantity"
                    />
                    <input
                      className={field}
                      type="number"
                      step="1"
                      value={l.unit_price_cents / 100}
                      disabled={!draft}
                      onChange={(e) => set(i, { unit_price_cents: Math.round(Number(e.target.value) * 100) || 0, needs_discovery: false })}
                      aria-label="Unit price in dollars"
                    />
                    {draft && (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-red-600">
                        Remove
                      </button>
                    )}
                  </div>
                  {l.unit_price_cents < 0 && (
                    <input
                      className={`${field} mt-2`}
                      value={l.discount_reason ?? ""}
                      disabled={!draft}
                      onChange={(e) => set(i, { discount_reason: e.target.value })}
                      placeholder="Discount reason (required), e.g. Introductory rate: case-study permission"
                      aria-label="Discount reason"
                    />
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.recurring ? "Monthly" : "One-time"} · {formatUsd(Math.round(l.unit_price_cents * l.quantity))}
                    {l.needs_discovery && " · quote after discovery: set a price"}
                  </p>
                </li>
              ))}
            </ul>
            {draft && (
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className={`${field} max-w-xs`}
                  value=""
                  onChange={(e) => {
                    const it = items.find((x) => x.key === e.target.value);
                    if (it) setLines((ls) => [...ls, lineFromItem(it, 1)]);
                  }}
                  aria-label="Add from price book"
                >
                  <option value="">Add from price book…</option>
                  {items
                    .filter((x) => !x.archived)
                    .map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.name} · {formatUsd(x.unit_price_cents)}
                      </option>
                    ))}
                </select>
                <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => setLines((ls) => [...ls, blank({})])}>
                  Custom line
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  onClick={() => setLines((ls) => [...ls, blank({ name: "Introductory rate", unit_price_cents: -10000, discount_reason: "" })])}
                >
                  Discount
                </button>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Totals">
            <p className="flex justify-between text-sm">
              One-time <span className="font-semibold tabular-nums">{formatUsd(totals.oneTimeCents)}</span>
            </p>
            <p className="flex justify-between text-sm">
              Monthly <span className="tabular-nums">{formatUsd(totals.monthlyCents)}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {rate
                ? `${rate.hours} h · ${formatUsd(rate.rateCents)}/h effective`
                : "Add internal hours to every one-time line (in the price book) to see your effective rate."}
            </p>
            {warnings.map((w) => (
              <p key={w} className="mt-2 text-xs font-medium text-amber-700">
                {w}
              </p>
            ))}
          </Card>

          <Card title="Actions">
            <div className="flex flex-col gap-2">
              <Badge value={proposal.status} />
              {draft && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(async () => { await save(); await router.invalidate(); })}
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={busy || blocking}
                    onClick={() =>
                      run(async () => {
                        await save();
                        const { url } = await sendProposal({ data: { id: proposal.id } });
                        setLink(url);
                        await router.invalidate();
                      })
                    }
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    Send
                  </button>
                </>
              )}
              {["sent", "viewed", "declined", "expired"].includes(proposal.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { id } = await reviseProposal({ data: { id: proposal.id } });
                      await navigate({ to: "/crm/proposals/$id", params: { id } });
                    })
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium"
                >
                  Revise
                </button>
              )}
              {proposal.accepted_option && (
                <p className="text-xs">
                  Accepted ({proposal.accepted_option}) by {proposal.accepted_name}
                </p>
              )}
              {proposal.decline_reason && <p className="text-xs">Declined: {proposal.decline_reason}</p>}
            </div>
            {link && (
              <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs">
                <p className="font-medium">
                  Save this link: for security it can&rsquo;t be shown again. If it&rsquo;s lost, use Revise to send a fresh version.
                </p>
                <input readOnly className={`${field} mt-1`} value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Proposal link" />
                <div className="mt-1 flex gap-3">
                  <button type="button" onClick={() => void navigator.clipboard.writeText(link)} className="underline">
                    Copy link
                  </button>
                  <a
                    className="underline"
                    href={`mailto:?subject=${encodeURIComponent(`Your proposal from GivenTake Devs: ${title}`)}&body=${encodeURIComponent(`Here is your proposal:\n\n${link}\n\nIt's valid for 30 days. Reply with any questions.`)}`}
                  >
                    Email it
                  </a>
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2b: Show skipped scoping items.** In the builder route add `validateSearch: (s: Record<string, unknown>) => ({ skipped: typeof s.skipped === "string" ? s.skipped : "" })` to `createFileRoute(...)({ ... })`, read it with `const { skipped } = Route.useSearch();`, and render inside the Lines card, above the list: `{skipped && <p className="mb-2 text-xs text-amber-700">Not added (archived or missing from the price book): {skipped.replace(/,/g, ", ")}</p>}`. Task 6's `build()` navigates with `search: { skipped: skipped.join(",") }` (pass `search: { skipped: "" }` when empty, since the route now declares the param).

- [ ] **Step 3: Staff preview `src/routes/crm.proposals.$id.preview.tsx`** (inside the `/crm` layout, so session-gated; uses `crmProposal`, never the public RPCs, so it never marks viewed)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { crmProposal } from "@/lib/crm-data";
import { ProposalDocument } from "@/components/proposal-document";
import { formatUsd, paymentOptions } from "@/lib/proposals";

export const Route = createFileRoute("/crm/proposals/$id/preview")({
  loader: ({ params }) => crmProposal({ data: { id: params.id } }),
  component: Preview,
});

function Preview() {
  const p = Route.useLoaderData();
  const options = paymentOptions({ oneTimeCents: p.one_time_cents, monthlyCents: p.monthly_cents });
  return (
    <div>
      <p className="no-print mb-3 text-sm">
        Staff preview. Opening this does not mark the proposal as viewed.{" "}
        <button type="button" onClick={() => window.print()} className="underline">
          Download PDF
        </button>
      </p>
      <ProposalDocument
        title={p.title}
        client={p.deal_name}
        summary={p.summary}
        timeline={p.timeline}
        validUntil={p.valid_until}
        lines={p.lines}
      >
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Ways to pay</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {options.map((o) => (
              <li key={o.key}>
                <span className="font-medium">{o.label}:</span>{" "}
                {o.schedule.map((s) => `${s.label} ${formatUsd(s.amountCents)} (${s.due})`).join("; ")}
              </li>
            ))}
          </ul>
        </section>
      </ProposalDocument>
    </div>
  );
}
```

Check: TanStack nests `crm.proposals.$id.preview.tsx` under `crm.proposals.$id.tsx`. If the builder route has no `<Outlet />`, the preview won't render; in that case rename the preview file to `crm.proposals_.$id.preview.tsx` (the trailing underscore opts out of nesting) and keep the URL `/crm/proposals/$id/preview`.

- [ ] **Step 4: Verify** — tsc, eslint on new files, vitest, build (route tree regenerated).

- [ ] **Step 5: Commit**

```bash
git add src/components/proposal-document.tsx src/routes/crm.proposals* src/routeTree.gen.ts
git commit -m "feat(crm): proposal builder and staff preview"
```

---

### Task 8: Public proposal page and acceptance

**Files:**
- Create: `src/lib/proposal-public.ts`
- Create: `src/routes/proposal.$code.tsx`
- Test: `tests/components/proposal-public-route.test.tsx`

**Interfaces:**
- Consumes: RPCs `proposal_public`, `proposal_mark_viewed`, `proposal_decide` (Task 4); `ProposalDocument`, `DocLine` (Task 7); `paymentOptions`, `proposalTotals`, `formatUsd`, `PaymentOptionKey` (Task 1); `sendMail` from `@/lib/intake` (existing).
- Produces: `viewProposal({ data: { code } }) → PublicProposal | null`; `decideProposal({ data: { code, decision, option, name, reason, consent } }) → { status: string }`; `interface PublicProposal { id: string; title: string; summary: string; timeline: string; valid_until: string | null; state: "open" | "accepted" | "declined" | "expired" | "superseded"; accepted_option: string | null; client: string | null; lines: DocLine[] }`.

- [ ] **Step 1: `src/lib/proposal-public.ts`**

```ts
/**
 * Public proposal endpoints. No session: possession of the link code is the
 * credential. Only the code's sha-256 is stored, and the RPCs return
 * client-facing fields only. Nothing here may require a CRM session.
 */
import { createServerFn } from "@tanstack/react-start";
import type { DocLine } from "@/components/proposal-document";

export interface PublicProposal {
  id: string;
  title: string;
  summary: string;
  timeline: string;
  valid_until: string | null;
  state: "open" | "accepted" | "declined" | "expired" | "superseded";
  accepted_option: string | null;
  client: string | null;
  lines: DocLine[];
}

/** sendProposal issues 32 random bytes as base64url: 43 characters. */
const CODE = /^[A-Za-z0-9_-]{43}$/;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("This page is temporarily unavailable.");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // Surface only the RPC's own refusal text (raise exception ...), never internals.
    const detail = await response.text().catch(() => "");
    const message = /"message"\s*:\s*"([^"]{1,200})"/.exec(detail)?.[1];
    throw new Error(message ?? "That didn't go through. Please try again.");
  }
  return (await response.json()) as T;
}

async function hash(code: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(code).digest("hex");
}

export const viewProposal = createServerFn({ method: "GET" })
  .validator((d: { code: string }) => ({ code: String(d?.code ?? "") }))
  .handler(async ({ data }): Promise<PublicProposal | null> => {
    if (!CODE.test(data.code)) return null;
    const h = await hash(data.code);
    const p = await rpc<PublicProposal | null>("proposal_public", { p_token_hash: h });
    if (p && p.state === "open") {
      await rpc("proposal_mark_viewed", { p_token_hash: h }).catch(() => undefined);
    }
    return p;
  });

export const decideProposal = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    code: String(d?.code ?? ""),
    decision: d?.decision === "decline" ? ("decline" as const) : ("accept" as const),
    option: String(d?.option ?? ""),
    name: String(d?.name ?? "").slice(0, 200),
    reason: String(d?.reason ?? "").slice(0, 500),
    consent: d?.consent === true,
  }))
  .handler(async ({ data }): Promise<{ status: string }> => {
    if (!CODE.test(data.code)) throw new Error("This proposal link isn't valid.");
    if (data.decision === "accept" && !data.consent) {
      throw new Error("Tick the box to accept the proposal.");
    }
    const h = await hash(data.code);
    const result = await rpc<{ status: string }>("proposal_decide", {
      p_token_hash: h,
      p_decision: data.decision,
      p_option: data.option,
      p_name: data.name,
      p_reason: data.reason,
    });
    if (result.status === "accepted" || result.status === "declined") {
      await notifyOwner(h, result.status, data).catch(() => undefined);
    }
    return result;
  });

async function notifyOwner(
  tokenHash: string,
  status: string,
  data: { option: string; name: string; reason: string },
): Promise<void> {
  const p = await rpc<PublicProposal | null>("proposal_public", { p_token_hash: tokenHash });
  const { sendMail } = await import("@/lib/intake");
  const to = process.env.INTAKE_TO_EMAIL ?? "build@giventakedevs.com";
  const body =
    status === "accepted"
      ? `${p?.client ?? "A client"} accepted "${p?.title ?? "a proposal"}".\nPayment option: ${data.option}. Accepted by: ${data.name}.\nA task to send the SOW is on the Tasks page.`
      : `${p?.client ?? "A client"} declined "${p?.title ?? "a proposal"}".\nReason: ${data.reason || "(none given)"}`;
  await sendMail(to, `Proposal ${status}: ${p?.title ?? "proposal"}`, body, to);
}
```

Before relying on `import("@/lib/intake")`: confirm `sendMail` is exported (it is, `src/lib/intake.ts:180`) and that `INTAKE_TO_EMAIL` is the env var used at `src/lib/intake.ts:265`. If the build's import protection rejects this import, move `notifyOwner`'s body into `src/lib/intake.ts` as `export const notifyProposalDecision = createServerOnlyFn(async (subject: string, body: string) => { ... })` and call that.

- [ ] **Step 2: `src/routes/proposal.$code.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ProposalDocument } from "@/components/proposal-document";
import { viewProposal, decideProposal } from "@/lib/proposal-public";
import { formatUsd, paymentOptions, proposalTotals, type PaymentOptionKey, type ProposalLine } from "@/lib/proposals";

export const Route = createFileRoute("/proposal/$code")({
  head: () => ({
    meta: [
      { title: "Your proposal · GivenTake Devs" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ params }) => viewProposal({ data: { code: params.code } }),
  component: ProposalPage,
});

const MESSAGES = {
  accepted: "Thank you, this proposal is accepted. We'll send the Statement of Work to sign next.",
  declined: "This proposal was declined. If anything changes, we'd be glad to talk again.",
  expired: "This proposal has expired. Ask us for an updated one.",
  superseded: "An updated proposal was sent to you. Please use the newest link in your email.",
} as const;

type State = keyof typeof MESSAGES | "open";

export function ProposalPage() {
  const p = Route.useLoaderData();
  const { code } = Route.useParams();
  const [state, setState] = useState<State | null>(null);
  const [option, setOption] = useState<PaymentOptionKey | "">("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p) {
    return (
      <Shell>
        <p className="mx-auto max-w-xl px-6 py-24 text-center">
          This proposal link isn&rsquo;t valid. Please use the link from your email, or contact us.
        </p>
      </Shell>
    );
  }
  const current: State = state ?? p.state;
  const options = paymentOptions(proposalTotals(p.lines as ProposalLine[]));

  async function submit(decision: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const r = await decideProposal({ data: { code, decision, option, name, reason, consent } });
      setState(r.status as State);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <ProposalDocument title={p.title} client={p.client} summary={p.summary} timeline={p.timeline} validUntil={p.valid_until} lines={p.lines}>
        {current === "open" ? (
          <>
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Choose how to pay</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Payment option">
                {options.map((o) => (
                  <label
                    key={o.key}
                    className={"cursor-pointer rounded-lg border p-4 text-sm " + (option === o.key ? "border-ink ring-1 ring-ink" : "border-hairline")}
                  >
                    <input type="radio" name="option" value={o.key} checked={option === o.key} onChange={() => setOption(o.key)} className="sr-only" />
                    <p className="font-semibold">{o.label}</p>
                    <ul className="mt-2 space-y-1 text-muted-ink">
                      {o.schedule.map((s) => (
                        <li key={s.label}>
                          {formatUsd(s.amountCents)} · {s.due}
                        </li>
                      ))}
                    </ul>
                  </label>
                ))}
              </div>
            </section>
            <section className="mt-8">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <ol className="mt-2 list-decimal pl-5 text-sm text-muted-ink">
                <li>We send the Statement of Work for you to sign.</li>
                <li>The first payment, or the own-it plan&rsquo;s first month.</li>
                <li>Kickoff.</li>
              </ol>
            </section>
            <section className="no-print mt-8 rounded-lg border border-hairline p-5">
              {!declining ? (
                <>
                  <label className="block text-sm font-medium">
                    Type your full name
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-hairline px-3 py-2" />
                  </label>
                  <label className="mt-3 flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                    I accept this proposal. The work will be governed by the Statement of Work GivenTake Devs sends next.
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || !option || name.trim().length < 2 || !consent}
                      onClick={() => submit("accept")}
                      className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Accept proposal"}
                    </button>
                    <button type="button" onClick={() => window.print()} className="rounded-full border border-hairline px-5 py-2.5 text-sm">
                      Download PDF
                    </button>
                    <button type="button" onClick={() => setDeclining(true)} className="text-sm text-muted-ink underline">
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium">
                    Anything you&rsquo;d like to tell us? (optional)
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-hairline px-3 py-2" />
                  </label>
                  <div className="mt-3 flex gap-3">
                    <button type="button" disabled={busy} onClick={() => submit("decline")} className="rounded-full border border-ink px-5 py-2.5 text-sm">
                      Decline proposal
                    </button>
                    <button type="button" onClick={() => setDeclining(false)} className="text-sm underline">
                      Back
                    </button>
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
            </section>
          </>
        ) : (
          <p role="status" className="mt-10 rounded-lg bg-secondary/60 p-5 text-[15px]">
            {MESSAGES[current]}{" "}
            {current === "expired" && (
              <a href="/#contact" className="underline">
                Contact us
              </a>
            )}
          </p>
        )}
      </ProposalDocument>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
```

Confirm `SiteHeader`/`SiteFooter` export names (used this way at `src/routes/services.$slug.tsx:2`). Do not add `/proposal/` to `src/routes/sitemap[.]xml.ts`.

- [ ] **Step 3: Component test `tests/components/proposal-public-route.test.tsx`.** Open `tests/components/sign-route-refusal.test.tsx` and `vitest.config.ts` first and copy their environment and module-mock setup. Then write:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = { data: null as unknown };
vi.mock("@/lib/proposal-public", () => ({ viewProposal: vi.fn(), decideProposal: vi.fn() }));
vi.mock("@/components/site-chrome", () => ({ SiteHeader: () => null, SiteFooter: () => null }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useLoaderData: () => state.data,
    useParams: () => ({ code: "x".repeat(43) }),
  }),
}));

const { ProposalPage } = await import("../../src/routes/proposal.$code.tsx");

const proposal = (overrides = {}) => ({
  id: "p", title: "Website", summary: "", timeline: "3 weeks", valid_until: "2099-01-01",
  state: "open", accepted_option: null, client: "Sample Roofing",
  lines: [{ name: "Standard website", description: "", quantity: 1, unit: "each", unit_price_cents: 99900, recurring: false, price_is_from: false, includes: [], excludes: [], discount_reason: null }],
  ...overrides,
});

describe("public proposal page", () => {
  beforeEach(() => { state.data = null; });

  it("explains an invalid link", () => {
    render(<ProposalPage />);
    expect(screen.getByText(/isn.t valid/)).toBeTruthy();
  });

  it("shows the expired message with a contact link (Review Focus 3)", () => {
    state.data = proposal({ state: "expired" });
    render(<ProposalPage />);
    expect(screen.getByRole("status").textContent).toMatch(/expired/);
    expect(screen.getByRole("link", { name: "Contact us" })).toBeTruthy();
  });

  it("enables Accept only after option, name and consent", async () => {
    state.data = proposal();
    render(<ProposalPage />);
    const accept = screen.getByRole("button", { name: "Accept proposal" });
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByText("Pay in full"));
    await userEvent.type(screen.getByLabelText(/full name/i), "Alex Fixture");
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    expect((accept as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers own-it for a $999 site", () => {
    state.data = proposal();
    render(<ProposalPage />);
    expect(screen.getByText("Own-it plan")).toBeTruthy();
  });
});
```

If mocking `createFileRoute` this way conflicts with the setup used in `sign-route-refusal.test.tsx`, follow that file's approach instead; the four assertions stay the same. Run: `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/components/proposal-public-route.test.tsx` → PASS.

- [ ] **Step 4: Verify** — tsc, eslint, full vitest, build.

- [ ] **Step 5: Commit**

```bash
git add src/lib/proposal-public.ts "src/routes/proposal.\$code.tsx" tests/components/proposal-public-route.test.tsx src/routeTree.gen.ts
git commit -m "feat(site): public proposal page with accept, decline and PDF"
```

---

### Task 9: SOW from the accepted proposal

**Files:**
- Create: `src/lib/sow-from-proposal.ts`
- Test: `tests/sow-from-proposal.test.mjs`
- Modify: `src/lib/documents-data.ts:72-107` (`generateSowDraft`), `src/server/documents/deal-access.ts`, `src/routes/crm.deals.$id.tsx` (documents card call)

**Interfaces:**
- Consumes: Task 1 (`ProposalLine`, `PaymentOptionKey`, `paymentOptions`, `proposalTotals`, `formatUsd`).
- Produces: `applyProposalToSow(template: string, p: { summary: string; timeline: string; lines: ProposalLine[]; option: PaymentOptionKey }): string`; `generateSowDraft` accepts optional `proposalId`.

- [ ] **Step 1: Failing test** (`tests/sow-from-proposal.test.mjs`, against the real template)

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyProposalToSow } from "../src/lib/sow-from-proposal.ts";

const template = readFileSync("docs/contracts/sow-template.md", "utf8");
const line = (name, cents, extra = {}) => ({
  item_key: null, name, description: "", quantity: 1, unit: "each", unit_price_cents: cents,
  recurring: false, price_is_from: false, includes: [], excludes: [], internal_hours: null,
  needs_discovery: false, discount_reason: null, ...extra,
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
const section = (md, n, next) => md.split(new RegExp(`\\n## ${n}\\. [^\\n]*\\n`))[1].split(`\n## ${next}.`)[0];

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
  assert.match(section(applyProposalToSow(template, p), 6, 7), /Estimated overall timeline:\*\* 3–4 weeks/);
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
  const s7 = applyProposalToSow(template, { ...p, option: "own_it", lines: [line("Standard website", 99900)] }).split("## 7. Fees and payment schedule")[1];
  assert.match(s7, /12 monthly payments of \$149/);
  assert.match(s7, /\[REVIEW with attorney/);
});

test("sections 2, 5 and 8 are untouched", () => {
  const out = applyProposalToSow(template, p);
  assert.equal(section(out, 2, 3), section(template, 2, 3));
  assert.equal(section(out, 5, 6), section(template, 5, 6));
  assert.equal(section(out, 8, 9), section(template, 8, 9));
});
```

Run → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/sow-from-proposal.ts`**

```ts
/**
 * Rewrites the SOW sections an accepted proposal knows: 1 (background),
 * 3 (deliverables table), 4 (exclusions list), 6 (adds the overall timeline)
 * and the fee block of 7. Everything else keeps the template's wording for the
 * lawyer to approve once. Pure: string in, string out.
 */
import {
  OWN_IT_MONTHLY_CENTS,
  OWN_IT_MONTHS,
  formatUsd,
  paymentOptions,
  proposalTotals,
  type PaymentOptionKey,
  type ProposalLine,
} from "@/lib/proposals";

/** Replace the body between the `## <n>.` heading line and the next `## ` heading. */
function replaceSection(md: string, n: number, body: (old: string) => string): string {
  const re = new RegExp(`(\\n## ${n}\\. [^\\n]*\\n)([\\s\\S]*?)(?=\\n## )`);
  if (!re.test(md)) throw new Error(`SOW template has no section ${n}`);
  return md.replace(re, (_all, heading: string, old: string) => `${heading}${body(old)}`);
}

export function applyProposalToSow(
  template: string,
  p: { summary: string; timeline: string; lines: ProposalLine[]; option: PaymentOptionKey },
): string {
  const oneTime = p.lines.filter((l) => !l.recurring && l.unit_price_cents > 0);
  const monthly = p.lines.filter((l) => l.recurring);
  const totals = proposalTotals(p.lines);
  const excludes = [...new Set(p.lines.flatMap((l) => l.excludes))];

  let out = replaceSection(template, 1, () => `\n${p.summary.trim() || "[BACKGROUND]"}\n`);

  out = replaceSection(out, 3, (old) => {
    const marker = old.indexOf("Every project also includes");
    const standing = marker >= 0 ? old.slice(marker) : "";
    const rows = oneTime.map((l, i) => {
      const qty = l.quantity !== 1 ? ` × ${l.quantity}` : "";
      const inc = l.includes.length ? ` (${l.includes.join("; ")})` : "";
      return `| ${i + 1} | ${l.name}${qty}${inc} | Deployed + documented | [DATE] |`;
    });
    return `\n| # | Deliverable | Format | Target date |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n${standing}`;
  });

  out = replaceSection(out, 4, (old) => {
    const cut = old.indexOf("The following are");
    const intro = cut >= 0 ? old.slice(0, cut) : "\n";
    const list = [...excludes, "Anything not expressly listed in Sections 2 and 3"].map((x) => `- ${x}`);
    return `${intro}The following are **not** included and require a Change Order:\n\n${list.join("\n")}\n`;
  });

  out = replaceSection(out, 6, (old) => `\n**Estimated overall timeline:** ${p.timeline.trim() || "[TIMELINE]"}\n${old}`);

  const option = paymentOptions(totals).find((o) => o.key === p.option);
  const schedule =
    p.option === "own_it"
      ? `**Own-it plan:** $0 down, then ${OWN_IT_MONTHS} monthly payments of ${formatUsd(OWN_IT_MONTHLY_CENTS)}. Ownership of the deliverables transfers to Client after the final payment; ending early requires paying the remaining payments. [REVIEW with attorney: own-it plan terms]`
      : [
          "| Milestone | Amount | Due |",
          "| --- | --- | --- |",
          ...(option?.schedule ?? []).map((s) => `| ${s.label} | ${formatUsd(s.amountCents)} | ${s.due} |`),
        ].join("\n");
  const monthlyLine = monthly.length
    ? `\n\n**After launch (monthly):** ${monthly.map((l) => `${l.name} ${formatUsd(l.unit_price_cents)}/mo`).join("; ")}`
    : "";

  const feeBlock = /\*\*Total fee: `\$\[AMOUNT\]`\*\*[^\n]*\n\n\| Milestone[\s\S]*?\n\n/;
  if (!feeBlock.test(out)) throw new Error("SOW template fee block has changed; update applyProposalToSow");
  return out.replace(
    feeBlock,
    `**Total fee: ${formatUsd(totals.oneTimeCents)}** fixed fee\n\n${schedule}${monthlyLine}\n\n`,
  );
}
```

Run → PASS. If the fee regex doesn't match, read `docs/contracts/sow-template.md:121-133` and fix the regex to the exact text; never weaken the test.

- [ ] **Step 3: Wire into `generateSowDraft`.**
  - `src/server/documents/deal-access.ts`: add (reuses this file's `config()` and `CrmRead`; the admin actor is safe because `forDeal` has already authorised the caller for this deal)
    ```ts
    import type { PaymentOptionKey, ProposalLine } from "@/lib/proposals";

    /** The deal's accepted proposal and its lines, or null. Call only after forDeal(dealId). */
    export async function acceptedProposalForDeal(
      dealId: string,
      proposalId: string,
    ): Promise<{ summary: string; timeline: string; option: PaymentOptionKey; lines: ProposalLine[] } | null> {
      const read = new CrmRead({ ...config(), actor: { id: null, isAdmin: true } });
      const p = await read.getProposal<Record<string, unknown>>(proposalId);
      if (!p || String(p.deal_id) !== dealId || p.status !== "accepted" || !p.accepted_option) return null;
      const rows = await read.listProposalLines<Record<string, unknown>>(proposalId);
      const lines: ProposalLine[] = rows.map((r) => ({
        item_key: r.item_key == null ? null : String(r.item_key),
        name: String(r.name ?? ""),
        description: String(r.description ?? ""),
        quantity: Number(r.quantity) || 0,
        unit: String(r.unit ?? "each") as ProposalLine["unit"],
        unit_price_cents: Number(r.unit_price_cents) || 0,
        recurring: Boolean(r.recurring),
        price_is_from: Boolean(r.price_is_from),
        includes: Array.isArray(r.includes) ? r.includes.map(String) : [],
        excludes: Array.isArray(r.excludes) ? r.excludes.map(String) : [],
        internal_hours: r.internal_hours == null ? null : Number(r.internal_hours),
        needs_discovery: Boolean(r.needs_discovery),
        discount_reason: r.discount_reason == null ? null : String(r.discount_reason),
      }));
      return {
        summary: String(p.summary ?? ""),
        timeline: String(p.timeline ?? ""),
        option: String(p.accepted_option) as PaymentOptionKey,
        lines,
      };
    }
    ```
    Check `CrmActor`'s `id` type in `src/server/crm/read.ts`; if it does not accept `null`, pass the session's `userId` from `forDeal` instead (change the signature to take `actorId: string`).
  - `src/lib/documents-data.ts` `generateSowDraft`: validator adds `proposalId: d?.proposalId ? requireUuid(d.proposalId, "Proposal") : null`. In the handler, after `forDeal`, if `data.proposalId`: `const accepted = await acceptedProposalForDeal(data.dealId, data.proposalId); if (!accepted) throw new Response("That proposal isn't accepted yet", { status: 409 });` and pass `templateBody: applyProposalToSow(sowTemplate, accepted)` (import `applyProposalToSow` from `@/lib/sow-from-proposal`). Without `proposalId`, behaviour is unchanged. The attorney-review refusal still fires first because the banner stays in the template; that's expected.
  - `src/routes/crm.deals.$id.tsx`: where the documents card calls `generateSowDraft`, pass `proposalId` of the deal's accepted proposal (`deal.proposals.find((x) => x.status === "accepted")?.id`) when one exists.

- [ ] **Step 4: Verify** — tsc, unit loop, vitest, eslint, build.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sow-from-proposal.ts tests/sow-from-proposal.test.mjs src/lib/documents-data.ts src/server/documents/deal-access.ts "src/routes/crm.deals.\$id.tsx"
git commit -m "feat(documents): fill the SOW from the accepted proposal"
```

---

### Task 10: Ship

- [ ] **Step 1:** Push the branch and open the PR. The body lists the tables and RPCs added, the deploy order (apply both migrations after CI `migrations` passes, before merging), and that SOW sending stays blocked by the attorney-review banner.
- [ ] **Step 2:** When CI's `migrations` job passes, apply `20261017120000_price_book.sql` then `20261017130000_proposals.sql` to project `qsgijpsttojutuhogbns` with `apply_migration`. Verify every new RPC: `has_function_privilege('service_role', …)` is `t`, `anon`/`authenticated` are `f`; and `select count(*) from price_book_items` is 16.
- [ ] **Step 3:** Hand the merge to the owner: `! gh pr merge <n> --squash --delete-branch`.
- [ ] **Step 4:** After deploy, manual end-to-end check on prod with a deal marked synthetic: scope → build proposal → set summary/timeline → send → open the link in a private window → accept with own-it → deal value updated, "Send SOW" task on Tasks, owner email received. Then revise and confirm the old link says an updated proposal was sent. Delete the synthetic deal afterwards.

**E2E note (spec §9):** this repo's Playwright tests intercept server functions and never touch the database, and the public page loads server-side, so a DB-backed E2E can't run in CI. Task 4's Postgres integration test covers the state machine end to end, Task 8's component test covers the page states, and Task 10 Step 4 is the manual end-to-end check.
