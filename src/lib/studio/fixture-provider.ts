import { randomUUID } from "node:crypto";

import type { VideoGenerationRequest, VideoGenerationResult, VideoProvider } from "./provider";

export function createFixtureProvider(): VideoProvider {
  const results = new Map<string, VideoGenerationResult>();

  return {
    name: "fixture",
    async estimate() {
      return 0;
    },
    async submit(request) {
      const providerRequestId = randomUUID();
      results.set(providerRequestId, {
        providerRequestId,
        assetUrl: `fixture://video/${request.campaignId}/scene-${request.scene.order}.mp4`,
        durationSeconds: request.scene.durationSeconds,
        costCents: 0,
      });
      return providerRequestId;
    },
    async poll(providerRequestId) {
      const result = results.get(providerRequestId);
      if (!result) throw new Error("Fixture provider request was not found.");
      return { state: "completed", result };
    },
    async cancel(providerRequestId) {
      results.delete(providerRequestId);
    },
  };
}
