import { z } from "zod";

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

const sanitizedReason = z
  .string()
  .trim()
  .min(10)
  .max(500)
  .refine((value) => !containsControlCharacter(value), "Reason contains control characters");

export const supportSessionInputSchema = z
  .object({
    tenantId: z.string().uuid(),
    reason: sanitizedReason,
    durationMinutes: z.number().int().min(1).max(60),
  })
  .strict();

export type SupportSessionInput = z.infer<typeof supportSessionInputSchema>;
