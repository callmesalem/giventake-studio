import { randomUUID } from "node:crypto";

import type {
  ApprovalRecord,
  AuditEvent,
  CampaignBrief,
  CampaignRecord,
  CampaignRevision,
  CreateRenderJob,
  ExportRecord,
  RenderJobBundle,
  RenderJobRecord,
  StudioBrand,
  StudioRepository,
} from "./types";

type DatabaseRow = Record<string, unknown>;
type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  insert: (values: unknown) => QueryBuilder;
  update: (values: unknown) => QueryBuilder;
};
type StudioDatabaseClient = {
  schema: (name: "video_studio") => {
    from: (table: string) => QueryBuilder;
    rpc: (name: string, input: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

function failed(): never {
  throw new Error("Studio persistence query failed.");
}

function asText(row: DatabaseRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") return failed();
  return value;
}

function asNumber(row: DatabaseRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number") return failed();
  return value;
}

function toCampaign(row: DatabaseRow): CampaignRecord {
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    name: asText(row, "name"),
    goal: asText(row, "goal"),
    offer: asText(row, "offer"),
    audience: asText(row, "audience"),
    callToAction: asText(row, "call_to_action"),
    budgetCents: asNumber(row, "budget_cents"),
    status: asText(row, "status") as CampaignRecord["status"],
    currentRevisionId: (row.current_revision_id as string | null) ?? null,
    createdAt: asText(row, "created_at"),
    updatedAt: asText(row, "updated_at"),
  };
}

function toRevision(row: DatabaseRow): CampaignRevision {
  const brief = row.brief;
  const storyboard = row.storyboard;
  if (!brief || typeof brief !== "object" || !Array.isArray(storyboard)) return failed();
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    campaignId: asText(row, "campaign_id"),
    number: asNumber(row, "number"),
    brief: brief as CampaignBrief,
    storyboard: storyboard as CampaignRevision["storyboard"],
    createdAt: asText(row, "created_at"),
    createdBy: asText(row, "created_by"),
  };
}

function toApproval(row: DatabaseRow): ApprovalRecord {
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    campaignId: asText(row, "campaign_id"),
    revisionId: asText(row, "revision_id"),
    kind: asText(row, "kind") as ApprovalRecord["kind"],
    actorId: asText(row, "actor_user_id"),
    createdAt: asText(row, "created_at"),
  };
}

function toAuditEvent(row: DatabaseRow): AuditEvent {
  const detail = row.metadata;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return failed();
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    campaignId: asText(row, "campaign_id"),
    actorId: asText(row, "actor_user_id"),
    action: asText(row, "action"),
    createdAt: asText(row, "created_at"),
    detail: detail as AuditEvent["detail"],
  };
}

function toExport(row: DatabaseRow): ExportRecord {
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    campaignId: asText(row, "campaign_id"),
    revisionId: asText(row, "revision_id"),
    renderJobId: asText(row, "render_job_id"),
    profile: asText(row, "profile") as ExportRecord["profile"],
    width: asNumber(row, "width"),
    height: asNumber(row, "height"),
    status: asText(row, "status") as ExportRecord["status"],
    createdAt: asText(row, "created_at"),
  };
}

function toRenderJob(row: DatabaseRow): RenderJobRecord {
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    campaignId: asText(row, "campaign_id"),
    revisionId: asText(row, "revision_id"),
    provider: asText(row, "provider"),
    model: asText(row, "model"),
    requestedBudgetCents: asNumber(row, "requested_budget_cents"),
    reservedCents: asNumber(row, "reserved_cents"),
    idempotencyKey: asText(row, "idempotency_key"),
    workerJobId: (row.worker_job_id as string | null) ?? null,
    status: asText(row, "status") as RenderJobRecord["status"],
    failureCode: (row.failure_code as string | null) ?? null,
    createdAt: asText(row, "created_at"),
    updatedAt: asText(row, "updated_at"),
  };
}

