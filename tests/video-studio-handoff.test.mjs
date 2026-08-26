import assert from "node:assert/strict";
import { createServer } from "vite";

const campaign = {
  id: "studio-campaign-123",
  tenantId: "giventake-devs",
  name: "Studio launch campaign",
  goal: "Book qualified discovery calls",
  offer: "Agentic development",
  audience: "Operations leaders with manual workflows",
  callToAction: "Book a discovery call",
  budgetCents: 2500,
  status: "draft",
  currentRevisionId: null,
  createdAt: "2026-08-26T12:00:00.000Z",
  updatedAt: "2026-08-26T12:00:00.000Z",
};

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createVideoAgentHandoffUrl } = await vite.ssrLoadModule(
    "/src/lib/studio/video-agent-handoff.ts",
  );
  const url = new URL(createVideoAgentHandoffUrl(campaign, "https://video.giventakedevs.com"));
  const payload = JSON.parse(url.searchParams.get("studioHandoff"));

  assert.equal(url.origin, "https://video.giventakedevs.com");
  assert.deepEqual(payload, {
    version: "giventake-video-agent/brief@1",
    source: { system: "giventake-studio", campaignId: "studio-campaign-123" },
    brief: {
      name: "Studio launch campaign",
      goal: "Book qualified discovery calls",
      offer: "Agentic development",
      audience: "Operations leaders with manual workflows",
      callToAction: "Book a discovery call",
      tone: "Clear, grounded, and practical",
      primaryColor: "#0c605b",
      accentColor: "#ed715f",
      budgetCents: 2500,
    },
  });
  assert.equal(JSON.stringify(payload).includes("giventake-devs"), false);

  console.log("Studio-to-Video-Agent handoff contract passed.");
} finally {
  await vite.close();
}
