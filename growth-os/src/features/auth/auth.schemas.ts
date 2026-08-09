import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((email) => email.toLowerCase());

export const requestMagicLinkSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const authCallbackSchema = z
  .object({
    code: z.string().trim().min(1).max(2048),
  })
  .strict();

export const inviteClientOwnerSchema = z
  .object({
    email: emailSchema,
    tenantId: z.string().uuid(),
  })
  .strict();

export type RequestMagicLinkInput = z.input<typeof requestMagicLinkSchema>;
export type AuthCallbackInput = z.input<typeof authCallbackSchema>;
export type InviteClientOwnerInput = z.input<typeof inviteClientOwnerSchema>;
