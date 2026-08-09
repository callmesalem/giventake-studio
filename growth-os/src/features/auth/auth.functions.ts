import { createServerFn } from "@tanstack/react-start";
import {
  authCallbackSchema,
  inviteClientOwnerSchema,
  requestMagicLinkSchema,
} from "./auth.schemas";

export const requestMagicLink = createServerFn({ method: "POST" })
  .validator((input: unknown) => requestMagicLinkSchema.parse(input))
  .handler(async ({ data }) => {
    const { requestMagicLinkForEmail } = await import("./auth.server");
    return requestMagicLinkForEmail(data);
  });

export const completeAuthCallback = createServerFn({ method: "POST" })
  .validator((input: unknown) => authCallbackSchema.parse(input))
  .handler(async ({ data }) => {
    const { completeAuthCallback: complete } = await import("./auth.server");
    return complete(data.code);
  });

export const inviteClientOwner = createServerFn({ method: "POST" })
  .validator((input: unknown) => inviteClientOwnerSchema.parse(input))
  .handler(async ({ data }) => {
    const { inviteClientOwner: invite } = await import("./auth.server");
    return invite(data);
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const [{ signOutAuthenticatedUser }, { deleteCookie }] = await Promise.all([
    import("./auth.server"),
    import("@tanstack/react-start/server"),
  ]);

  try {
    await signOutAuthenticatedUser();
  } finally {
    deleteCookie("gt_active_tenant", { path: "/" });
    deleteCookie("gt_support_session", { path: "/" });
  }
  return { signedOut: true as const };
});
