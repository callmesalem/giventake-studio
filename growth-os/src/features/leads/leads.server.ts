import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import {
  requireClientOwnerContext,
  requireTenantContext,
} from "@/features/tenants/tenant-context.server";
import type { Json } from "@/lib/database.types";
import { decryptField, encryptField, lookupHash } from "@/lib/server/crypto.server";
import { createUserSupabase } from "@/lib/server/supabase.server";
import {
  LeadNotFoundError,
  consentReceiptV1Schema,
  leadIdInputSchema,
  leadListInputSchema,
  parseRevenueInputAt,
  reopenLeadInputSchema,
  revenueInputSchema,
  statusChangeSchema,
  type LeadAuditEvent,
  type LeadDetail,
  type LeadListInput,
  type LeadListItem,
  type LeadListPage,
  type LeadStatus,
  type ParsedLeadListInput,
  type RevenueInput,
} from "./lead.schemas";
import { LEAD_STATUSES } from "./lead-state";

type Context = { tenantId: string };
type OwnerContext = Context & { userId: string };
type AttributionConfidence = "high" | "medium" | "low";
type TouchState = "attributed" | "ambiguous" | "unattributed";

type EncryptedLeadListRow = {
  id: string;
  name_ciphertext: string;
  email_ciphertext: string;
  company_ciphertext: string | null;
  status: LeadStatus;
  declared_source: string;
  occurred_at: string;
  last_activity_at: string;
  attribution_touches: Array<{ confidence: AttributionConfidence }>;
  revenue_outcomes: Array<{ amount_minor: number | string; currency: string }>;
};

type EncryptedLeadDetailRow = EncryptedLeadListRow & {
  phone_ciphertext: string | null;
  notes_ciphertext: string;
  budget_range: string;
  timeline_range: string;
};

type StoredTouch = {
  touch_type: "unresolved" | "first" | "last" | "manual";
  normalized_source: string;
  confidence: AttributionConfidence;
  state: TouchState;
  created_at: string;
};

type StoredConsent = {
  policy_version: string;
  source: string;
  recorded_at: string;
  categories: Json;
};

type StoredAudit = {
  action: LeadAuditEvent["action"];
  created_at: string;
  metadata: Json;
};

type StoredRevenue = {
  amount_minor: number | string;
  currency: string;
  confirmed_on: string;
};

type DetailBundle = {
  lead: EncryptedLeadDetailRow;
  touches: StoredTouch[];
  consent: StoredConsent;
  audit: StoredAudit[];
  revenue: StoredRevenue | null;
};

type ListQueryInput = {
  tenantId: string;
  restrictedOnly: true;
  status?: LeadStatus;
  source?: string;
  from?: string;
  to?: string;
  exactEmailHash?: string;
  exactPhoneHash?: string;
  cursor?: string;
  limit: number;
};

type ListDependencies = {
  requireTenant: () => Promise<Context>;
  loadPage: (input: ListQueryInput) => Promise<{
    rows: EncryptedLeadListRow[];
    hasMore: boolean;
  }>;
  decrypt: (ciphertext: string, purpose: "lead") => string;
  hashLookup: (value: string, purpose: "email" | "phone") => string;
};

function mapListItem(
  row: EncryptedLeadListRow,
  decrypt: ListDependencies["decrypt"],
): LeadListItem {
  const revenue = row.revenue_outcomes[0] ?? null;
  const confidenceRank: Record<AttributionConfidence, number> = { low: 0, medium: 1, high: 2 };
  const confidence = row.attribution_touches.reduce<AttributionConfidence>(
    (strongest, touch) =>
      confidenceRank[touch.confidence] > confidenceRank[strongest] ? touch.confidence : strongest,
    "low",
  );
  return {
    id: row.id,
    name: decrypt(row.name_ciphertext, "lead"),
    email: decrypt(row.email_ciphertext, "lead"),
    company: row.company_ciphertext ? decrypt(row.company_ciphertext, "lead") : null,
    status: row.status,
    declaredSource: row.declared_source,
    confidence,
    confirmedRevenueMinor: revenue ? String(revenue.amount_minor) : null,
    confirmedRevenueCurrency: revenue?.currency ?? null,
    occurredAt: row.occurred_at,
    lastActivityAt: row.last_activity_at,
  };
}

function encodeCursor(row: EncryptedLeadListRow): string {
  return Buffer.from(JSON.stringify({ occurredAt: row.occurred_at, id: row.id }), "utf8").toString(
    "base64url",
  );
}

