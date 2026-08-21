import { randomUUID } from "node:crypto";

import type {
  ApprovalRecord,
  AuditEvent,
  CampaignBrief,
  CampaignRecord,
  CampaignRevision,
  ExportRecord,
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

  return {
    createCampaign(brief: CampaignBrief, actorId: string) {
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
    getCampaign(tenantId, campaignId) {
      const campaign = campaigns.get(campaignId);
      return campaign?.tenantId === tenantId ? copy(campaign) : null;
    },
    listCampaigns(tenantId) {
      return [...campaigns.values()]
        .filter((campaign) => campaign.tenantId === tenantId)
        .map(copy)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    saveCampaign(campaign) {
      const saved = { ...copy(campaign), updatedAt: new Date().toISOString() };
      campaigns.set(saved.id, saved);
      return copy(saved);
    },
    createRevision(revision) {
      revisions.set(revision.id, copy(revision));
      return copy(revision);
    },
    getCurrentRevision(tenantId, campaignId) {
      const campaign = campaigns.get(campaignId);
      if (!campaign || campaign.tenantId !== tenantId || !campaign.currentRevisionId) return null;
      const revision = revisions.get(campaign.currentRevisionId);
      return revision?.tenantId === tenantId ? copy(revision) : null;
    },
    addApproval(approval) {
      approvals.set(approval.id, copy(approval));
      return copy(approval);
    },
    listApprovals(tenantId, campaignId) {
      return [...approvals.values()]
        .filter((approval) => approval.tenantId === tenantId && approval.campaignId === campaignId)
        .map(copy);
    },
    addAuditEvent(event) {
      auditEvents.set(event.id, copy(event));
      return copy(event);
    },
    listAuditEvents(tenantId, campaignId) {
      return [...auditEvents.values()]
        .filter((event) => event.tenantId === tenantId && event.campaignId === campaignId)
        .map(copy)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    addExport(item) {
      exports.set(item.id, copy(item));
      return copy(item);
    },
    listExports(tenantId, campaignId) {
      return [...exports.values()]
        .filter((item) => item.tenantId === tenantId && item.campaignId === campaignId)
        .map(copy);
    },
  };
}
