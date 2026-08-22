import { productionRenderJobSchema, type ProductionRenderJob } from "./render-job";
import type { RenderJobBundle } from "./types";

export class StudioWorkerConfigurationError extends Error {
  constructor(public readonly code: "STUDIO_WORKER_CONFIGURATION_INVALID") {
    super(code);
    this.name = "StudioWorkerConfigurationError";
  }
}

export function buildProductionRenderJob(bundle: RenderJobBundle): ProductionRenderJob {
  const { job, campaign, revision, brand } = bundle;
  if (
    job.tenantId !== campaign.tenantId ||
    job.tenantId !== revision.tenantId ||
    job.tenantId !== brand.tenantId ||
    job.campaignId !== campaign.id ||
    job.campaignId !== revision.campaignId ||
    job.revisionId !== revision.id
  ) {
    throw new Error("Persisted render records do not belong to one tenant campaign revision.");
  }

  return productionRenderJobSchema.parse({
    id: job.id,
    tenantId: job.tenantId,
    campaignId: job.campaignId,
    revisionId: job.revisionId,
    provider: job.provider,
    model: job.model,
    budgetCents: job.requestedBudgetCents,
    brand: {
      name: brand.name,
      website: brand.website,
      callToAction: brand.callToAction,
    },
    storyboard: revision.storyboard,
  });
}

export function readStudioWorkerConfig(environment: Record<string, string | undefined>): {
  baseUrl: string;
  sharedSecret: string;
} {
  const rawUrl = environment.STUDIO_WORKER_URL?.trim();
  const sharedSecret = environment.STUDIO_WORKER_SHARED_SECRET?.trim();
  if (!rawUrl || !sharedSecret || !/^[a-f0-9]{64}$/i.test(sharedSecret)) {
    throw new StudioWorkerConfigurationError("STUDIO_WORKER_CONFIGURATION_INVALID");
  }

  try {
    const url = new URL(rawUrl);
    const localHttp =
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "::1"].includes(url.hostname.toLowerCase());
    if (url.protocol !== "https:" && !localHttp) {
      throw new StudioWorkerConfigurationError("STUDIO_WORKER_CONFIGURATION_INVALID");
    }
    return { baseUrl: url.toString().replace(/\/$/, ""), sharedSecret };
  } catch (error) {
    if (error instanceof StudioWorkerConfigurationError) throw error;
    throw new StudioWorkerConfigurationError("STUDIO_WORKER_CONFIGURATION_INVALID");
  }
}