function decodeCursor(cursor: string): { occurredAt: string; id: string } {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (
      typeof value.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.id,
      ) ||
      typeof value.occurredAt !== "string" ||
      Number.isNaN(Date.parse(value.occurredAt))
    ) {
      throw new Error("invalid cursor");
    }
    return { occurredAt: value.occurredAt, id: value.id };
  } catch {
    throw new Error("Invalid lead cursor");
  }
}

export async function listLeadsWith(
  input: LeadListInput,
  dependencies: ListDependencies,
): Promise<LeadListPage> {
  const context = await dependencies.requireTenant();
  const parsed = leadListInputSchema.parse(input);
  const query: ListQueryInput = {
    tenantId: context.tenantId,
    restrictedOnly: true,
    status: parsed.status,
    source: parsed.source,
    from: parsed.from,
    to: parsed.to,
    exactEmailHash: parsed.exactEmail
      ? dependencies.hashLookup(parsed.exactEmail, "email")
      : undefined,
    exactPhoneHash: parsed.exactPhone
      ? dependencies.hashLookup(parsed.exactPhone, "phone")
      : undefined,
    cursor: parsed.cursor,
    limit: parsed.limit,
  };
  const page = await dependencies.loadPage(query);
  const items = page.rows.map((row) => mapListItem(row, dependencies.decrypt));
  return {
    items,
    nextCursor: page.hasMore && page.rows.length > 0 ? encodeCursor(page.rows.at(-1)!) : null,
  };
}

