import type { StudioIdentity } from "./types";

function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getStudioIdentity(): StudioIdentity {
  const tenantId = configuredValue("STUDIO_TENANT_ID");
  const actorId = configuredValue("STUDIO_ACTOR_ID");
  if (tenantId && actorId) return { tenantId, actorId };

  if (process.env.NODE_ENV !== "production") {
    return { tenantId: "giventake-devs", actorId: "local-operator" };
  }

  throw new Error("Studio identity is not configured.");
}
