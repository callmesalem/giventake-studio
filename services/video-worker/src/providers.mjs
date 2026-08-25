import { randomUUID } from "node:crypto";

export function createFixtureProvider() {
  const completed = new Map();
  return {
    async submit({ campaignId, scene }) {
      const providerRequestId = randomUUID();
      completed.set(providerRequestId, {
        providerRequestId,
        assetUrl: `fixture://video/${campaignId}/scene-${scene.order}.mp4`,
        durationSeconds: scene.durationSeconds,
        costCents: 0,
      });
      return providerRequestId;
    },
    async poll(providerRequestId) {
      const result = completed.get(providerRequestId);
      if (!result) return { state: "failed", category: "provider_failed", retryable: false };
      return { state: "completed", result };
    },
  };
}

export function createProviderRegistry({ fixture = createFixtureProvider(), sora } = {}) {
  return Object.fromEntries(
    Object.entries({ fixture, sora }).filter(([, provider]) => Boolean(provider)),
  );
}
