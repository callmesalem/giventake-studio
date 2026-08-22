import { randomUUID } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createCampaignInputSchema, campaignIdSchema } from "./schema";
import { requireStudioIdentity, requireStudioRole } from "./identity";
import { createProductionWorkerClient } from "./production-worker-client";
import { createProviderPolicy } from "./render-job";
import { buildProductionRenderJob, readStudioWorkerConfig } from "./render-request";
import { getStudioServer } from "./server";

const campaignActionSchema = z.object({
  campaignId: campaignIdSchema,
});
const renderCampaignActionSchema = campaignActionSchema.extend({
  idempotencyKey: z.string().uuid().optional(),
});
const createCampaignActionInputSchema = createCampaignInputSchema.omit({ tenantId: true }).strict();

export const createStudioCampaignActionSchema = z.object({
  input: createCampaignActionInputSchema,
});

async function operatorContext() {
  const identity = await requireStudioIdentity();
  requireStudioRole(identity, "operator");
  return identity;
}

async function reviewerContext() {
  const identity = await requireStudioIdentity();
  requireStudioRole(identity, "reviewer");
  return identity;
}

export const createStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => createStudioCampaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await operatorContext();
    const server = await getStudioServer();
    return server.service.createCampaign(
      { ...data.input, tenantId: identity.tenantId },
      identity.actorId,
    );
  });

export const listStudioCampaigns = createServerFn({ method: "POST" })
  .validator(() => z.object({}).parse({}))
  .handler(async () => {
    const identity = await requireStudioIdentity();
    const server = await getStudioServer();
    return server.repository.listCampaigns(identity.tenantId);
  });

export const planStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await operatorContext();
    const server = await getStudioServer();
    return server.service.planCampaign(identity.tenantId, data.campaignId, identity.actorId);
  });

export const approveStudioStoryboard = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await reviewerContext();
    const server = await getStudioServer();
    return server.service.approveStoryboard(identity.tenantId, data.campaignId, identity.actorId);
  });

export const renderStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => renderCampaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await operatorContext();
    const server = await getStudioServer();
    const provider = "fixture";
    const model = "fixture";
    const rateCentsPerSecond = createProviderPolicy(process.env).rateFor(provider, model);
    const job = await server.service.requestRender(
      identity.tenantId,
      data.campaignId,
      identity.actorId,
      {
        provider,
        model,
        idempotencyKey: data.idempotencyKey ?? randomUUID(),
        rateCentsPerSecond,
      },
    );

    if (process.env.STUDIO_OUTBOUND_KILL_SWITCH !== "false") return job;

    const bundle = await server.repository.getRenderJobBundle(identity.tenantId, job.id);
    if (!bundle) throw new Error("Studio render records are unavailable.");
    const worker = createProductionWorkerClient(readStudioWorkerConfig(process.env));
    try {
      const response = await worker.enqueue(buildProductionRenderJob(bundle));
      return server.repository.saveRenderJob({
        ...job,
        workerJobId: response.id,
        status: response.status === "completed" ? "completed" : "submitted",
      });
    } catch {
      await server.repository.saveRenderJob({
        ...job,
        status: "failed",
        failureCode: "WORKER_UNAVAILABLE",
      });
      throw new Error("Studio render worker is unavailable.");
    }
  });

export const approveStudioEdit = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await reviewerContext();
    const server = await getStudioServer();
    return server.service.approveEdit(identity.tenantId, data.campaignId, identity.actorId);
  });

export const handoffStudioExport = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const identity = await reviewerContext();
    const server = await getStudioServer();
    return server.service.handoffExport(identity.tenantId, data.campaignId, identity.actorId);
  });
