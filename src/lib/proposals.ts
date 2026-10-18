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

export function proposalTotals(lines: ProposalLine[]): {
  oneTimeCents: number;
  monthlyCents: number;
} {
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

export function paymentOptions(totals: {
  oneTimeCents: number;
  monthlyCents: number;
}): PaymentOption[] {
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
