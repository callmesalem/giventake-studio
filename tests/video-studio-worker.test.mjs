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
  const { runFixtureWorker } = await vite.ssrLoadModule("/src/lib/studio/worker.ts");
  const repo = createStudioRepository();
  const service = createStudioService(repo);
  const campaign = await service.createCampaign(input, "operator-1");

  await service.planCampaign("giventake-devs", campaign.id, "operator-1");
  await service.approveStoryboard("giventake-devs", campaign.id, "operator-1");
  await service.requestRender("giventake-devs", campaign.id, "operator-1", {
    provider: "fixture",
    model: "fixture",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    rateCentsPerSecond: 0,
  });

  const exports = await runFixtureWorker(repo, "giventake-devs", "fixture-worker");
  assert.deepEqual(
    exports.map((item) => item.profile),
    ["vertical", "square", "landscape"],
  );
  assert.equal(
    (await repo.getCampaign("giventake-devs", campaign.id))?.status,
    "awaiting_edit_approval",
  );
  assert.equal(
    (await repo.listAuditEvents("giventake-devs", campaign.id)).some(
      (event) => event.action === "qa.passed",
    ),
    true,
  );

  console.log("Video Studio fixture worker passed.");
} finally {
  await vite.close();
}
