import { describe, expect, it, vi } from "vitest";
import { getOverviewWith, overviewDateRangeSchema } from "./overview.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("overview input", () => {
  it("accepts an inclusive date range and rejects invalid or excessive ranges", () => {
    expect(
      overviewDateRangeSchema.parse({
        from: "2026-08-01",
        to: "2026-08-08",
        model: "first_touch",
      }),
    ).toEqual({ from: "2026-08-01", to: "2026-08-08", model: "first_touch" });
    expect(() =>
      overviewDateRangeSchema.parse({
        from: "2026-08-08",
        to: "2026-08-01",
        model: "last_touch",
      }),
    ).toThrow();
    expect(() =>
      overviewDateRangeSchema.parse({
        from: "2025-01-01",
        to: "2026-08-08",
        model: "last_touch",
      }),
    ).toThrow();
    const invalidCalendarDate = {
      from: "2026-13-01",
      to: "2026-08-08",
      model: "last_touch",
    } as const;
    expect(() => overviewDateRangeSchema.safeParse(invalidCalendarDate)).not.toThrow();
    expect(overviewDateRangeSchema.safeParse(invalidCalendarDate).success).toBe(false);
  });
});

describe("getOverviewWith", () => {
  it("authorizes before querying and serializes every bigint amount as decimal text", async () => {
    const sequence: string[] = [];
    const loadOverview = vi.fn().mockImplementation(async () => {
      sequence.push("query");
      return {
        range: { start: "2026-08-01", end: "2026-08-08", timezone: "America/New_York" },
        currency: "USD",
        freshness: [
          {
            provider: "google_ads" as const,
            lastSuccessfulSync: "2026-08-09T10:00:00.000Z",
            state: "fresh" as const,
          },
          { provider: "meta_ads" as const, lastSuccessfulSync: null, state: "missing" as const },
          {
            provider: "google_analytics" as const,
            lastSuccessfulSync: null,
            state: "missing" as const,
          },
        ],
        facts: {
          totalLeads: 20,
          qualifiedLeads: 8,
          wonLeads: 4,
          paidQualifiedLeads: 5,
          confirmedRevenueMinor: "9223372036854775807",
          spendMinor: "100000",
          paidRevenueMinor: "300000",
          attributedRevenueMinor: "360000",
          unattributedLeads: 3,
          ambiguousLeads: 2,
        },
      };
    });

    const result = await getOverviewWith(
      { from: "2026-08-01", to: "2026-08-08", model: "last_touch" },
      {
        requireTenant: vi.fn().mockImplementation(async () => {
          sequence.push("context");
          return { tenantId: TENANT_ID };
        }),
        loadOverview,
      },
    );

    expect(sequence).toEqual(["context", "query"]);
    expect(loadOverview).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      from: "2026-08-01",
      to: "2026-08-08",
      model: "last_touch",
    });
    expect(result.totals).toEqual({
      confirmedRevenueMinor: "9223372036854775807",
      spendMinor: "100000",
      qualifiedLeads: 8,
      wonLeads: 4,
      unattributedLeads: 3,
      ambiguousLeads: 2,
    });
    expect(result.ratios).toEqual({
      qualifiedLeadRate: 0.4,
      closeRate: 0.5,
      costPerQualifiedLeadMinor: "20000",
      roas: 3,
      marketingRoi: 2.6,
    });
    expect(JSON.stringify(result)).not.toMatch(/9223372036854775807(\.0+)?[,}]/);
  });

  it("keeps missing spend and its dependent ratios unavailable", async () => {
    const result = await getOverviewWith(
      { from: "2026-08-01", to: "2026-08-08", model: "first_touch" },
      {
        requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
        loadOverview: vi.fn().mockResolvedValue({
          range: { start: "2026-08-01", end: "2026-08-08", timezone: "UTC" },
          currency: "USD",
          freshness: [],
          facts: {
            totalLeads: 0,
            qualifiedLeads: 0,
            wonLeads: 0,
            paidQualifiedLeads: 0,
            confirmedRevenueMinor: "0",
            spendMinor: null,
            paidRevenueMinor: "0",
            attributedRevenueMinor: "0",
            unattributedLeads: 0,
            ambiguousLeads: 0,
          },
        }),
      },
    );

    expect(result.totals.spendMinor).toBeNull();
    expect(result.ratios).toEqual({
      qualifiedLeadRate: null,
      closeRate: null,
      costPerQualifiedLeadMinor: null,
      roas: null,
      marketingRoi: null,
    });
  });
});
