import { describe, expect, it } from "vitest";
import {
  handleAttributionJobsRequestWith,
  processAttributionRetryBatchWith,
  type AttributionJobClaim,
} from "./attribution.worker.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LEAD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CLAIM_TOKEN = "d1000000-0000-0000-0000-000000000001";
const EVIDENCE_ID = "e1000000-0000-0000-0000-000000000001";

const claim: AttributionJobClaim = {
  tenantId: TENANT_ID,
  leadId: LEAD_ID,
  generation: "8",
  claimToken: CLAIM_TOKEN,
  submittedAt: "2026-08-09T16:00:00.000Z",
  evidence: [
    {
      id: EVIDENCE_ID,
      occurredAt: "2026-08-09T15:00:00.000Z",
      declaredSource: "referral",
      clickIds: {},
      utmSource: null,
      utmCampaign: null,
      referrerDomain: null,
    },
  ],
};

describe("attribution retry worker", () => {
  it("processes a bounded claim batch and reports only aggregate outcomes", async () => {
    const result = await processAttributionRetryBatchWith({
      claim: async (batchSize) => {
        expect(batchSize).toBe(10);
        return [claim, { ...claim, leadId: "c2000000-0000-0000-0000-000000000002" }];
      },
      apply: async (input) => {
        if (input.leadId.endsWith("0002")) throw new Error("person@example.com provider body");
        return { completed: true, stale: false };
      },
      fail: async (input) => {
        expect(input).toEqual({
          tenantId: TENANT_ID,
          leadId: "c2000000-0000-0000-0000-000000000002",
          generation: "8",
          claimToken: CLAIM_TOKEN,
          requestId: "f1000000-0000-0000-0000-000000000002",
          failureCode: "RECOMPUTE_FAILED",
        });
        return { status: "failed" };
      },
      requestId: (() => {
        let next = 0;
        return () =>
          next++ === 0
            ? "f1000000-0000-0000-0000-000000000001"
            : "f1000000-0000-0000-0000-000000000002";
      })(),
    });

    expect(result).toEqual({ claimed: 2, succeeded: 1, retryScheduled: 1, exhausted: 0 });
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it("counts stale claims as preserved work instead of success", async () => {
    const result = await processAttributionRetryBatchWith({
      claim: async () => [claim],
      apply: async () => ({ completed: false, stale: true }),
      fail: async () => {
        throw new Error("stale work must not be failed");
      },
      requestId: () => "f1000000-0000-0000-0000-000000000001",
    });

    expect(result).toEqual({ claimed: 1, succeeded: 0, retryScheduled: 0, exhausted: 0 });
  });
});

describe("attribution retry endpoint", () => {
  it("requires a bearer secret and returns privacy-safe aggregate counts", async () => {
    const run = async () => ({ claimed: 1, succeeded: 1, retryScheduled: 0, exhausted: 0 });
    const unauthorized = await handleAttributionJobsRequestWith(
      new Request("https://growth.example/api/jobs/attribution", { method: "POST" }),
      { secret: "scheduler-secret-at-least-32-bytes", run },
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await handleAttributionJobsRequestWith(
      new Request("https://growth.example/api/jobs/attribution", {
        method: "POST",
        headers: { authorization: "Bearer scheduler-secret-at-least-32-bytes" },
      }),
      { secret: "scheduler-secret-at-least-32-bytes", run },
    );
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({
      claimed: 1,
      succeeded: 1,
      retryScheduled: 0,
      exhausted: 0,
    });
  });

  it("returns a fixed unavailable response without exposing worker failures", async () => {
    const response = await handleAttributionJobsRequestWith(
      new Request("https://growth.example/api/jobs/attribution", {
        method: "POST",
        headers: { authorization: "Bearer scheduler-secret-at-least-32-bytes" },
      }),
      {
        secret: "scheduler-secret-at-least-32-bytes",
        run: async () => {
          throw new Error("person@example.com raw database failure");
        },
      },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"JOB_UNAVAILABLE"}');
  });
});
