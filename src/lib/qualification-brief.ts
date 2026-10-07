import type { ContactInput } from "@/lib/intake-schema";
import { offers } from "@/lib/offers";

export type QualificationFlag = "regulated" | "below_minimum" | "urgent" | "uncertain_offer";

export type QualificationBrief = {
  summary: string;
  offerMatch: string;
  budget: string;
  timeline: string;
  source: string;
  missingInformation: string[];
  flags: QualificationFlag[];
  recommendedNextAction: string;
};

const regulatedPattern =
  /\b(health(?:care)?|medical|hipaa|financial|investment|securities|bank(?:ing)?|credentials?|passwords?|government|ssn|social security|tax|legal)\b/i;

const OFFER_MATCH_RULES = [
  {
    slug: "internal-dashboard",
    terms: [
      ["dashboard", 4],
      ["spreadsheet", 3],
      ["spreadsheets", 3],
      ["invoice", 3],
      ["invoices", 3],
      ["job status", 3],
      ["status tracking", 2],
      ["internal reporting", 2],
    ],
  },
  {
    slug: "ai-lead-intake",
    terms: [
      ["lead intake", 4],
      ["lead routing", 4],
      ["route leads", 3],
      ["routing", 3],
      ["enquiry", 2],
      ["enquiries", 2],
      ["inquiry", 2],
      ["inquiries", 2],
      ["classify", 2],
      ["classification", 2],
      ["form submission", 2],
    ],
  },
  {
    slug: "booking-and-payments",
    terms: [
      ["booking", 4],
      ["appointment scheduling", 4],
      ["appointments", 3],
      ["scheduling", 3],
      ["reschedule", 3],
      ["deposit", 2],
      ["deposits", 2],
      ["no show", 2],
    ],
  },
  {
    slug: "marketing-site",
    terms: [
      ["marketing website", 4],
      ["marketing site", 4],
      ["website", 3],
      ["cms", 3],
      ["content management", 3],
      ["landing page", 3],
      ["seo", 2],
    ],
  },
  {
    slug: "business-automation",
    terms: [
      ["process automation", 4],
      ["workflow automation", 4],
      ["automate", 3],
      ["automation", 3],
      ["data entry", 3],
      ["document assembly", 3],
      ["manual process", 3],
      ["repetitive", 2],
    ],
  },
  {
    slug: "mvp-development",
    terms: [
      ["mvp", 4],
      ["minimum viable product", 4],
      ["prototype", 3],
      ["validate idea", 3],
      ["product idea", 3],
      ["real users", 2],
    ],
  },
] as const;

const OFFER_MATCH_THRESHOLD = 2;

function includesTerm(description: string, term: string) {
  return ` ${description} `.includes(` ${term} `);
}

function matchOffer(description: string) {
  const normalized = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let bestSlug: string | undefined;
  let bestScore = 0;
  let tied = false;

  for (const rule of OFFER_MATCH_RULES) {
    const score = rule.terms.reduce(
      (total, [term, weight]) => total + (includesTerm(normalized, term) ? weight : 0),
      0,
    );
    if (score > bestScore) {
      bestSlug = rule.slug;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score >= OFFER_MATCH_THRESHOLD) {
      tied = true;
    }
  }

  if (!bestSlug || bestScore < OFFER_MATCH_THRESHOLD || tied) return "Uncertain";
  return offers.find((offer) => offer.slug === bestSlug)?.title ?? "Uncertain";
}

export function createQualificationBrief(input: ContactInput): QualificationBrief {
  const flags: QualificationFlag[] = [];
  const missingInformation: string[] = [];
  const offerMatch = matchOffer(input.description);

  if (offerMatch === "Uncertain") flags.push("uncertain_offer");
  // Builds start at $499, so the $500-$2.5k band is the core buyer, not a
  // disqualification. No listed band now falls under the starting price, so
  // nothing produces below_minimum; the flag stays in the union for leads
  // recorded before the pricing change.
  if (input.budget === "discovery") missingInformation.push("Budget range");
  if (input.timeline === "asap") flags.push("urgent");
  if (regulatedPattern.test(input.description)) flags.push("regulated");
  if (!input.company) missingInformation.push("Company");
  if (
    !input.source_detail &&
    (input.source === "warm_network" || input.source === "referral_partner")
  ) {
    missingInformation.push("Referral name or source detail");
  }

  const recommendedNextAction = flags.includes("regulated")
    ? "Human review before any substantive reply"
    : "Human to send a short acknowledgement and schedule discovery";

  return {
    summary: input.description.slice(0, 240),
    offerMatch,
    budget: input.budget,
    timeline: input.timeline,
    source: input.source,
    missingInformation,
    flags,
    recommendedNextAction,
  };
}
