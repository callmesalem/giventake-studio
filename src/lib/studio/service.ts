import { randomUUID } from "node:crypto";

import { createCampaignInputSchema } from "./schema";
import { assertTransition } from "./state-machine";
import type {
  ApprovalRecord,
  CampaignBrief,
  CampaignRecord,
  CampaignStatus,
  RenderJobRecord,
  StoryboardScene,
  StudioRepository,
} from "./types";

function makeStoryboard(brief: CampaignBrief): StoryboardScene[] {
  return [
    {
      order: 1,
      durationSeconds: 5,
      purpose: "hook",
      narration: brief.goal,
      prompt: "Premium cinematic opening that shows a business problem becoming visible.",
      safeArea: "bottom",
    },
    {
      order: 2,
      durationSeconds: 10,
      purpose: "proof",
      narration: brief.offer,
      prompt: "Calm, confident view of the service and the resulting operational clarity.",
      safeArea: "bottom",
    },
    {
      order: 3,
      durationSeconds: 5,
      purpose: "cta",
      narration: brief.callToAction,
      prompt:
        "Premium closing visual with empty center space reserved for a deterministic CTA overlay.",
      safeArea: "center",
    },
  ];
}

export function createStudioService(repository: StudioRepository) {
  async function requireCampaign(tenantId: string, campaignId: string): Promise<CampaignRecord> {
    const campaign = await repository.getCampaign(tenantId, campaignId);
    if (!campaign) throw new Error("Campaign not found for this tenant.");
    return campaign;
  }

  async function transition(
    campaign: CampaignRecord,
    to: CampaignStatus,
    actorId: string,
    action: string,
  ): Promise<CampaignRecord> {
    assertTransition(campaign.status, to);
    const saved = await repository.saveCampaign({ ...campaign, status: to });
    await repository.addAuditEvent({
      id: randomUUID(),
      tenantId: saved.tenantId,
      campaignId: saved.id,
      actorId,
      action,
      createdAt: new Date().toISOString(),
      detail: { from: campaign.status, to },
    });
    return saved;
  }

  async function addApproval(
    campaign: CampaignRecord,
    actorId: string,
    kind: ApprovalRecord["kind"],
  ): Promise<void> {
    if (!campaign.currentRevisionId) throw new Error("Campaign needs a planned storyboard first.");
    await repository.addApproval({
      id: randomUUID(),
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      revisionId: campaign.currentRevisionId,
      kind,
      actorId,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    async createCampaign(input: unknown, actorId: string) {
      return repository.createCampaign(createCampaignInputSchema.parse(input), actorId);
    },
    async planCampaign(tenantId: string, campaignId: string, actorId: string) {
      let campaign = await requireCampaign(tenantId, campaignId);
      campaign = await transition(campaign, "planned", actorId, "campaign.planned");
      const revision = await repository.createRevision({
        id: randomUUID(),
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        number: 1,
        brief: {
          tenantId: campaign.tenantId,
          name: campaign.name,
          goal: campaign.goal,
          offer: campaign.offer,
          audience: campaign.audience,
          callToAction: campaign.callToAction,
          budgetCents: campaign.budgetCents,
        },
        storyboard: makeStoryboard(campaign),
        createdAt: new Date().toISOString(),
        createdBy: actorId,
      });
      campaign = await repository.saveCampaign({ ...campaign, currentRevisionId: revision.id });
      return transition(campaign, "awaiting_storyboard_approval", actorId, "storyboard.created");
    },
    async approveStoryboard(tenantId: string, campaignId: string, actorId: string) {
      const campaign = await requireCampaign(tenantId, campaignId);
      await addApproval(campaign, actorId, "storyboard");
      return transition(campaign, "approved_for_generation", actorId, "storyboard.approved");
    },
    async requestRender(
      tenantId: string,
      campaignId: string,
      actorId: string,
      request: {
        provider: string;
        model: string;
        idempotencyKey: string;
        rateCentsPerSecond: number;
      },
    ): Promise<RenderJobRecord> {
      const existing = await repository.getRenderJobByIdempotencyKey(
        tenantId,
        campaignId,
        request.idempotencyKey,
      );
      if (existing) return existing;

      let campaign = await requireCampaign(tenantId, campaignId);
      const hasStoryboardApproval = (await repository.listApprovals(tenantId, campaignId)).some(
        (approval) =>
          approval.kind === "storyboard" && approval.revisionId === campaign.currentRevisionId,
      );
      if (!hasStoryboardApproval)
        throw new Error("Storyboard approval is required before rendering.");
      if (campaign.budgetCents <= 0) throw new Error("A positive generation budget is required.");
      if (!Number.isFinite(request.rateCentsPerSecond) || request.rateCentsPerSecond < 0)
        throw new Error("Render pricing is invalid.");
      const revision = await repository.getCurrentRevision(tenantId, campaignId);
      if (!revision) throw new Error("Campaign needs a current revision before rendering.");
      const reservedCents = revision.storyboard.reduce(
        (total, scene) => total + scene.durationSeconds * request.rateCentsPerSecond,
        0,
      );
      if (reservedCents > campaign.budgetCents)
        throw new Error("Render reservation exceeds the campaign budget.");

      const job = await repository.createRenderJob({
        tenantId,
        campaignId,
        revisionId: revision.id,
        provider: request.provider,
        model: request.model,
        requestedBudgetCents: campaign.budgetCents,
        reservedCents,
        idempotencyKey: request.idempotencyKey,
      });
      campaign = await transition(campaign, "rendering", actorId, "render.queued");
      await repository.addAuditEvent({
        id: randomUUID(),
        tenantId,
        campaignId,
        actorId,
        action: "render.requested",
        createdAt: new Date().toISOString(),
        detail: {
          renderJobId: job.id,
          provider: request.provider,
          model: request.model,
          reservedCents,
          campaignStatus: campaign.status,
        },
      });
      return job;
    },
    async completeRender(tenantId: string, campaignId: string, actorId: string) {
      return transition(
        await requireCampaign(tenantId, campaignId),
        "awaiting_edit_approval",
        actorId,
        "render.completed",
      );
    },
    async approveEdit(tenantId: string, campaignId: string, actorId: string) {
      const campaign = await requireCampaign(tenantId, campaignId);
      await addApproval(campaign, actorId, "edit");
      return transition(campaign, "exported", actorId, "edit.approved");
    },
    async handoffExport(tenantId: string, campaignId: string, actorId: string) {
      const campaign = await requireCampaign(tenantId, campaignId);
      await addApproval(campaign, actorId, "handoff");
      return transition(campaign, "handed_off", actorId, "export.handed_off");
    },
  };
}
