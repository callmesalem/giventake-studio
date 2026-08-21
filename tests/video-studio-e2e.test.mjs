import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createStudioRepository } = await vite.ssrLoadModule("/src/lib/studio/repository.ts");
  const { createStudioService } = await vite.ssrLoadModule("/src/lib/studio/service.ts");
  const { runFixtureWorker } = await vite.ssrLoadModule("/src/lib/studio/worker.ts");
  const repo = createStudioRepository();
  const service = createStudioService(repo);
  const campaign = service.createCampaign(
    {
      tenantId: "giventake-devs",
      name: "End-to-end launch creative",
      goal: "Generate qualified inquiries",
      offer: "Agentic development",
      audience: "Owners with manual workflows",
      callToAction: "Book a discovery call",
      budgetCents: 2500,
    },
    "operator-1",
  );

  service.planCampaign("giventake-devs", campaign.id, "operator-1");
  service.approveStoryboard("giventake-devs", campaign.id, "operator-1");
  service.queueRender("giventake-devs", campaign.id, "operator-1");
  await runFixtureWorker(repo, "giventake-devs", "fixture-worker");
  service.approveEdit("giventake-devs", campaign.id, "operator-1");
  const handedOff = service.handoffExport("giventake-devs", campaign.id, "operator-1");

  assert.equal(handedOff.status, "handed_off");
  assert.equal(repo.listExports("giventake-devs", campaign.id).length, 3);
  assert.equal(
    repo
      .listApprovals("giventake-devs", campaign.id)
      .map((approval) => approval.kind)
      .join(","),
    "storyboard,edit,handoff",
  );

  console.log("Video Studio end-to-end fixture workflow passed.");
} finally {
  await vite.close();
}
