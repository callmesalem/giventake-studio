import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createStudioRepository } = await vite.ssrLoadModule("/src/lib/studio/repository.ts");
  const repo = createStudioRepository();
  const campaign = await repo.createCampaign(
    {
      tenantId: "tenant-a",
      name: "Campaign A",
      goal: "Generate leads",
      offer: "Automation build",
      audience: "Local business owners",
      callToAction: "Book a call",
      budgetCents: 2500,
    },
    "operator-1",
  );

  assert.equal((await repo.getCampaign("tenant-a", campaign.id))?.name, "Campaign A");
  assert.equal(await repo.getCampaign("tenant-b", campaign.id), null);
  assert.equal((await repo.listCampaigns("tenant-b")).length, 0);

  const audit = await repo.listAuditEvents("tenant-a", campaign.id);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "campaign.created");

  console.log("Video Studio repository isolation passed.");
} finally {
  await vite.close();
}
