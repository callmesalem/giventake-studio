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
  const {
    createStudioCampaignActionSchema,
    renderStudioCampaignActionSchema,
    studioRenderEnvironment,
  } = await vite.ssrLoadModule("/src/lib/studio/actions.ts");

  assert.equal(createStudioCampaignActionSchema.safeParse({ input }).success, true);
  assert.equal(
    createStudioCampaignActionSchema.safeParse({ input: { ...input, tenantId: "tenant-a" } })
      .success,
    false,
  );
  assert.equal(createStudioCampaignActionSchema.safeParse({}).success, false);

  assert.equal(
    renderStudioCampaignActionSchema.safeParse({
      campaignId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
  assert.equal(
    renderStudioCampaignActionSchema.safeParse({
      campaignId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    }).success,
    true,
  );
  assert.deepEqual(studioRenderEnvironment({ NODE_ENV: "development" }), {
    NODE_ENV: "development",
    STUDIO_ALLOWED_RENDER_PROVIDERS: "fixture",
    STUDIO_PROVIDER_RATES_JSON: '{"fixture":{"fixture":0}}',
  });
  assert.deepEqual(studioRenderEnvironment({ NODE_ENV: "production" }), {
    NODE_ENV: "production",
  });

  console.log("Video Studio action contracts passed.");
} finally {
  await vite.close();
}
