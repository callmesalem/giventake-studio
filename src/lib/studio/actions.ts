import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { campaignIdSchema, createCampaignInputSchema } from "./schema";
import { getStudioIdentity } from "./identity";
import { getStudioServer } from "./server";
import { runFixtureWorker } from "./worker";

const campaignActionSchema = z.object({
  campaignId: campaignIdSchema,
});

export const createStudioCampaignActionSchema = z.object({
  input: createCampaignInputSchema,
});

function requireMatchingTenant(inputTenantId: string): ReturnType<typeof getStudioIdentity> {
  const identity = getStudioIdentity();
  const identityTenantId = identity.tenantId;
  if (identityTenantId !== inputTenantId)
    throw new Error("Studio tenant identity does not match input.");
  return identity;
}

export const createStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => createStudioCampaignActionSchema.parse(data))
  .handler(({ data }) => {
    const identity = requireMatchingTenant(data.input.tenantId);
    return getStudioServer().service.createCampaign(data.input, identity.actorId);
  });

export const listStudioCampaigns = createServerFn({ method: "POST" })
  .validator(() => z.object({}).parse({}))
  .handler(() => getStudioServer().repository.listCampaigns(getStudioIdentity().tenantId));

export const planStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(({ data }) => {
    const identity = getStudioIdentity();
    return getStudioServer().service.planCampaign(
      identity.tenantId,
      data.campaignId,
      identity.actorId,
    );
  });

export const approveStudioStoryboard = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(({ data }) => {
    const identity = getStudioIdentity();
    return getStudioServer().service.approveStoryboard(
      identity.tenantId,
      data.campaignId,
      identity.actorId,
    );
  });

export const renderStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(async ({ data }) => {
    const server = getStudioServer();
    const identity = getStudioIdentity();
    server.service.queueRender(identity.tenantId, data.campaignId, identity.actorId);
    return runFixtureWorker(server.repository, identity.tenantId, "fixture-worker");
  });

export const approveStudioEdit = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(({ data }) => {
    const identity = getStudioIdentity();
    return getStudioServer().service.approveEdit(
      identity.tenantId,
      data.campaignId,
      identity.actorId,
    );
  });

export const handoffStudioExport = createServerFn({ method: "POST" })
  .validator((data: unknown) => campaignActionSchema.parse(data))
  .handler(({ data }) => {
    const identity = getStudioIdentity();
    return getStudioServer().service.handoffExport(
      identity.tenantId,
      data.campaignId,
      identity.actorId,
    );
  });
