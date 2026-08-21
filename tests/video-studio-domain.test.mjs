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

  console.log("Video Studio domain contracts passed.");
} finally {
  await vite.close();
}
