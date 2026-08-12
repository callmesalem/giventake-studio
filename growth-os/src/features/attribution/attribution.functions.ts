import { createServerFn } from "@tanstack/react-start";
import { attributionLeadInputSchema, correctionInputSchema } from "./attribution.types";

export const getLeadAttribution = createServerFn({ method: "GET" })
  .validator((input: unknown) => attributionLeadInputSchema.parse(input))
  .handler(async ({ data }) => {
    const server = await import("./attribution.server");
    return server.getLeadAttribution(data);
  });

export const recomputeAttribution = createServerFn({ method: "POST" })
  .validator((input: unknown) => attributionLeadInputSchema.parse(input))
  .handler(async ({ data }) => {
    const server = await import("./attribution.server");
    return server.recomputeCurrentOwnerAttribution(data);
  });

export const correctAttribution = createServerFn({ method: "POST" })
  .validator((input: unknown) => correctionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const server = await import("./attribution.server");
    return server.correctAttribution(data);
  });
