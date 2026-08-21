import type { VideoGenerationRequest, VideoGenerationResult, VideoProvider } from "./provider";

type SoraVideoProviderOptions = {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  model?: "sora-2" | "sora-2-pro";
  size?: "720x1280" | "1280x720" | "1024x1792" | "1792x1024";
};

type SoraVideo = {
  id?: string;
  status?: string;
};

export function createSoraVideoProvider(options: SoraVideoProviderOptions): VideoProvider {
  const fetcher = options.fetch ?? globalThis.fetch;
  const durations = new Map<string, number>();
  const model = options.model ?? "sora-2";
  const size = options.size ?? "720x1280";

  async function request(url: string, init: RequestInit): Promise<SoraVideo> {
    const response = await fetcher(url, init);
    if (!response.ok) throw new Error(`Sora request failed with status ${response.status}.`);
    return (await response.json()) as SoraVideo;
  }

  return {
    name: "sora",
    async estimate() {
      return 0;
    },
    async submit(requestInput: VideoGenerationRequest) {
      const form = new FormData();
      form.set("model", model);
      form.set("prompt", requestInput.scene.prompt);
      form.set("size", size);
      form.set("seconds", String(requestInput.scene.durationSeconds));
      const video = await request("https://api.openai.com/v1/videos", {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}` },
        body: form,
      });
      if (!video.id) throw new Error("Sora did not return a video ID.");
      durations.set(video.id, requestInput.scene.durationSeconds);
      return video.id;
    },
    async poll(providerRequestId) {
      const video = await request(`https://api.openai.com/v1/videos/${providerRequestId}`, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
      });
      if (video.status === "completed") {
        return {
          state: "completed" as const,
          result: {
            providerRequestId,
            assetUrl: `https://api.openai.com/v1/videos/${providerRequestId}/content`,
            durationSeconds: durations.get(providerRequestId) ?? 0,
            costCents: 0,
          },
        };
      }
      if (video.status === "failed") {
        return { state: "failed" as const, category: "provider_failed" as const, retryable: false };
      }
      if (video.status === "cancelled") return { state: "cancelled" as const };
      return { state: "pending" as const, retryAfterMs: 15_000 };
    },
    async cancel(providerRequestId) {
      const response = await fetcher(`https://api.openai.com/v1/videos/${providerRequestId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${options.apiKey}` },
      });
      if (!response.ok) throw new Error(`Sora cancellation failed with status ${response.status}.`);
      durations.delete(providerRequestId);
    },
  };
}
