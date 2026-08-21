import assert from "node:assert/strict";
import { createServer } from "vite";

const calls = [];
const fetchMock = async (url, init = {}) => {
  calls.push({ url, init });
  if (init.method === "POST") {
    return new Response(JSON.stringify({ id: "video_123" }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: "video_123", status: "completed" }), {
    status: 200,
  });
};

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createSoraVideoProvider } = await vite.ssrLoadModule("/src/lib/studio/sora-provider.ts");
  const provider = createSoraVideoProvider({ apiKey: "test-key", fetch: fetchMock });
  const providerRequestId = await provider.submit({
    tenantId: "giventake-devs",
    campaignId: "campaign-1",
    scene: {
      order: 1,
      durationSeconds: 5,
      purpose: "hook",
      narration: "A clear opening",
      prompt: "Cinematic business opening",
      safeArea: "bottom",
    },
  });

  assert.equal(providerRequestId, "video_123");
  assert.equal(calls[0].url, "https://api.openai.com/v1/videos");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.equal(calls[0].init.body.get("model"), "sora-2");
  assert.equal(calls[0].init.body.get("seconds"), "5");

  const result = await provider.poll(providerRequestId);
  assert.equal(result.assetUrl, "https://api.openai.com/v1/videos/video_123/content");
  assert.equal(calls[1].url, "https://api.openai.com/v1/videos/video_123");

  console.log("Video Studio Sora provider contract passed.");
} finally {
  await vite.close();
}
