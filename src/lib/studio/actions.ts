import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  approveEditInputSchema,
  approveStoryboardInputSchema,
  campaignIdSchema,
  createCampaignInputSchema,
  handoffInputSchema,
  studioIdentitySchema,
} from "./schema";
import { getStudioServer } from "./server";
import { runFixtureWorker } from "./worker";

const campaignActionSchema = z.object({
  identity: studioIdentitySchema,
  campaignId: campaignIdSchema,
});

export const createStudioCampaignActionSchema = z.object({
  identity: studioIdentitySchema,
  input: createCampaignInputSchema,
});

function requireMatchingTenant(identityTenantId: string, inputTenantId: string): void {
  if (identityTenantId !== inputTenantId)
    throw new Error("Studio tenant identity does not match input.");
}

export const createStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => createStudioCampaignActionSchema.parse(data))
  .handler(({ data }) => {
    requireMatchingTenant(data.identity.tenantId, data.input.tenantId);
    return getStudioServer().service.createCampaign(data.input, data.identity.actorId);
  });

export const listStudioCampaigns = createServerFn({ method: "POST" })
  .validator((data: unknown) => studioIdentitySchema.parse(data))
  .handler(({ data }) => getStudioServer().repository.listCampaigns(data.tenantId));

export const planStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(({ data }) =>
    getStudioServer().service.planCampaign(
      data.identity.tenantId,
      data.campaignId,
      data.identity.actorId,
    ),
  );

export const approveStudioStoryboard = createServerFn({ method: "POST" })
  .validator((data: unknown) => approveStoryboardInputSchema.parse(data))
  .handler(({ data }) =>
    getStudioServer().service.approveStoryboard(
      data.identity.tenantId,
      data.campaignId,
      data.identity.actorId,
    ),
  );

export const renderStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const server = getStudioServer();
    server.service.queueRender(data.identity.tenantId, data.campaignId, data.identity.actorId);
    return runFixtureWorker(server.repository, data.identity.tenantId, "fixture-worker");
  });

export const approveStudioEdit = createServerFn({ method: "POST" })
  .validator((data: unknown) => approveEditInputSchema.parse(data))
  .handler(({ data }) =>
    getStudioServer().service.approveEdit(
      data.identity.tenantId,
      data.campaignId,
      data.identity.actorId,
    ),
  );

export const handoffStudioExport = createServerFn({ method: "POST" })
  .validator((data: unknown) => handoffInputSchema.parse(data))
  .handler(({ data }) =>
    getStudioServer().service.handoffExport(
      data.identity.tenantId,
      data.campaignId,
      data.identity.actorId,
    ),
  );
