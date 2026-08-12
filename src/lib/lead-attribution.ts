export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "referrer",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type LeadAttribution = Partial<Record<AttributionKey, string>>;

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

export function readLeadAttribution(): LeadAttribution {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const attribution: LeadAttribution = {};

  for (const key of ATTRIBUTION_KEYS) {
    if (key === "referrer") continue;
    const value = clean(params.get(key));
    if (value) attribution[key] = value;
  }

  const referrer = clean(document.referrer);
  if (referrer) attribution.referrer = referrer;

  return attribution;
}
