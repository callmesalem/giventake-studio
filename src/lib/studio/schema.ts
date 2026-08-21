import { z } from "zod";

import { campaignStatuses } from "./types";

const requiredText = z.string().trim().min(3).max(240);

export const createCampaignInputSchema = z.object({
  tenantId: z.string().trim().min(3).max(80),
  name: requiredText,
  goal: requiredText,
  offer: requiredText,
  audience: requiredText,
  callToAction: requiredText,
  budgetCents: z.number().int().positive().max(5_000_000),
});

export const studioIdentitySchema = z.object({
  tenantId: z.string().trim().min(3).max(80),
  actorId: z.string().trim().min(3).max(120),
});

export const campaignStatusSchema = z.enum(campaignStatuses);

export const campaignIdSchema = z.string().trim().min(8).max(128);

export const approveStoryboardInputSchema = z.object({
  identity: studioIdentitySchema,
  campaignId: campaignIdSchema,
});

export const approveEditInputSchema = approveStoryboardInputSchema;
export const handoffInputSchema = approveStoryboardInputSchema;

export type CreateCampaignInput = z.infer<typeof createCampaignInputSchema>;
