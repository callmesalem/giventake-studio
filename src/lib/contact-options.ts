export const CONTACT_SOURCE_VALUES = [
  "warm_network",
  "referral_partner",
  "google_search",
  "linkedin",
  "direct",
  "article_or_content",
  "other",
] as const;

type ContactSource = (typeof CONTACT_SOURCE_VALUES)[number];

export const CONTACT_SOURCE_OPTIONS = [
  { value: "warm_network", label: "Someone I know / warm referral" },
  { value: "referral_partner", label: "Referral partner" },
  { value: "google_search", label: "Google or search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Typed the website directly" },
  { value: "article_or_content", label: "Article or content" },
  { value: "other", label: "Other" },
] as const satisfies readonly { value: ContactSource; label: string }[];

export const CONTACT_BUDGET_VALUES = [
  "discovery",
  "500-2.5k",
  "2.5-10k",
  "10-25k",
  "25-75k",
  "75k+",
  "retainer",
] as const;

type ContactBudget = (typeof CONTACT_BUDGET_VALUES)[number];

// Enum values are stable on purpose: they are stored on existing lead records,
// so labels change with the pricing model and values never do.
export const CONTACT_BUDGET_OPTIONS = [
  { value: "discovery", label: "Not sure yet, I want a quote first" },
  { value: "500-2.5k", label: "$500 to $2.5k" },
  { value: "2.5-10k", label: "$2.5k to $10k" },
  { value: "10-25k", label: "$10k to $25k" },
  { value: "25-75k", label: "$25k to $75k" },
  { value: "75k+", label: "$75k+" },
  { value: "retainer", label: "Care plan ($99/mo)" },
] as const satisfies readonly { value: ContactBudget; label: string }[];

export const CONTACT_TIMELINE_VALUES = ["asap", "1-3mo", "3-6mo", "exploring"] as const;

type ContactTimeline = (typeof CONTACT_TIMELINE_VALUES)[number];

export const CONTACT_TIMELINE_OPTIONS = [
  { value: "asap", label: "ASAP" },
  { value: "1-3mo", label: "1 to 3 months" },
  { value: "3-6mo", label: "3 to 6 months" },
  { value: "exploring", label: "Just exploring" },
] as const satisfies readonly { value: ContactTimeline; label: string }[];

const sourceValues = new Set<string>(CONTACT_SOURCE_VALUES);
const budgetValues = new Set<string>(CONTACT_BUDGET_VALUES);
const timelineValues = new Set<string>(CONTACT_TIMELINE_VALUES);

export function isContactSource(value: unknown): value is ContactSource {
  return typeof value === "string" && sourceValues.has(value);
}

export function isContactBudget(value: unknown): value is ContactBudget {
  return typeof value === "string" && budgetValues.has(value);
}

export function isContactTimeline(value: unknown): value is ContactTimeline {
  return typeof value === "string" && timelineValues.has(value);
}
