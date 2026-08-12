import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createJobSupabase } from "@/lib/server/supabase.server";

export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "membership.invited",
  "membership.changed",
  "brand.updated",
  "support.started",
  "support.ended",
  "cross_tenant_access_denied",
  "lead.created",
  "lead.status_changed",
  "lead.reopened",
  "revenue.recorded",
  "attribution.recomputed",
  "attribution.corrected",
  "connector.authorized",
  "connector.synced",
  "connector.refresh_failed",
  "connector.revoked",
  "privacy.requested",
  "privacy.exported",
  "privacy.restricted",
  "privacy.deleted",
  "retention.completed",
] as const;

export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof auditActionSchema>;

const auditStatusSchema = z.enum([
  "active",
  "suspended",
  "closed",
  "new",
  "qualified",
  "booked",
  "won",
  "lost",
  "healthy",
  "degraded",
  "action_required",
  "revoked",
  "pending",
  "running",
  "succeeded",
  "partial",
  "failed",
  "verified",
  "restricted",
  "processing",
  "completed",
  "enabled",
  "paused",
  "removed",
  "unknown",
]);
const nonnegativeCount = z.number().int().nonnegative().safe();
const uuid = z.string().uuid();
const isoDate = z.string().date();
const isoDateTime = z.string().datetime({ offset: true });
const nullable = <Schema extends z.ZodTypeAny>(schema: Schema) => schema.nullable().optional();
const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

export const auditMetadataSchema = z
  .object({
    channel: nullable(z.enum(["magic_link"])),
    change_code: nullable(z.enum(["invitation_accepted", "settings_saved"])),
    reason_code: nullable(z.enum(["tenant_not_allowed"])),
    reason: nullable(
      z
        .string()
        .trim()
        .min(10)
        .max(500)
        .refine((value) => !hasControlCharacter(value)),
    ),
    status: nullable(auditStatusSchema),
    previous_status: nullable(auditStatusSchema),
    current_status: nullable(auditStatusSchema),
    provider: nullable(z.enum(["google_analytics", "google_ads", "meta_ads"])),
    error_code: nullable(
      z.enum([
        "RATE_LIMITED",
        "NETWORK",
        "TOKEN_EXPIRED",
        "TOKEN_REVOKED",
        "INVALID_RESPONSE",
        "INVALID_SCOPE",
      ]),
    ),
    attribution_model: nullable(z.enum(["first_touch", "last_touch"])),
    confidence: nullable(z.enum(["high", "medium", "low"])),
    request_type: nullable(z.enum(["access", "correction", "deletion", "export", "opt_out"])),
    expires_at: nullable(isoDateTime),
    occurred_at: nullable(isoDateTime),
    completed_at: nullable(isoDateTime),
    window_start: nullable(isoDate),
    window_end: nullable(isoDate),
    recorded_on: nullable(isoDate),
    connection_id: nullable(uuid),
    lead_id: nullable(uuid),
    campaign_id: nullable(uuid),
    sync_run_id: nullable(uuid),
    privacy_request_id: nullable(uuid),
    site_id: nullable(uuid),
    amount_minor: nullable(nonnegativeCount),
    rows_processed: nullable(nonnegativeCount),
    imported_count: nullable(nonnegativeCount),
    published_count: nullable(nonnegativeCount),
    sync_rows_deleted: nullable(nonnegativeCount),
    evidence_rows_deleted: nullable(nonnegativeCount),
    touch_rows_deleted: nullable(nonnegativeCount),
    consent_rows_deleted: nullable(nonnegativeCount),
    revenue_rows_deleted: nullable(nonnegativeCount),
    idempotency_rows_deleted: nullable(nonnegativeCount),
    lead_rows_deleted: nullable(nonnegativeCount),
    metric_rows_deleted: nullable(nonnegativeCount),
    audit_rows_deleted: nullable(nonnegativeCount),
    privacy_rows_deleted: nullable(nonnegativeCount),
    matched_count: nullable(nonnegativeCount),
    has_more: nullable(z.boolean()),
  })
  .strict();

export type AuditMetadata = z.infer<typeof auditMetadataSchema>;

export type AuditInput = {
  tenantId: string;
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  requestId: string;
  metadata: Record<string, string | number | boolean | null>;
};

const auditInputSchema = z
  .object({
    tenantId: uuid,
    actorId: uuid.nullable(),
    action: auditActionSchema,
    targetType: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/),
    targetId: uuid.nullable(),
    requestId: uuid,
    metadata: auditMetadataSchema,
  })
  .strict();

type AuditRpcInput = {
  target_tenant: string;
  event_actor_user_id: string | null;
  event_action: AuditAction;
  event_target_type: string;
  event_target_id: string | null;
  event_request_id: string;
  event_metadata: AuditMetadata;
};

type PersistAudit = (input: AuditRpcInput) => Promise<string>;

export async function writeAuditEventWith(
  input: AuditInput,
  persist: PersistAudit,
): Promise<string> {
  const parsed = auditInputSchema.parse(input);
  return persist({
    target_tenant: parsed.tenantId,
    event_actor_user_id: parsed.actorId,
    event_action: parsed.action,
    event_target_type: parsed.targetType,
    event_target_id: parsed.targetId,
    event_request_id: parsed.requestId,
    event_metadata: parsed.metadata,
  });
}

export async function writeAuditEvent(input: AuditInput): Promise<string> {
  const supabase = createJobSupabase();
  return writeAuditEventWith(input, async (event) => {
    const { data, error } = await supabase.rpc("write_audit_event", {
      ...event,
      event_metadata: event.event_metadata as Json,
    });
    if (error || !data) throw error ?? new Error("Audit event was not persisted");
    return data;
  });
}
