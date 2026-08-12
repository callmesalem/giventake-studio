import "@tanstack/react-start/server-only";
import { z } from "zod";
import { requireTenantContext } from "@/features/tenants/tenant-context.server";
import { PROVIDERS, type Provider } from "@/lib/domain";
import { createUserSupabase } from "@/lib/server/supabase.server";
import { calculateOverview } from "./calculations";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  });

export const overviewDateRangeSchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
    model: z.enum(["first_touch", "last_touch"]),
  })
  .strict()
  .superRefine((input, context) => {
    const from = Date.parse(`${input.from}T00:00:00.000Z`);
    const to = Date.parse(`${input.to}T00:00:00.000Z`);
    const days = Math.floor((to - from) / 86_400_000) + 1;
    if (to < from)
      context.addIssue({ code: "custom", message: "From date must not follow to date" });
    if (days > 366)
      context.addIssue({ code: "custom", message: "Date range cannot exceed 366 days" });
  });

export type DateRangeInput = z.infer<typeof overviewDateRangeSchema>;
type FreshnessState = "fresh" | "stale" | "missing";

export type OverviewViewModel = {
  range: { start: string; end: string; timezone: string };
  currency: string;
  freshness: {
    provider: Provider;
    lastSuccessfulSync: string | null;
    state: FreshnessState;
  }[];
  totals: {
    confirmedRevenueMinor: string;
    spendMinor: string | null;
    qualifiedLeads: number;
    wonLeads: number;
    unattributedLeads: number;
    ambiguousLeads: number;
  };
  ratios: {
    qualifiedLeadRate: number | null;
    closeRate: number | null;
    costPerQualifiedLeadMinor: string | null;
    roas: number | null;
    marketingRoi: number | null;
  };
};

type OverviewLoadResult = {
  range: OverviewViewModel["range"];
  currency: string;
  freshness: OverviewViewModel["freshness"];
  facts: {
    totalLeads: number;
    qualifiedLeads: number;
    wonLeads: number;
    paidQualifiedLeads: number;
    confirmedRevenueMinor: string;
    spendMinor: string | null;
    paidRevenueMinor: string;
    attributedRevenueMinor: string;
    unattributedLeads: number;
    ambiguousLeads: number;
  };
};

type OverviewQuery = DateRangeInput & { tenantId: string };
type OverviewDependencies = {
  requireTenant: () => Promise<{ tenantId: string }>;
  loadOverview: (input: OverviewQuery) => Promise<OverviewLoadResult>;
};

function decimalBigint(value: string, field: string): bigint {
  if (!/^-?\d+$/.test(value)) throw new Error(`Invalid ${field}`);
  return BigInt(value);
}

export async function getOverviewWith(
  input: DateRangeInput,
  dependencies: OverviewDependencies,
): Promise<OverviewViewModel> {
  const parsed = overviewDateRangeSchema.parse(input);
  const context = await dependencies.requireTenant();
  const loaded = await dependencies.loadOverview({ tenantId: context.tenantId, ...parsed });
  const metrics = calculateOverview({
    totalLeads: loaded.facts.totalLeads,
    qualifiedLeads: loaded.facts.qualifiedLeads,
    wonLeads: loaded.facts.wonLeads,
    paidQualifiedLeads: loaded.facts.paidQualifiedLeads,
    spendMinor:
      loaded.facts.spendMinor === null
        ? null
        : decimalBigint(loaded.facts.spendMinor, "spendMinor"),
    paidRevenueMinor: decimalBigint(loaded.facts.paidRevenueMinor, "paidRevenueMinor"),
    attributedRevenueMinor: decimalBigint(
      loaded.facts.attributedRevenueMinor,
      "attributedRevenueMinor",
    ),
  });
  return {
    range: loaded.range,
    currency: loaded.currency,
    freshness: loaded.freshness,
    totals: {
      confirmedRevenueMinor: decimalBigint(
        loaded.facts.confirmedRevenueMinor,
        "confirmedRevenueMinor",
      ).toString(),
      spendMinor: loaded.facts.spendMinor,
      qualifiedLeads: loaded.facts.qualifiedLeads,
      wonLeads: loaded.facts.wonLeads,
      unattributedLeads: loaded.facts.unattributedLeads,
      ambiguousLeads: loaded.facts.ambiguousLeads,
    },
    ratios: {
      qualifiedLeadRate: metrics.qualifiedLeadRate,
      closeRate: metrics.closeRate,
      costPerQualifiedLeadMinor: metrics.costPerQualifiedLeadMinor?.toString() ?? null,
      roas: metrics.roas,
      marketingRoi: metrics.marketingRoi,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

function parseOverviewLoad(value: unknown): OverviewLoadResult {
  if (!isRecord(value) || !isRecord(value.range) || !isRecord(value.facts)) {
    throw new Error("Overview query returned an invalid response");
  }
  const facts = value.facts;
  const freshness = Array.isArray(value.freshness) ? value.freshness : [];
  const parsedFreshness = freshness.map((item) => {
    if (
      !isRecord(item) ||
      !PROVIDERS.includes(item.provider as Provider) ||
      (item.last_successful_sync !== null && typeof item.last_successful_sync !== "string") ||
      !["fresh", "stale", "missing"].includes(String(item.state))
    ) {
      throw new Error("Overview freshness is invalid");
    }
    return {
      provider: item.provider as Provider,
      lastSuccessfulSync: item.last_successful_sync as string | null,
      state: item.state as FreshnessState,
    };
  });
  const integer = (field: string) => {
    const candidate = facts[field];
    if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`Overview ${field} is invalid`);
    }
    return candidate;
  };
  const decimal = (field: string, nullable = false) => {
    const candidate = facts[field];
    if (nullable && candidate === null) return null;
    if (typeof candidate !== "string" || !/^\d+$/.test(candidate)) {
      throw new Error(`Overview ${field} is invalid`);
    }
    return candidate;
  };
  if (
    typeof value.range.start !== "string" ||
    typeof value.range.end !== "string" ||
    typeof value.range.timezone !== "string" ||
    typeof value.currency !== "string"
  ) {
    throw new Error("Overview range is invalid");
  }
  return {
    range: {
      start: value.range.start,
      end: value.range.end,
      timezone: value.range.timezone,
    },
    currency: value.currency,
    freshness: parsedFreshness,
    facts: {
      totalLeads: integer("total_leads"),
      qualifiedLeads: integer("qualified_leads"),
      wonLeads: integer("won_leads"),
      paidQualifiedLeads: integer("paid_qualified_leads"),
      confirmedRevenueMinor: decimal("confirmed_revenue_minor")!,
      spendMinor: decimal("spend_minor", true),
      paidRevenueMinor: decimal("paid_revenue_minor")!,
      attributedRevenueMinor: decimal("attributed_revenue_minor")!,
      unattributedLeads: integer("unattributed_leads"),
      ambiguousLeads: integer("ambiguous_leads"),
    },
  };
}

export async function getOverview(input: DateRangeInput): Promise<OverviewViewModel> {
  return getOverviewWith(input, {
    requireTenant: requireTenantContext,
    async loadOverview(query) {
      const { data, error } = await createUserSupabase().rpc("get_growth_overview", {
        target_tenant: query.tenantId,
        range_start: query.from,
        range_end: query.to,
        attribution_model: query.model,
      });
      if (error) throw error;
      if (data === null) throw new Error("Overview is unavailable");
      return parseOverviewLoad(data);
    },
  });
}
