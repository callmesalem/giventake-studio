import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  requireClientOwnerContext,
  requireTenantContext,
} from "@/features/tenants/tenant-context.server";
import type { Json } from "@/lib/database.types";
import { createJobSupabase, createUserSupabase } from "@/lib/server/supabase.server";
import { resolveAttribution } from "./attribution";
import {
  ATTRIBUTION_CONFIDENCES,
  attributionLeadInputSchema,
  correctionInputSchema,
  type AttributionCorrectionView,
  type AttributionDecision,
  type AttributionReason,
  type AttributionTouchResult,
  type StoredAttributionEvidence,
} from "./attribution.types";

const uuid = z.string().uuid();

export class AttributionNotFoundError extends Error {
  readonly code = "ATTRIBUTION_NOT_FOUND";

  constructor() {
    super("ATTRIBUTION_NOT_FOUND");
    this.name = "AttributionNotFoundError";
  }
}

export class AttributionRecomputeFailedError extends Error {
  readonly code = "ATTRIBUTION_RECOMPUTE_FAILED";

  constructor(
    readonly generation: string,
    readonly claimToken: string,
    options?: ErrorOptions,
  ) {
    super("ATTRIBUTION_RECOMPUTE_FAILED", options);
    this.name = "AttributionRecomputeFailedError";
  }
}

const generation = z.string().regex(/^[1-9][0-9]*$/);
const claimEvidenceSchema = z
  .object({
    id: uuid,
    occurred_at: z.string().datetime({ offset: true }),
    declared_source: z.string().max(80).nullable(),
    click_ids: z.record(z.string(), z.string().nullable()),
    utm_source: z.string().max(200).nullable(),
    utm_campaign: z.string().max(200).nullable(),
    referrer_domain: z.string().max(200).nullable(),
  })
  .strict();
const attributionJobClaimSchema = z
  .object({
    tenant_id: uuid,
    lead_id: uuid,
    generation,
    claim_token: uuid,
    submitted_at: z.string().datetime({ offset: true }),
    evidence: z.array(claimEvidenceSchema),
  })
  .strict();

export type AttributionJobClaim = {
  tenantId: string;
  leadId: string;
  generation: string;
  claimToken: string;
  submittedAt: string;
  evidence: StoredAttributionEvidence[];
};

export function parseAttributionJobClaim(value: unknown): AttributionJobClaim {
  const parsed = attributionJobClaimSchema.parse(value);
  return {
    tenantId: parsed.tenant_id,
    leadId: parsed.lead_id,
    generation: parsed.generation,
    claimToken: parsed.claim_token,
    submittedAt: parsed.submitted_at,
    evidence: parsed.evidence.map((item) => ({
      id: item.id,
      occurredAt: item.occurred_at,
      declaredSource: item.declared_source,
      clickIds: item.click_ids as StoredAttributionEvidence["clickIds"],
      utmSource: item.utm_source,
      utmCampaign: item.utm_campaign,
      referrerDomain: item.referrer_domain,
    })),
  };
}

export function isAttributionRecomputeFailedError(
  value: unknown,
): value is AttributionRecomputeFailedError {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.code === "ATTRIBUTION_RECOMPUTE_FAILED" &&
    typeof record.generation === "string" &&
    generation.safeParse(record.generation).success &&
    typeof record.claimToken === "string" &&
    uuid.safeParse(record.claimToken).success
  );
}

export function selectAttributionEvidence(
  evidence: StoredAttributionEvidence[],
  submittedAt: string,
): { first: StoredAttributionEvidence | null; last: StoredAttributionEvidence | null } {
  const submissionTime = Date.parse(submittedAt);
  if (Number.isNaN(submissionTime)) throw new Error("Invalid lead submission timestamp");
  const accepted = evidence
    .filter((item) => {
      const occurredAt = Date.parse(item.occurredAt);
      return !Number.isNaN(occurredAt) && occurredAt <= submissionTime;
    })
    .sort((left, right) => {
      const chronology = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
      return chronology || left.id.localeCompare(right.id);
    });
  return { first: accepted[0] ?? null, last: accepted.at(-1) ?? null };
}

type RecomputedTouch = { evidenceId: string; decision: AttributionDecision };
export type RecomputeTransaction = {
  tenantId: string;
  leadId: string;
  generation: string;
  claimToken: string;
  requestId: string;
  first: RecomputedTouch;
  last: RecomputedTouch;
};

export type RecomputeResult = { completed: boolean; stale: boolean };

type RecomputeDependencies = {
  claimSnapshot: (tenantId: string, leadId: string) => Promise<AttributionJobClaim | null>;
  applyRecomputation: (input: RecomputeTransaction) => Promise<RecomputeResult>;
  requestId: () => string;
};

export function buildAttributionRecomputation(
  claim: AttributionJobClaim,
  requestId: string,
): RecomputeTransaction {
  const selected = selectAttributionEvidence(claim.evidence, claim.submittedAt);
  if (!selected.first || !selected.last) throw new AttributionNotFoundError();
  return {
    tenantId: claim.tenantId,
    leadId: claim.leadId,
    generation: claim.generation,
    claimToken: claim.claimToken,
    requestId,
    first: {
      evidenceId: selected.first.id,
      decision: resolveAttribution(selected.first),
    },
    last: {
      evidenceId: selected.last.id,
      decision: resolveAttribution(selected.last),
    },
  };
}

