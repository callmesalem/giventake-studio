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
  const campaign = service.createCampaign(input, "operator-1");

  const planned = service.planCampaign("giventake-devs", campaign.id, "operator-1");
  assert.equal(planned.status, "awaiting_storyboard_approval");
  assert.equal(repo.getCurrentRevision("giventake-devs", campaign.id)?.storyboard.length, 3);
  assert.throws(
    () => service.queueRender("giventake-devs", campaign.id, "operator-1"),
    /storyboard approval/i,
  );

  const approved = service.approveStoryboard("giventake-devs", campaign.id, "operator-1");
  assert.equal(approved.status, "approved_for_generation");
  assert.equal(
    service.queueRender("giventake-devs", campaign.id, "operator-1").status,
    "rendering",
  );

  console.log("Video Studio approval service passed.");
} finally {
  await vite.close();
}
