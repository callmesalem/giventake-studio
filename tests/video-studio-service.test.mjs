import assert from "node:assert/strict";
import { createServer } from "vite";

const input = {
  tenantId: "giventake-devs",
  name: "Studio launch campaign",
  goal: "Generate qualified AI automation inquiries",
  offer: "Custom agentic development",
  audience: "Owners with manual operations",
  callToAction: "Book a discovery call",
  budgetCents: 2500,
};

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createStudioRepository } = await vite.ssrLoadModule("/src/lib/studio/repository.ts");
  const { createStudioService } = await vite.ssrLoadModule("/src/lib/studio/service.ts");
  const repo = createStudioRepository();
  const service = createStudioService(repo);
  const campaign = await service.createCampaign(input, "operator-1");

  const planned = await service.planCampaign("giventake-devs", campaign.id, "operator-1");
  assert.equal(planned.status, "awaiting_storyboard_approval");
  assert.equal(
    (await repo.getCurrentRevision("giventake-devs", campaign.id))?.storyboard.length,
    3,
  );
  await assert.rejects(
    () =>
      service.requestRender("giventake-devs", campaign.id, "operator-1", {
        provider: "fixture",
        model: "fixture",
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
        rateCentsPerSecond: 0,
      }),
    /storyboard approval/i,
  );

  const approved = await service.approveStoryboard("giventake-devs", campaign.id, "operator-1");
  assert.equal(approved.status, "approved_for_generation");
  const job = await service.requestRender("giventake-devs", campaign.id, "operator-1", {
    provider: "fixture",
    model: "fixture",
    idempotencyKey: "11111111-1111-1111-1111-111111111111",
    rateCentsPerSecond: 0,
  });
  assert.equal(job.status, "queued");
  assert.equal(job.reservedCents, 0);
  assert.equal(
    (
      await service.requestRender("giventake-devs", campaign.id, "operator-1", {
        provider: "fixture",
        model: "fixture",
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
        rateCentsPerSecond: 0,
      })
    ).id,
    job.id,
  );

  console.log("Video Studio approval service passed.");
} finally {
  await vite.close();
}