function toBrand(row: DatabaseRow): StudioBrand {
  return {
    id: asText(row, "id"),
    tenantId: asText(row, "tenant_id"),
    name: asText(row, "name"),
    website: asText(row, "website"),
    callToAction: asText(row, "call_to_action"),
    primaryColor: (row.primary_color as string | null) ?? null,
    accentColor: (row.accent_color as string | null) ?? null,
    createdAt: asText(row, "created_at"),
    updatedAt: asText(row, "updated_at"),
  };
}

export function createSupabaseStudioRepository(client: StudioDatabaseClient): StudioRepository {
  const database = client.schema("video_studio");

  async function getBrand(tenantId: string): Promise<StudioBrand | null> {
    const { data, error } = await database
      .from("brands")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return failed();
    return data ? toBrand(data as DatabaseRow) : null;
  }

  const repository: StudioRepository = {
    async createCampaign(brief, actorId) {
      const brand = await getBrand(brief.tenantId);
      if (!brand) throw new Error("Studio brand is unavailable for this tenant.");
      const { data, error } = await database
        .from("campaigns")
        .insert({
          tenant_id: brief.tenantId,
          brand_id: brand.id,
          name: brief.name,
          goal: brief.goal,
          offer: brief.offer,
          audience: brief.audience,
          call_to_action: brief.callToAction,
          budget_cents: brief.budgetCents,
        })
        .select("*")
        .single();
      if (error || !data) return failed();
      const campaign = toCampaign(data as DatabaseRow);
      await repository.addAuditEvent({
        id: randomUUID(),
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        actorId,
        action: "campaign.created",
        createdAt: campaign.createdAt,
        detail: { status: campaign.status },
      });
      return campaign;
    },
    async getCampaign(tenantId, campaignId) {
      const { data, error } = await database
        .from("campaigns")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", campaignId)
        .maybeSingle();
      if (error) return failed();
      return data ? toCampaign(data as DatabaseRow) : null;
    },
    async listCampaigns(tenantId) {
      const { data, error } = await database
        .from("campaigns")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      if (error || !data) return failed();
      return (data as DatabaseRow[]).map(toCampaign);
    },
    async saveCampaign(campaign) {
      const { data, error } = await database
        .from("campaigns")
        .update({
          name: campaign.name,
          goal: campaign.goal,
          offer: campaign.offer,
          audience: campaign.audience,
          call_to_action: campaign.callToAction,
          budget_cents: campaign.budgetCents,
          status: campaign.status,
          current_revision_id: campaign.currentRevisionId,
        })
        .eq("tenant_id", campaign.tenantId)
        .eq("id", campaign.id)
        .select("*")
        .single();
      if (error || !data) return failed();
      return toCampaign(data as DatabaseRow);
    },
    async createRevision(revision) {
      const { data, error } = await database
        .from("campaign_revisions")
        .insert({
          id: revision.id,
          tenant_id: revision.tenantId,
          campaign_id: revision.campaignId,
          number: revision.number,
          brief: revision.brief,
          storyboard: revision.storyboard,
          created_by: revision.createdBy,
        })
        .select("*")
        .single();
      if (error || !data) return failed();
      return toRevision(data as DatabaseRow);
    },
    async getCurrentRevision(tenantId, campaignId) {
      const campaign = await repository.getCampaign(tenantId, campaignId);
      if (!campaign?.currentRevisionId) return null;
      const { data, error } = await database
        .from("campaign_revisions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("campaign_id", campaignId)
        .eq("id", campaign.currentRevisionId)
        .maybeSingle();
      if (error) return failed();
      return data ? toRevision(data as DatabaseRow) : null;
    },
    async addApproval(approval) {
      const { data, error } = await database
        .from("approvals")
        .insert({
          id: approval.id,
          tenant_id: approval.tenantId,
          campaign_id: approval.campaignId,
          revision_id: approval.revisionId,
          kind: approval.kind,
          actor_user_id: approval.actorId,
        })
        .select("*")
        .single();
      if (error || !data) return failed();
      return toApproval(data as DatabaseRow);
    },
    async listApprovals(tenantId, campaignId) {
      const { data, error } = await database
        .from("approvals")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error || !data) return failed();
      return (data as DatabaseRow[]).map(toApproval);
    },
    async addAuditEvent(event) {
      const { error } = await database.rpc("write_audit_event", {
        target_tenant: event.tenantId,
        target_action: event.action,
        event_target_type: "campaign",
        event_target_id: event.campaignId,
        event_request_id: event.id,
        event_metadata: event.detail,
        target_campaign_id: event.campaignId,
      });
      if (error) return failed();
      return event;
    },
    async listAuditEvents(tenantId, campaignId) {
      const { data, error } = await database
        .from("audit_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error || !data) return failed();
      return (data as DatabaseRow[]).map(toAuditEvent);
    },
    async addExport(item) {
      if (!item.renderJobId) throw new Error("Export requires a render job.");
      const { data, error } = await database
        .from("exports")
        .insert({
          id: item.id,
          tenant_id: item.tenantId,
          campaign_id: item.campaignId,
          revision_id: item.revisionId,
          render_job_id: item.renderJobId,
          profile: item.profile,
          width: item.width,
          height: item.height,
          status: item.status,
        })
        .select("*")
        .single();
      if (error || !data) return failed();
      return toExport(data as DatabaseRow);
    },
    async listExports(tenantId, campaignId) {
      const { data, error } = await database
        .from("exports")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error || !data) return failed();
      return (data as DatabaseRow[]).map(toExport);
    },
    async createRenderJob(job: CreateRenderJob) {
      const { data, error } = await database
        .from("render_jobs")
        .insert({
          tenant_id: job.tenantId,
          campaign_id: job.campaignId,
          revision_id: job.revisionId,
          provider: job.provider,
          model: job.model,
          requested_budget_cents: job.requestedBudgetCents,
          reserved_cents: job.reservedCents,
          idempotency_key: job.idempotencyKey,
        })
        .select("*")
        .single();
      if (!error && data) return toRenderJob(data as DatabaseRow);
      if ((error as { code?: string } | null)?.code !== "23505") return failed();
      const existing = await repository.getRenderJobByIdempotencyKey(
        job.tenantId,
        job.campaignId,
        job.idempotencyKey,
      );
      if (!existing) return failed();
      return existing;
    },
    async getRenderJob(tenantId, jobId) {
      const { data, error } = await database
        .from("render_jobs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", jobId)
        .maybeSingle();
      if (error) return failed();
      return data ? toRenderJob(data as DatabaseRow) : null;
    },
    async getRenderJobByIdempotencyKey(tenantId, campaignId, idempotencyKey) {
      const { data, error } = await database
        .from("render_jobs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("campaign_id", campaignId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) return failed();
      return data ? toRenderJob(data as DatabaseRow) : null;
    },
    async saveRenderJob(job) {
      const { data, error } = await database
        .from("render_jobs")
        .update({
          worker_job_id: job.workerJobId,
          status: job.status,
          failure_code: job.failureCode,
        })
        .eq("tenant_id", job.tenantId)
        .eq("id", job.id)
        .select("*")
        .single();
      if (error || !data) return failed();
      return toRenderJob(data as DatabaseRow);
    },
    getBrand,
    async getRenderJobBundle(tenantId, jobId): Promise<RenderJobBundle | null> {
      const job = await repository.getRenderJob(tenantId, jobId);
      if (!job) return null;
      const campaign = await repository.getCampaign(tenantId, job.campaignId);
      const revision = await repository.getCurrentRevision(tenantId, job.campaignId);
      const brand = await getBrand(tenantId);
      if (!campaign || !revision || revision.id !== job.revisionId || !brand) return null;
      return { job, campaign, revision, brand };
    },
  };

  return repository;
}
