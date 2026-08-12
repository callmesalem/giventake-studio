import "@tanstack/react-start/server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createJobSupabase } from "@/lib/server/supabase.server";
import {
  applyAttributionRecomputation,
  buildAttributionRecomputation,
  parseAttributionJobClaim,
  type AttributionJobClaim,
  type RecomputeResult,
  type RecomputeTransaction,
} from "./attribution.server";

export type { AttributionJobClaim } from "./attribution.server";

const MAX_BATCH_SIZE = 10;
const failureResultSchema = z.object({ status: z.enum(["failed", "exhausted", "stale"]) }).strict();

type FailureInput = {
  tenantId: string;
  leadId: string;
  generation: string;
  claimToken: string;
  requestId: string;
  failureCode: "RECOMPUTE_FAILED";
};

type RetryWorkerDependencies = {
  claim: (batchSize: number) => Promise<AttributionJobClaim[]>;
  apply: (input: RecomputeTransaction) => Promise<RecomputeResult>;
  fail: (input: FailureInput) => Promise<{ status: "failed" | "exhausted" | "stale" }>;
  requestId: () => string;
};

export type AttributionRetryBatchResult = {
  claimed: number;
  succeeded: number;
  retryScheduled: number;
  exhausted: number;
};

export async function processAttributionRetryBatchWith(
  dependencies: RetryWorkerDependencies,
): Promise<AttributionRetryBatchResult> {
  const claims = await dependencies.claim(MAX_BATCH_SIZE);
  const result: AttributionRetryBatchResult = {
    claimed: claims.length,
    succeeded: 0,
    retryScheduled: 0,
    exhausted: 0,
  };

  for (const claim of claims) {
    const requestId = dependencies.requestId();
    try {
      const applied = await dependencies.apply(buildAttributionRecomputation(claim, requestId));
      if (applied.completed) result.succeeded += 1;
    } catch {
      const failure = await dependencies.fail({
        tenantId: claim.tenantId,
        leadId: claim.leadId,
        generation: claim.generation,
        claimToken: claim.claimToken,
        requestId,
        failureCode: "RECOMPUTE_FAILED",
      });
      if (failure.status === "failed") result.retryScheduled += 1;
      if (failure.status === "exhausted") result.exhausted += 1;
    }
  }

  return result;
}

export async function processAttributionRetryBatch(): Promise<AttributionRetryBatchResult> {
  const job = createJobSupabase();
  return processAttributionRetryBatchWith({
    requestId: randomUUID,
    async claim(batchSize) {
      const { data, error } = await job.rpc("claim_attribution_recompute_jobs", {
        batch_size: batchSize,
        claimed_at: new Date().toISOString(),
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Invalid attribution claim response");
      return data.map(parseAttributionJobClaim);
    },
    apply: applyAttributionRecomputation,
    async fail(input) {
      const { data, error } = await job.rpc("record_attribution_recompute_failure", {
        target_tenant: input.tenantId,
        target_lead: input.leadId,
        processed_generation: input.generation,
        job_claim_token: input.claimToken,
        event_request_id: input.requestId,
        failed_at: new Date().toISOString(),
      });
      if (error) throw error;
      return failureResultSchema.parse(data);
    },
  });
}

type AttributionJobHandlerDependencies = {
  secret: string | undefined;
  run: () => Promise<AttributionRetryBatchResult>;
};

function authorized(presented: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !presented?.startsWith("Bearer ")) return false;
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const presentedDigest = createHash("sha256").update(presented.slice(7), "utf8").digest();
  return timingSafeEqual(expectedDigest, presentedDigest);
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function handleAttributionJobsRequestWith(
  request: Request,
  dependencies: AttributionJobHandlerDependencies,
): Promise<Response> {
  if (!authorized(request.headers.get("authorization"), dependencies.secret)) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }
  try {
    return jsonResponse(await dependencies.run(), 200);
  } catch {
    return jsonResponse({ error: "JOB_UNAVAILABLE" }, 503);
  }
}

export function handleAttributionJobsRequest(request: Request): Promise<Response> {
  return handleAttributionJobsRequestWith(request, {
    secret: process.env.ATTRIBUTION_JOB_SECRET,
    run: processAttributionRetryBatch,
  });
}