async function loadLeadPage(input: ListQueryInput) {
  let query = createUserSupabase()
    .from("leads")
    .select(
      "id, name_ciphertext, email_ciphertext, company_ciphertext, status, declared_source, occurred_at, last_activity_at, attribution_touches(confidence), revenue_outcomes(amount_minor, currency)",
    )
    .eq("tenant_id", input.tenantId)
    .is("restricted_at", null)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (input.status) query = query.eq("status", input.status);
  if (input.source) query = query.eq("declared_source", input.source);
  if (input.from) query = query.gte("created_at", `${input.from}T00:00:00.000Z`);
  if (input.to) {
    const exclusiveEnd = new Date(`${input.to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    query = query.lt("created_at", exclusiveEnd.toISOString());
  }
  if (input.exactEmailHash) query = query.eq("email_lookup_hash", input.exactEmailHash);
  if (input.exactPhoneHash) query = query.eq("phone_lookup_hash", input.exactPhoneHash);
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    query = query.or(
      `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data as unknown as EncryptedLeadListRow[];
  return { rows: rows.slice(0, input.limit), hasMore: rows.length > input.limit };
}

export async function listLeads(input: LeadListInput): Promise<LeadListPage> {
  return listLeadsWith(input, {
    requireTenant: requireTenantContext,
    loadPage: loadLeadPage,
    decrypt: decryptField,
    hashLookup: lookupHash,
  });
}

type DetailDependencies = {
  requireTenant: () => Promise<Context>;
  loadDetail: (tenantId: string, leadId: string) => Promise<DetailBundle | null>;
  decrypt: (ciphertext: string, purpose: "lead") => string;
};

function categoryValue(categories: Json, key: string): unknown {
  if (!categories || Array.isArray(categories) || typeof categories !== "object") return undefined;
  return categories[key];
}

function mapTouch(touch: StoredTouch | undefined) {
  if (!touch) return null;
  return {
    source: touch.state === "unattributed" ? null : touch.normalized_source,
    confidence: touch.confidence,
    state: touch.state,
  };
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus);
}

function mapAudit(event: StoredAudit): LeadAuditEvent {
  const metadata =
    event.metadata && !Array.isArray(event.metadata) && typeof event.metadata === "object"
      ? event.metadata
      : {};
  const result: LeadAuditEvent = { action: event.action, createdAt: event.created_at };
  if (isLeadStatus(metadata.previous_status)) result.previousStatus = metadata.previous_status;
  if (isLeadStatus(metadata.current_status)) result.currentStatus = metadata.current_status;
  if (event.action === "lead.reopened" && typeof metadata.reason === "string") {
    result.reason = metadata.reason;
  }
  if (event.action === "revenue.recorded" && typeof metadata.recorded_on === "string") {
    result.recordedOn = metadata.recorded_on;
  }
  return result;
}

export async function getLeadWith(
  input: { leadId: string },
  dependencies: DetailDependencies,
): Promise<LeadDetail> {
  const context = await dependencies.requireTenant();
  const { leadId } = leadIdInputSchema.parse(input);
  const bundle = await dependencies.loadDetail(context.tenantId, leadId);
  if (!bundle) throw new LeadNotFoundError();

  const firstTouch = bundle.touches.find((touch) => touch.touch_type === "first");
  const lastTouch = bundle.touches.find((touch) => touch.touch_type === "last");
  const listItem = mapListItem(bundle.lead, dependencies.decrypt);
  const categories = bundle.consent.categories;
  return {
    ...listItem,
    confirmedRevenueMinor: bundle.revenue ? String(bundle.revenue.amount_minor) : null,
    confirmedRevenueCurrency: bundle.revenue?.currency ?? null,
    phone: bundle.lead.phone_ciphertext
      ? dependencies.decrypt(bundle.lead.phone_ciphertext, "lead")
      : null,
    notes: dependencies.decrypt(bundle.lead.notes_ciphertext, "lead"),
    budgetRange: bundle.lead.budget_range,
    timelineRange: bundle.lead.timeline_range,
    firstTouch: mapTouch(firstTouch),
    lastTouch: mapTouch(lastTouch),
    consent: consentReceiptV1Schema.parse({
      policy_version: bundle.consent.policy_version,
      source: bundle.consent.source,
      necessary: categoryValue(categories, "necessary"),
      analytics: categoryValue(categories, "analytics"),
      marketing: categoryValue(categories, "marketing"),
      preferences: categoryValue(categories, "preferences"),
      contact_requested: categoryValue(categories, "contact_requested"),
      gpc: categoryValue(categories, "gpc"),
      recorded_at: bundle.consent.recorded_at,
    }),
    audit: bundle.audit.map(mapAudit),
  };
}

async function loadLeadDetail(tenantId: string, leadId: string): Promise<DetailBundle | null> {
  const supabase = createUserSupabase();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, name_ciphertext, email_ciphertext, phone_ciphertext, company_ciphertext, notes_ciphertext, status, declared_source, budget_range, timeline_range, occurred_at, last_activity_at, attribution_touches(confidence), revenue_outcomes(amount_minor, currency)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .is("restricted_at", null)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead) return null;

  const [touchesResult, consentResult, auditResult, revenueResult] = await Promise.all([
    supabase
      .from("attribution_touches")
      .select("touch_type, normalized_source, confidence, state, created_at")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("consent_receipts")
      .select("policy_version, source, recorded_at, categories")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .eq("receipt_type", "website_lead")
      .single(),
    supabase
      .from("audit_events")
      .select("action, created_at, metadata")
      .eq("tenant_id", tenantId)
      .eq("target_id", leadId)
      .eq("target_type", "lead")
      .in("action", ["lead.created", "lead.status_changed", "lead.reopened", "revenue.recorded"])
      .order("created_at", { ascending: false }),
    supabase
      .from("revenue_outcomes")
      .select("amount_minor, currency, confirmed_on")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .maybeSingle(),
  ]);

  for (const result of [touchesResult, consentResult, auditResult, revenueResult]) {
    if (result.error) throw result.error;
  }

  return {
    lead: lead as unknown as EncryptedLeadDetailRow,
    touches: (touchesResult.data ?? []) as StoredTouch[],
    consent: consentResult.data as StoredConsent,
    audit: (auditResult.data ?? []) as StoredAudit[],
    revenue: revenueResult.data as StoredRevenue | null,
  };
}

export async function getLead(input: { leadId: string }): Promise<LeadDetail> {
  return getLeadWith(input, {
    requireTenant: requireTenantContext,
    loadDetail: loadLeadDetail,
    decrypt: decryptField,
  });
}

type StatusTransaction = (input: {
  tenantId: string;
  leadId: string;
  to: LeadStatus;
  requestId: string;
}) => Promise<{ status: LeadStatus } | null>;

export async function changeLeadStatusWith(
  input: unknown,
  dependencies: {
    requireOwner: () => Promise<OwnerContext>;
    updateStatus: StatusTransaction;
    requestId: () => string;
  },
) {
  const context = await dependencies.requireOwner();
  const parsed = statusChangeSchema.parse(input);
  const result = await dependencies.updateStatus({
    tenantId: context.tenantId,
    leadId: parsed.leadId,
    to: parsed.to,
    requestId: dependencies.requestId(),
  });
  if (!result) throw new LeadNotFoundError();
  return result;
}

