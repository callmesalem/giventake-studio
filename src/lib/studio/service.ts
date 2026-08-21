import { randomUUID } from "node:crypto";

import { createCampaignInputSchema } from "./schema";
import { assertTransition } from "./state-machine";
import type {
  ApprovalRecord,
  CampaignBrief,
  CampaignRecord,
  CampaignStatus,
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
  function requireCampaign(tenantId: string, campaignId: string): CampaignRecord {
    const campaign = repository.getCampaign(tenantId, campaignId);
    if (!campaign) throw new Error("Campaign not found for this tenant.");
    return campaign;
  }

  function transition(
    campaign: CampaignRecord,
    to: CampaignStatus,
    actorId: string,
    action: string,
  ): CampaignRecord {
    assertTransition(campaign.status, to);
    const saved = repository.saveCampaign({ ...campaign, status: to });
    repository.addAuditEvent({
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

  function addApproval(
    campaign: CampaignRecord,
    actorId: string,
    kind: ApprovalRecord["kind"],
  ): void {
    if (!campaign.currentRevisionId) throw new Error("Campaign needs a planned storyboard first.");
    repository.addApproval({
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
    createCampaign(input: unknown, actorId: string) {
      return repository.createCampaign(createCampaignInputSchema.parse(input), actorId);
    },
    planCampaign(tenantId: string, campaignId: string, actorId: string) {
      let campaign = requireCampaign(tenantId, campaignId);
      campaign = transition(campaign, "planned", actorId, "campaign.planned");
      const revision = repository.createRevision({
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
      campaign = repository.saveCampaign({ ...campaign, currentRevisionId: revision.id });
      return transition(campaign, "awaiting_storyboard_approval", actorId, "storyboard.created");
    },
    approveStoryboard(tenantId: string, campaignId: string, actorId: string) {
      const campaign = requireCampaign(tenantId, campaignId);
      addApproval(campaign, actorId, "storyboard");
      return transition(campaign, "approved_for_generation", actorId, "storyboard.approved");
    },
    queueRender(tenantId: string, campaignId: string, actorId: string) {
      const campaign = requireCampaign(tenantId, campaignId);
      const hasStoryboardApproval = repository
        .listApprovals(tenantId, campaignId)
        .some(
          (approval) =>
            approval.kind === "storyboard" && approval.revisionId === campaign.currentRevisionId,
        );
      if (!hasStoryboardApproval)
        throw new Error("Storyboard approval is required before rendering.");
      if (campaign.budgetCents <= 0) throw new Error("A positive generation budget is required.");
      return transition(campaign, "rendering", actorId, "render.queued");
    },
    completeRender(tenantId: string, campaignId: string, actorId: string) {
      return transition(
        requireCampaign(tenantId, campaignId),
        "awaiting_edit_approval",
        actorId,
        "render.completed",
      );
    },
    approveEdit(tenantId: string, campaignId: string, actorId: string) {
      const campaign = requireCampaign(tenantId, campaignId);
      addApproval(campaign, actorId, "edit");
      return transition(campaign, "exported", actorId, "edit.approved");
    },
    handoffExport(tenantId: string, campaignId: string, actorId: string) {
      const campaign = requireCampaign(tenantId, campaignId);
      addApproval(campaign, actorId, "handoff");
      return transition(campaign, "handed_off", actorId, "export.handed_off");
    },
  };
}
