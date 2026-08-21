import { randomUUID } from "node:crypto";

import { createFixtureProvider } from "./fixture-provider";
import { createStudioService } from "./service";
import type { ExportProfile, ExportRecord, StudioRepository } from "./types";

export const exportProfiles: Record<ExportProfile, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

export async function runFixtureWorker(
  repository: StudioRepository,
  tenantId: string,
  actorId: string,
): Promise<ExportRecord[]> {
  const provider = createFixtureProvider();
  const service = createStudioService(repository);
  const completedExports: ExportRecord[] = [];
  const campaigns = repository
    .listCampaigns(tenantId)
    .filter((campaign) => campaign.status === "rendering");

  for (const campaign of campaigns) {
    const revision = repository.getCurrentRevision(tenantId, campaign.id);
    if (!revision) throw new Error("Rendering campaign has no current revision.");

    for (const scene of revision.storyboard) {
      const request = { campaignId: campaign.id, tenantId, scene };
      const estimatedCost = await provider.estimate(request);
      if (estimatedCost > campaign.budgetCents) {
        throw new Error("Fixture render estimate exceeds campaign budget.");
      }
      const providerRequestId = await provider.submit(request);
      const polled = await provider.poll(providerRequestId);
      if (polled.state !== "completed")
        throw new Error(`Fixture provider did not complete: ${polled.state}.`);
      const result = polled.result;
      repository.addAuditEvent({
        id: randomUUID(),
        tenantId,
        campaignId: campaign.id,
        actorId,
        action: "render.fixture_completed",
        createdAt: new Date().toISOString(),
        detail: {
          provider: provider.name,
          providerRequestId: result.providerRequestId,
          scene: scene.order,
          durationSeconds: result.durationSeconds,
          costCents: result.costCents,
        },
      });
    }

    repository.addAuditEvent({
      id: randomUUID(),
      tenantId,
      campaignId: campaign.id,
      actorId,
      action: "qa.passed",
      createdAt: new Date().toISOString(),
      detail: { checks: "duration,aspect_ratio,cta_safe_area" },
    });

    for (const [profile, dimensions] of Object.entries(exportProfiles) as [
      ExportProfile,
      { width: number; height: number },
    ][]) {
      const item = repository.addExport({
        id: randomUUID(),
        tenantId,
        campaignId: campaign.id,
        revisionId: revision.id,
        profile,
        width: dimensions.width,
        height: dimensions.height,
        status: "ready",
        createdAt: new Date().toISOString(),
      });
      completedExports.push(item);
    }

    service.completeRender(tenantId, campaign.id, actorId);
  }

  return completedExports;
}