function rpcObject(value: Json): Record<string, Json | undefined> | null {
  return value && !Array.isArray(value) && typeof value === "object" ? value : null;
}

export async function changeLeadStatus(input: unknown) {
  return changeLeadStatusWith(input, {
    requireOwner: requireClientOwnerContext,
    requestId: randomUUID,
    async updateStatus(transaction) {
      const { data, error } = await createUserSupabase().rpc("change_lead_status", {
        target_tenant: transaction.tenantId,
        target_lead: transaction.leadId,
        next_status: transaction.to,
        event_request_id: transaction.requestId,
      });
      if (error) throw error;
      const result = rpcObject(data);
      return result && isLeadStatus(result.status) ? { status: result.status } : null;
    },
  });
}

type ReopenTransaction = (input: {
  tenantId: string;
  leadId: string;
  reason: string;
  requestId: string;
}) => Promise<{ status: LeadStatus } | null>;

export async function reopenLeadWith(
  input: unknown,
  dependencies: {
    requireOwner: () => Promise<OwnerContext>;
    reopenLead: ReopenTransaction;
    requestId: () => string;
  },
) {
  const context = await dependencies.requireOwner();
  const parsed = reopenLeadInputSchema.parse(input);
  const result = await dependencies.reopenLead({
    tenantId: context.tenantId,
    leadId: parsed.leadId,
    reason: parsed.reason,
    requestId: dependencies.requestId(),
  });
  if (!result) throw new LeadNotFoundError();
  return result;
}

export async function reopenLead(input: unknown) {
  return reopenLeadWith(input, {
    requireOwner: requireClientOwnerContext,
    requestId: randomUUID,
    async reopenLead(transaction) {
      const { data, error } = await createUserSupabase().rpc("reopen_lead", {
        target_tenant: transaction.tenantId,
        target_lead: transaction.leadId,
        reopen_reason: transaction.reason,
        event_request_id: transaction.requestId,
      });
      if (error) throw error;
      const result = rpcObject(data);
      return result && isLeadStatus(result.status) ? { status: result.status } : null;
    },
  });
}

type RevenueResult = Pick<RevenueInput, "amountMinor" | "currency" | "confirmedAt">;
type RevenueTransaction = (input: {
  tenantId: string;
  leadId: string;
  amountMinor: string;
  currency: string;
  confirmedAt: string;
  noteCiphertext: string | null;
  requestId: string;
}) => Promise<RevenueResult | null>;

export async function recordRevenueWith(
  input: unknown,
  dependencies: {
    requireOwner: () => Promise<OwnerContext>;
    recordRevenue: RevenueTransaction;
    encrypt: (plaintext: string, purpose: "lead") => string;
    requestId: () => string;
    now: () => Date;
  },
) {
  const context = await dependencies.requireOwner();
  const parsed = parseRevenueInputAt(input, dependencies.now());
  const result = await dependencies.recordRevenue({
    tenantId: context.tenantId,
    leadId: parsed.leadId,
    amountMinor: parsed.amountMinor,
    currency: parsed.currency,
    confirmedAt: parsed.confirmedAt,
    noteCiphertext: parsed.note ? dependencies.encrypt(parsed.note, "lead") : null,
    requestId: dependencies.requestId(),
  });
  if (!result) throw new LeadNotFoundError();
  return result;
}

export async function recordRevenue(input: unknown) {
  return recordRevenueWith(input, {
    requireOwner: requireClientOwnerContext,
    encrypt: encryptField,
    requestId: randomUUID,
    now: () => new Date(),
    async recordRevenue(transaction) {
      const { data, error } = await createUserSupabase().rpc("record_lead_revenue", {
        target_tenant: transaction.tenantId,
        target_lead: transaction.leadId,
        revenue_amount_minor: transaction.amountMinor,
        revenue_currency: transaction.currency,
        revenue_confirmed_on: transaction.confirmedAt,
        revenue_note_ciphertext: transaction.noteCiphertext,
        event_request_id: transaction.requestId,
      });
      if (error?.code === "P0002") return null;
      if (error) throw error;
      const result = rpcObject(data);
      if (
        !result ||
        typeof result.amount_minor !== "string" ||
        typeof result.currency !== "string" ||
        typeof result.confirmed_on !== "string"
      ) {
        return null;
      }
      return {
        amountMinor: result.amount_minor,
        currency: result.currency,
        confirmedAt: result.confirmed_on,
      };
    },
  });
}

export type { DetailBundle, EncryptedLeadListRow, ListQueryInput };
