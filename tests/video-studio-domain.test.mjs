import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

const validCampaign = {
  tenantId: "giventake-devs",
  name: "GivenTake launch creative",
  goal: "Generate qualified project inquiries",
  offer: "Agentic development and AI automation",
  audience: "Owner-operators with manual workflows",
  callToAction: "Book a discovery call",
  budgetCents: 2500,
};

try {
  const { createCampaignInputSchema } = await vite.ssrLoadModule("/src/lib/studio/schema.ts");
  const { assertTransition } = await vite.ssrLoadModule("/src/lib/studio/state-machine.ts");
  const { createProviderPolicy } = await vite.ssrLoadModule("/src/lib/studio/render-job.ts");

  assert.equal(createCampaignInputSchema.safeParse(validCampaign).success, true);
  assert.equal(
    createCampaignInputSchema.safeParse({ ...validCampaign, budgetCents: 0 }).success,
    false,
  );
  assert.throws(
    () => assertTransition("draft", "approved_for_generation"),
    /Invalid campaign transition/,
  );
  assert.doesNotThrow(() =>
    assertTransition("awaiting_storyboard_approval", "approved_for_generation"),
  );
  assert.equal(typeof createProviderPolicy, "function");
  const policy = createProviderPolicy({
    STUDIO_ALLOWED_RENDER_PROVIDERS: "fixture",
    STUDIO_PROVIDER_RATES_JSON: '{"fixture":{"fixture":0}}',
  });
  assert.equal(policy.rateFor("fixture", "fixture"), 0);
  assert.throws(() => policy.rateFor("sora", "sora-2"), /allowlist/i);

  console.log("Video Studio domain contracts passed.");
} finally {
  await vite.close();
}
