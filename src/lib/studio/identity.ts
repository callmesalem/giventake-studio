import "@tanstack/react-start/server-only";

import { getCookie } from "@tanstack/react-start/server";

import { getAuthenticatedStudioUser } from "./auth";
import { createStudioUserSupabase } from "./supabase.server";
import type { StudioIdentity } from "./types";

export const ACTIVE_STUDIO_TENANT_COOKIE = "gt_studio_active_tenant";

export type StudioAuthUser = {
  id: string;
  email: string;
};

export type StudioMembership = {
  tenantId: string;
  role: StudioIdentity["role"];
};

export class StudioIdentityError extends Error {
  constructor(
    public readonly code:
      "UNAUTHENTICATED" | "TENANT_FORBIDDEN" | "TENANT_SELECTION_REQUIRED" | "ROLE_FORBIDDEN",
  ) {
    super(code);
    this.name = "StudioIdentityError";
  }
}

export async function requireStudioIdentityFrom(input: {
  user: StudioAuthUser | null;
  memberships: StudioMembership[];
  requestedTenantId?: string | null;
}): Promise<StudioIdentity> {
  if (!input.user) throw new StudioIdentityError("UNAUTHENTICATED");

  const requestedTenantId = input.requestedTenantId ?? null;
  const membership = requestedTenantId
    ? input.memberships.find((item) => item.tenantId === requestedTenantId)
    : input.memberships.length === 1
      ? input.memberships[0]
      : null;

  if (!membership) {
    throw new StudioIdentityError(
      requestedTenantId ? "TENANT_FORBIDDEN" : "TENANT_SELECTION_REQUIRED",
    );
  }

  return {
    tenantId: membership.tenantId,
    actorId: input.user.id,
    role: membership.role,
  };
}

export function requireStudioRole(
  identity: StudioIdentity,
  required: "operator" | "reviewer" | "viewer",
): void {
  const rank = { viewer: 1, reviewer: 2, operator: 3 } as const;
  if (rank[identity.role] < rank[required]) throw new StudioIdentityError("ROLE_FORBIDDEN");
}

export async function requireStudioIdentity(): Promise<StudioIdentity> {
  const user = await getAuthenticatedStudioUser();
  if (!user) return requireStudioIdentityFrom({ user: null, memberships: [] });

  const { data, error } = await createStudioUserSupabase()
    .schema("video_studio")
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id);
  if (error || !data) throw new StudioIdentityError("TENANT_FORBIDDEN");

  const memberships = data.flatMap((membership) => {
    if (
      membership.role !== "operator" &&
      membership.role !== "reviewer" &&
      membership.role !== "viewer"
    ) {
      return [];
    }
    return [{ tenantId: membership.tenant_id, role: membership.role }];
  });
  return requireStudioIdentityFrom({
    user,
    memberships,
    requestedTenantId: getCookie(ACTIVE_STUDIO_TENANT_COOKIE) ?? null,
  });
}

function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getStudioIdentity(): StudioIdentity {
  const tenantId = configuredValue("STUDIO_TENANT_ID");
  const actorId = configuredValue("STUDIO_ACTOR_ID");
  if (tenantId && actorId) return { tenantId, actorId, role: "operator" };

  if (process.env.NODE_ENV !== "production") {
    return { tenantId: "giventake-devs", actorId: "local-operator", role: "operator" };
  }

  throw new Error("Studio identity is not configured.");
}
