import assert from "node:assert/strict";
import { createServer } from "vite";

const input = {
  name: "Action campaign",
  goal: "Generate qualified inquiries",
  offer: "AI automation",
  audience: "Owners with manual workflows",
  callToAction: "Book a call",
  budgetCents: 2500,
};

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createStudioCampaignActionSchema } = await vite.ssrLoadModule(
    "/src/lib/studio/actions.ts",
  );

  assert.equal(createStudioCampaignActionSchema.safeParse({ input }).success, true);
  assert.equal(
    createStudioCampaignActionSchema.safeParse({ input: { ...input, tenantId: "tenant-a" } })
      .success,
    false,
  );
  assert.equal(createStudioCampaignActionSchema.safeParse({}).success, false);

  console.log("Video Studio action contracts passed.");
} finally {
  await vite.close();
}
