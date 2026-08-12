import { z } from "zod";

export const ATTRIBUTION_CONFIDENCES = ["high", "medium", "low"] as const;
export type AttributionConfidence = (typeof ATTRIBUTION_CONFIDENCES)[number];

export const ATTRIBUTION_STATES = ["attributed", "ambiguous", "unattributed"] as const;
export type AttributionState = (typeof ATTRIBUTION_STATES)[number];

export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

export type AttributionReason =
  | `declared_source:${string}`
  | `click_id:${ClickIdKey}`
  | `utm_source:${string}`
  | "utm_campaign"
  | `referrer_domain:${string}`
  | "direct_or_unknown"
  | "manual_correction";

export type AttributionEvidence = {
  declaredSource?: string | null;
  clickIds?: Partial<Record<ClickIdKey, string | null>>;
  utmSource?: string | null;
  utmCampaign?: string | null;
  referrerDomain?: string | null;
};

export type AttributionDecision = {
  source: string | null;
  campaignExternalId: string | null;
  confidence: AttributionConfidence;
  state: AttributionState;
  reasonCodes: AttributionReason[];
};

export type StoredAttributionEvidence = AttributionEvidence & {
  id: string;
  occurredAt: string;
};

export type AttributionModel = "first_touch" | "last_touch";

export type AttributionTouchResult = AttributionDecision & {
  id: string;
};

export type AttributionCorrectionView = {
  original: AttributionTouchResult;
  correction: AttributionTouchResult & { reason: string };
};

const uuid = z.string().uuid();
const safeSource = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
const containsControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
const safeCampaign = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !containsControlCharacter(value))
  .nullable();
const manualReason = z
  .string()
  .trim()
  .min(10)
  .max(500)
  .refine((value) => !containsControlCharacter(value));

export const attributionLeadInputSchema = z.object({ leadId: uuid }).strict();
export const correctionInputSchema = z
  .object({
    leadId: uuid,
    originalComputedTouchId: uuid,
    source: safeSource,
    campaignExternalId: safeCampaign,
    confidence: z.enum(ATTRIBUTION_CONFIDENCES),
    reason: manualReason,
  })
  .strict();

export type AttributionCorrectionInput = z.infer<typeof correctionInputSchema>;
