import { randomUUID } from "node:crypto";

import type {
  ApprovalRecord,
  AuditEvent,
  CampaignBrief,
  CampaignRecord,
  CampaignRevision,
  CreateRenderJob,
  ExportRecord,
  RenderJobRecord,
  StudioRepository,
} from "./types";

function copy<T>(value: T): T {
  return structuredClone(value);
}

export function createStudioRepository(): StudioRepository {
  const campaigns = new Map<string, CampaignRecord>();
  const revisions = new Map<string, CampaignRevision>();
  const approvals = new Map<string, ApprovalRecord>();
  const auditEvents = new Map<string, AuditEvent>();
  const exports = new Map<string, ExportRecord>();
  const renderJobs = new Map<string, RenderJobRecord>();

  return {
    async createCampaign(brief: CampaignBrief, actorId: string) {
      const now = new Date().toISOString();
      const campaign: CampaignRecord = {
        ...copy(brief),
        id: randomUUID(),
        status: "draft",
        currentRevisionId: null,
        createdAt: now,
        updatedAt: now,
      };
      campaigns.set(campaign.id, campaign);

      const event: AuditEvent = {
        id: randomUUID(),
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        actorId,
        action: "campaign.created",
        createdAt: now,
        detail: { status: campaign.status },
      };
      auditEvents.set(event.id, event);
      return copy(campaign);
    },
    async getCampaign(tenantId, campaignId) {
      const campaign = campaigns.get(campaignId);
      return campaign?.tenantId === tenantId ? copy(campaign) : null;
    },
    async listCampaigns(tenantId) {
      return [...campaigns.values()]
        .filter((campaign) => campaign.tenantId === tenantId)
        .map(copy)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async saveCampaign(campaign) {
      const saved = { ...copy(campaign), updatedAt: new Date().toISOString() };
      campaigns.set(saved.id, saved);
      return copy(saved);
    },
    async createRevision(revision) {
      revisions.set(revision.id, copy(revision));
      return copy(revision);
    },
    async getCurrentRevision(tenantId, campaignId) {
      const campaign = campaigns.get(campaignId);
      if (!campaign || campaign.tenantId !== tenantId || !campaign.currentRevisionId) return null;
      const revision = revisions.get(campaign.currentRevisionId);
      return revision?.tenantId === tenantId ? copy(revision) : null;
    },
    async addApproval(approval) {
      approvals.set(approval.id, copy(approval));
      return copy(approval);
    },
    async listApprovals(tenantId, campaignId) {
      return [...approvals.values()]
        .filter((approval) => approval.tenantId === tenantId && approval.campaignId === campaignId)
        .map(copy);
    },
    async addAuditEvent(event) {
      auditEvents.set(event.id, copy(event));
      return copy(event);
    },
    async listAuditEvents(tenantId, campaignId) {
      return [...auditEvents.values()]
        .filter((event) => event.tenantId === tenantId && event.campaignId === campaignId)
        .map(copy)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async addExport(item) {
      exports.set(item.id, copy(item));
      return copy(item);
    },
    async listExports(tenantId, campaignId) {
      return [...exports.values()]
        .filter((item) => item.tenantId === tenantId && item.campaignId === campaignId)
        .map(copy);
    },
    async createRenderJob(input: CreateRenderJob) {
      const existing = [...renderJobs.values()].find(
        (job) =>
          job.tenantId === input.tenantId &&
          job.campaignId === input.campaignId &&
          job.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return copy(existing);

      const now = new Date().toISOString();
      const job: RenderJobRecord = {
        ...copy(input),
        id: randomUUID(),
        workerJobId: null,
        status: "queued",
        failureCode: null,
        createdAt: now,
        updatedAt: now,
      };
      renderJobs.set(job.id, job);
      return copy(job);
    },
    async getRenderJob(tenantId, jobId) {
      const job = renderJobs.get(jobId);
      return job?.tenantId === tenantId ? copy(job) : null;
    },
    async getRenderJobByIdempotencyKey(tenantId, campaignId, idempotencyKey) {
      const job = [...renderJobs.values()].find(
        (item) =>
          item.tenantId === tenantId &&
          item.campaignId === campaignId &&
          item.idempotencyKey === idempotencyKey,
      );
      return job ? copy(job) : null;
    },
    async saveRenderJob(job) {
      const saved = { ...copy(job), updatedAt: new Date().toISOString() };
      renderJobs.set(saved.id, saved);
      return copy(saved);
    },
  };
}
