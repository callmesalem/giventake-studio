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
  /\b(health|medical|hipaa|financial|investment|securities|bank|credential|password|government|ssn|social security|tax|legal)\b/i;

function matchOffer(description: string) {
  const normalized = description.toLowerCase();
  const offer = offers.find((candidate) => {
    const haystack =
      `${candidate.title} ${candidate.tagline} ${candidate.problem.join(" ")} ${candidate.outcome}`.toLowerCase();
    return haystack
      .split(/\W+/)
      .filter((word) => word.length > 5)
      .some((word) => normalized.includes(word));
  });

  return offer?.title ?? "Uncertain";
}

export function createQualificationBrief(input: ContactInput): QualificationBrief {
  const flags: QualificationFlag[] = [];
  const missingInformation: string[] = [];
  const offerMatch = matchOffer(input.description);

  if (offerMatch === "Uncertain") flags.push("uncertain_offer");
  if (input.budget === "500-2.5k" || input.budget === "discovery") flags.push("below_minimum");
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
