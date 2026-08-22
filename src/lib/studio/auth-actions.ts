import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  completeStudioAuthCallback,
  requestStudioMagicLinkForEmail,
  signOutStudioUser,
} from "./auth";
import { requireStudioIdentity } from "./identity";

export const requestStudioMagicLink = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ email: z.string() }).parse(data))
  .handler(({ data }) => requestStudioMagicLinkForEmail(data));

export const completeStudioAuthCallbackAction = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ code: z.string() }).parse(data))
  .handler(({ data }) => completeStudioAuthCallback(data.code));

export const getStudioRouteSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const identity = await requireStudioIdentity();
    return { authenticated: true as const, role: identity.role };
  } catch {
    return { authenticated: false as const, role: null };
  }
});

export const signOutStudio = createServerFn({ method: "POST" }).handler(async () => {
  await signOutStudioUser();
  return { signedOut: true as const };
});
