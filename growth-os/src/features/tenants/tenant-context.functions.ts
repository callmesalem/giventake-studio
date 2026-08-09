import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const selectTenantSchema = z
  .object({
    tenantId: z.string().uuid(),
  })
  .strict();

export const listAvailableTenants = createServerFn({ method: "GET" }).handler(async () => {
  const { listAvailableTenantOptions } = await import("./tenant-context.server");
  return listAvailableTenantOptions();
});

export const selectTenant = createServerFn({ method: "POST" })
  .validator((input: unknown) => selectTenantSchema.parse(input))
  .handler(async ({ data }) => {
    const [{ ACTIVE_TENANT_COOKIE, selectTenantForCurrentUser }, { setCookie }] = await Promise.all(
      [import("./tenant-context.server"), import("@tanstack/react-start/server")],
    );
    await selectTenantForCurrentUser(data.tenantId);
    setCookie(ACTIVE_TENANT_COOKIE, data.tenantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { selected: true as const };
  });

export const getRouteSession = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getAuthenticatedUser }, { requireTenantContext, TenantContextError }] =
    await Promise.all([import("@/features/auth/auth.server"), import("./tenant-context.server")]);
  const user = await getAuthenticatedUser();
  if (!user) return { authenticated: false, tenantSelected: false };

  try {
    await requireTenantContext();
    return { authenticated: true, tenantSelected: true };
  } catch (error) {
    if (
      error instanceof TenantContextError &&
      (error.code === "TENANT_SELECTION_REQUIRED" || error.code === "TENANT_FORBIDDEN")
    ) {
      return { authenticated: true, tenantSelected: false };
    }
    throw error;
  }
});