export async function recomputeLeadAttributionWith(
  tenantId: string,
  leadId: string,
  dependencies: RecomputeDependencies,
): Promise<void> {
  const parsedTenantId = uuid.parse(tenantId);
  const parsedLeadId = uuid.parse(leadId);
  const claim = await dependencies.claimSnapshot(parsedTenantId, parsedLeadId);
  if (!claim) throw new AttributionNotFoundError();
  try {
    await dependencies.applyRecomputation(
      buildAttributionRecomputation(claim, dependencies.requestId()),
    );
  } catch (cause) {
    throw new AttributionRecomputeFailedError(claim.generation, claim.claimToken, { cause });
  }
}

export function decisionJson(decision: AttributionDecision): Json {
  return {
    source: decision.source,
    campaign_external_id: decision.campaignExternalId,
    confidence: decision.confidence,
    state: decision.state,
    reason_codes: decision.reasonCodes,
  };
}

export async function applyAttributionRecomputation(
  input: RecomputeTransaction,
): Promise<RecomputeResult> {
  const { data, error } = await createJobSupabase().rpc("apply_attribution_recomputation", {
    target_tenant: input.tenantId,
    target_lead: input.leadId,
    processed_generation: input.generation,
    job_claim_token: input.claimToken,
    first_evidence_id: input.first.evidenceId,
    first_decision: decisionJson(input.first.decision),
    last_evidence_id: input.last.evidenceId,
    last_decision: decisionJson(input.last.decision),
    event_request_id: input.requestId,
  });
  if (error) throw error;
  const result = asRecord(data);
  return { completed: result?.completed === true, stale: result?.stale === true };
}

export async function recomputeLeadAttribution(tenantId: string, leadId: string): Promise<void> {
  const job = createJobSupabase();
  return recomputeLeadAttributionWith(tenantId, leadId, {
    requestId: randomUUID,
    async claimSnapshot(scopedTenantId, scopedLeadId) {
      const { data, error } = await job.rpc("claim_attribution_recompute_job", {
        target_tenant: scopedTenantId,
        target_lead: scopedLeadId,
        claimed_at: new Date().toISOString(),
      });
      if (error) throw error;
      return data === null ? null : parseAttributionJobClaim(data);
    },
    applyRecomputation: applyAttributionRecomputation,
  });
}

type CorrectionTransactionInput = {
  tenantId: string;
  leadId: string;
  originalComputedTouchId: string;
  actorId: string;
  source: string;
  campaignExternalId: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  requestId: string;
};

type CorrectionDependencies = {
  requireOwner: () => Promise<{ tenantId: string; userId: string }>;
  correct: (input: CorrectionTransactionInput) => Promise<AttributionCorrectionView | null>;
  requestId: () => string;
};

export async function correctAttributionWith(
  input: unknown,
  dependencies: CorrectionDependencies,
): Promise<AttributionCorrectionView> {
  const context = await dependencies.requireOwner();
  const parsed = correctionInputSchema.parse(input);
  const result = await dependencies.correct({
    tenantId: context.tenantId,
    leadId: parsed.leadId,
    originalComputedTouchId: parsed.originalComputedTouchId,
    actorId: context.userId,
    source: parsed.source,
    campaignExternalId: parsed.campaignExternalId,
    confidence: parsed.confidence,
    reason: parsed.reason,
    requestId: dependencies.requestId(),
  });
  if (!result) throw new AttributionNotFoundError();
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseTouch(value: unknown): AttributionTouchResult | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    (record.source !== null && typeof record.source !== "string") ||
    (record.campaign_external_id !== null && typeof record.campaign_external_id !== "string") ||
    !ATTRIBUTION_CONFIDENCES.includes(record.confidence as never) ||
    !["attributed", "ambiguous", "unattributed"].includes(String(record.state)) ||
    !Array.isArray(record.reason_codes) ||
    !record.reason_codes.every((reason) => typeof reason === "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    source: record.source as string | null,
    campaignExternalId: record.campaign_external_id as string | null,
    confidence: record.confidence as AttributionTouchResult["confidence"],
    state: record.state as AttributionTouchResult["state"],
    reasonCodes: record.reason_codes as AttributionReason[],
  };
}

function parseCorrection(value: unknown): AttributionCorrectionView | null {
  const record = asRecord(value);
  const original = parseTouch(record?.original);
  const correction = parseTouch(record?.correction);
  const correctionRecord = asRecord(record?.correction);
  if (!original || !correction || typeof correctionRecord?.reason !== "string") return null;
  return { original, correction: { ...correction, reason: correctionRecord.reason } };
}

export async function correctAttribution(input: unknown): Promise<AttributionCorrectionView> {
  return correctAttributionWith(input, {
    requireOwner: requireClientOwnerContext,
    requestId: randomUUID,
    async correct(transaction) {
      const { data, error } = await createUserSupabase().rpc("correct_attribution", {
        target_tenant: transaction.tenantId,
        target_lead: transaction.leadId,
        original_touch_id: transaction.originalComputedTouchId,
        correction_source: transaction.source,
        correction_campaign_external_id: transaction.campaignExternalId ?? "",
        correction_confidence: transaction.confidence,
        correction_reason: transaction.reason,
        event_request_id: transaction.requestId,
      });
      if (error) throw error;
      return parseCorrection(data);
    },
  });
}

export async function recomputeCurrentOwnerAttribution(input: unknown): Promise<{ updated: true }> {
  const context = await requireClientOwnerContext();
  const parsed = attributionLeadInputSchema.parse(input);
  await recomputeLeadAttribution(context.tenantId, parsed.leadId);
  return { updated: true };
}

export async function getLeadAttribution(input: unknown) {
  const context = await requireTenantContext();
  const parsed = attributionLeadInputSchema.parse(input);
  const { data, error } = await createUserSupabase().rpc("get_lead_attribution", {
    target_tenant: context.tenantId,
    target_lead: parsed.leadId,
  });
  if (error) throw error;
  if (data === null) throw new AttributionNotFoundError();
  return data;
}
