import { describe, expect, it } from "vitest";
import { calculateOverview } from "./calculations";

describe("calculateOverview", () => {
  it("calculates the required ROI values from integer facts", () => {
    expect(
      calculateOverview({
        totalLeads: 20,
        qualifiedLeads: 8,
        wonLeads: 4,
        paidQualifiedLeads: 5,
        spendMinor: 100_000n,
        paidRevenueMinor: 300_000n,
        attributedRevenueMinor: 360_000n,
      }),
    ).toEqual({
      qualifiedLeadRate: 0.4,
      closeRate: 0.5,
      costPerQualifiedLeadMinor: 20_000n,
      roas: 3,
      marketingRoi: 2.6,
    });
  });

  it("returns null for every zero denominator", () => {
    expect(
      calculateOverview({
        totalLeads: 0,
        qualifiedLeads: 0,
        wonLeads: 0,
        paidQualifiedLeads: 0,
        spendMinor: 0n,
        paidRevenueMinor: 0n,
        attributedRevenueMinor: 0n,
      }),
    ).toEqual({
      qualifiedLeadRate: null,
      closeRate: null,
      costPerQualifiedLeadMinor: null,
      roas: null,
      marketingRoi: null,
    });
  });

  it("keeps unavailable spend unavailable instead of presenting zero", () => {
    expect(
      calculateOverview({
        totalLeads: 10,
        qualifiedLeads: 4,
        wonLeads: 2,
        paidQualifiedLeads: 2,
        spendMinor: null,
        paidRevenueMinor: 500n,
        attributedRevenueMinor: 700n,
      }),
    ).toEqual({
      qualifiedLeadRate: 0.4,
      closeRate: 0.5,
      costPerQualifiedLeadMinor: null,
      roas: null,
      marketingRoi: null,
    });
  });

  it("uses bigint arithmetic above JavaScript's safe integer range", () => {
    expect(
      calculateOverview({
        totalLeads: 3,
        qualifiedLeads: 3,
        wonLeads: 3,
        paidQualifiedLeads: 3,
        spendMinor: 3_000_000_000_000_000_003n,
        paidRevenueMinor: 9_000_000_000_000_000_009n,
        attributedRevenueMinor: 12_000_000_000_000_000_012n,
      }),
    ).toEqual({
      qualifiedLeadRate: 1,
      closeRate: 1,
      costPerQualifiedLeadMinor: 1_000_000_000_000_000_001n,
      roas: 3,
      marketingRoi: 3,
    });
  });

  it("carries rounded fractional ratios into the whole value", () => {
    expect(
      calculateOverview({
        totalLeads: 1,
        qualifiedLeads: 1,
        wonLeads: 1,
        paidQualifiedLeads: 1,
        spendMinor: 2_000_000_000_000n,
        paidRevenueMinor: 1_999_999_999_999n,
        attributedRevenueMinor: 2_000_000_000_000n,
      }),
    ).toMatchObject({ roas: 1, marketingRoi: 0 });
  });
});
