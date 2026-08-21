import type { StoryboardScene } from "./types";

export type VideoGenerationRequest = {
  campaignId: string;
  tenantId: string;
  scene: StoryboardScene;
};

export type VideoGenerationResult = {
  providerRequestId: string;
  assetUrl: string;
  durationSeconds: number;
  costCents: number;
};

export interface VideoProvider {
  readonly name: string;
  estimate(request: VideoGenerationRequest): Promise<number>;
  submit(request: VideoGenerationRequest): Promise<string>;
  poll(providerRequestId: string): Promise<VideoGenerationResult>;
  cancel(providerRequestId: string): Promise<void>;
}
