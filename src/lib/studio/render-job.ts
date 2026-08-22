import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const text = z.string().trim().min(1).max(500);

const storyboardSceneSchema = z.object({
  order: z.number().int().positive(),
  durationSeconds: z.number().int().positive().max(60),
  purpose: z.enum(["hook", "proof", "cta"]),
  narration: text,
  prompt: text,
  safeArea: z.enum(["bottom", "center"]),
});

export const productionRenderJobSchema = z.object({
  id: z.string().trim().min(8).max(128),
  tenantId: z.string().trim().min(3).max(80),
  campaignId: z.string().trim().min(8).max(128),
  revisionId: z.string().trim().min(8).max(128),
  provider: z.string().trim().min(3).max(80),
  model: z.string().trim().min(3).max(120),
  budgetCents: z.number().int().positive().max(5_000_000),
  brand: z.object({
    name: text,
    website: z.string().trim().min(3).max(255),
    callToAction: text,
  }),
  storyboard: z.array(storyboardSceneSchema).min(1).max(12),
});

export const workerSignatureHeadersSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  requestId: z.string().trim().min(8).max(128),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export const workerStatusRequestSchema = z.object({
  tenantId: z.string().trim().min(3).max(80),
  jobId: z.string().trim().min(8).max(128),
});

export type ProductionRenderJob = z.infer<typeof productionRenderJobSchema>;
export type WorkerStatusRequest = z.infer<typeof workerStatusRequestSchema>;

export type ProviderPollResult =
  | { state: "pending"; retryAfterMs: number }
  | {
      state: "completed";
      result: {
        providerRequestId: string;
        assetUrl: string;
        durationSeconds: number;
        costCents: number;
      };
    }
  | {
      state: "failed";
      category: "provider_rejected" | "provider_failed";
      retryable: boolean;
    }
  | { state: "cancelled" };

export type ProviderCostPolicy = ReturnType<typeof createCostPolicy>;

type ProviderRates = Record<string, Record<string, number>>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createWorkerRequestSignature(
  body: unknown,
  secret: string,
  timestamp: string,
  requestId: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${stableJson(body)}`)
    .digest("hex");
}

export function createWorkerSignature(
  body: ProductionRenderJob,
  secret: string,
  timestamp: string,
  requestId: string,
): string {
  return createWorkerRequestSignature(body, secret, timestamp, requestId);
}

export function verifyWorkerSignature(
  body: ProductionRenderJob,
  signature: string,
  secret: string,
  timestamp: string,
  requestId: string,
  now = new Date(),
): boolean {
  const parsedHeaders = workerSignatureHeadersSchema.safeParse({ timestamp, requestId, signature });
  if (!parsedHeaders.success) return false;

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > 5 * 60 * 1000)
    return false;

  const expected = createWorkerRequestSignature(body, secret, timestamp, requestId);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export function createCostPolicy(rates: ProviderRates) {
  return {
    reserve(jobInput: ProductionRenderJob): number {
      const job = productionRenderJobSchema.parse(jobInput);
      const rate = rates[job.provider]?.[job.model];
      if (rate === undefined || !Number.isFinite(rate) || rate < 0)
        throw new Error(`Provider pricing is not configured for ${job.provider}/${job.model}.`);
      if (job.provider !== "fixture" && rate <= 0)
        throw new Error(`Provider pricing must be positive for ${job.provider}/${job.model}.`);

      const reservation = job.storyboard.reduce(
        (total, scene) => total + scene.durationSeconds * rate,
        0,
      );
      if (reservation > job.budgetCents)
        throw new Error("Render reservation exceeds the campaign budget.");
      return reservation;
    },
  };
}
