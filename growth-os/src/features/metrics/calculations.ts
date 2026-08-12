export type OverviewFacts = {
  totalLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  paidQualifiedLeads: number;
  spendMinor: bigint | null;
  paidRevenueMinor: bigint;
  attributedRevenueMinor: bigint;
};

export type OverviewMetrics = {
  qualifiedLeadRate: number | null;
  closeRate: number | null;
  costPerQualifiedLeadMinor: bigint | null;
  roas: number | null;
  marketingRoi: number | null;
};

function assertCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be nonnegative`);
}

function ratio(numerator: bigint, denominator: bigint): number | null {
  if (denominator === 0n) return null;
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const precision = 12n;
  const scale = 10n ** precision;
  const rounded = (absoluteNumerator * scale + absoluteDenominator / 2n) / absoluteDenominator;
  const whole = rounded / scale;
  const fraction = rounded % scale;
  const decimal = `${negative ? "-" : ""}${whole}.${fraction.toString().padStart(Number(precision), "0")}`;
  return Number(decimal);
}

export function calculateOverview(input: OverviewFacts): OverviewMetrics {
  assertCount(input.totalLeads, "totalLeads");
  assertCount(input.qualifiedLeads, "qualifiedLeads");
  assertCount(input.wonLeads, "wonLeads");
  assertCount(input.paidQualifiedLeads, "paidQualifiedLeads");
  if (input.spendMinor !== null && input.spendMinor < 0n) {
    throw new Error("spendMinor must be nonnegative");
  }
  if (input.paidRevenueMinor < 0n || input.attributedRevenueMinor < 0n) {
    throw new Error("revenue must be nonnegative");
  }

  const spend = input.spendMinor;
  return {
    qualifiedLeadRate:
      input.totalLeads === 0 ? null : ratio(BigInt(input.qualifiedLeads), BigInt(input.totalLeads)),
    closeRate:
      input.qualifiedLeads === 0
        ? null
        : ratio(BigInt(input.wonLeads), BigInt(input.qualifiedLeads)),
    costPerQualifiedLeadMinor:
      spend === null || input.paidQualifiedLeads === 0
        ? null
        : spend / BigInt(input.paidQualifiedLeads),
    roas: spend === null ? null : ratio(input.paidRevenueMinor, spend),
    marketingRoi: spend === null ? null : ratio(input.attributedRevenueMinor - spend, spend),
  };
}
