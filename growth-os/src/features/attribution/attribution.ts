import {
  CLICK_ID_KEYS,
  type AttributionConfidence,
  type AttributionDecision,
  type AttributionEvidence,
  type AttributionReason,
  type ClickIdKey,
} from "./attribution.types";

const SOURCE_MAP = new Map<string, string>([
  ["google", "google_ads"],
  ["google ads", "google_ads"],
  ["google_ads", "google_ads"],
  ["facebook", "meta_ads"],
  ["instagram", "meta_ads"],
  ["meta", "meta_ads"],
  ["meta ads", "meta_ads"],
  ["meta_ads", "meta_ads"],
  ["referral", "referral"],
  ["organic", "organic"],
  ["direct", "direct"],
  ["other", "other"],
]);

const CLICK_PROVIDER: Record<ClickIdKey, "google_ads" | "meta_ads"> = {
  gclid: "google_ads",
  gbraid: "google_ads",
  wbraid: "google_ads",
  fbclid: "meta_ads",
};

function sanitize(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const sanitized = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, 200);
  return sanitized || null;
}

function validClickReference(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.length > 200) return false;
  return sanitize(value) !== null;
}

function normalizeSource(value: string): string {
  return SOURCE_MAP.get(value.toLowerCase()) ?? "other";
}

function baseDeclaredConfidence(source: string): AttributionConfidence {
  return source === "direct" || source === "other" ? "low" : "high";
}

function dropConfidence(confidence: AttributionConfidence): AttributionConfidence {
  if (confidence === "high") return "medium";
  return "low";
}

function clickSignals(evidence: AttributionEvidence) {
  return CLICK_ID_KEYS.flatMap((key) =>
    validClickReference(evidence.clickIds?.[key]) ? [{ key, provider: CLICK_PROVIDER[key] }] : [],
  );
}

function referrerDecision(domainValue: string): AttributionDecision {
  const domain = domainValue
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (domain === "google.com" || domain.endsWith(".google.com")) {
    return {
      source: "google_organic",
      campaignExternalId: null,
      confidence: "low",
      state: "attributed",
      reasonCodes: ["referrer_domain:google"],
    };
  }
  if (
    domain === "facebook.com" ||
    domain.endsWith(".facebook.com") ||
    domain === "instagram.com" ||
    domain.endsWith(".instagram.com")
  ) {
    return {
      source: "meta_organic",
      campaignExternalId: null,
      confidence: "low",
      state: "attributed",
      reasonCodes: ["referrer_domain:meta"],
    };
  }
  return {
    source: "referral",
    campaignExternalId: null,
    confidence: "low",
    state: "attributed",
    reasonCodes: ["referrer_domain:other"],
  };
}

export function resolveAttribution(evidence: AttributionEvidence): AttributionDecision {
  const declared = sanitize(evidence.declaredSource);
  const clicks = clickSignals(evidence);

  if (declared) {
    const source = normalizeSource(declared.toLowerCase());
    const conflictingClicks = clicks.filter((click) => click.provider !== source);
    const confidence = baseDeclaredConfidence(source);
    return {
      source,
      campaignExternalId: null,
      confidence: conflictingClicks.length > 0 ? dropConfidence(confidence) : confidence,
      state: conflictingClicks.length > 0 ? "ambiguous" : "attributed",
      reasonCodes: [
        `declared_source:${source}`,
        ...conflictingClicks.map((click) => `click_id:${click.key}` as AttributionReason),
      ],
    };
  }

  if (clicks.length > 0) {
    const selected = clicks[0]!;
    const conflictingProviders = new Set(clicks.map((click) => click.provider)).size > 1;
    return {
      source: selected.provider,
      campaignExternalId: null,
      confidence: conflictingProviders ? "medium" : "high",
      state: conflictingProviders ? "ambiguous" : "attributed",
      reasonCodes: clicks.map((click) => `click_id:${click.key}` as AttributionReason),
    };
  }

  const utmSource = sanitize(evidence.utmSource);
  const utmCampaign = sanitize(evidence.utmCampaign);
  if (utmSource || utmCampaign) {
    const source = utmSource ? normalizeSource(utmSource.toLowerCase()) : "other";
    return {
      source,
      campaignExternalId: utmCampaign,
      confidence: "medium",
      state: "attributed",
      reasonCodes: utmSource ? [`utm_source:${source}`] : ["utm_campaign"],
    };
  }

  const referrerDomain = sanitize(evidence.referrerDomain);
  if (referrerDomain) return referrerDecision(referrerDomain);

  return {
    source: null,
    campaignExternalId: null,
    confidence: "low",
    state: "unattributed",
    reasonCodes: ["direct_or_unknown"],
  };
}
