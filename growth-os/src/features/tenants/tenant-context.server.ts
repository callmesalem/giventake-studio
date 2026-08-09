import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { getCookie } from "@tanstack/react-start/server";
import { getAuthenticatedUser } from "@/features/auth/auth.server";
import { createJobSupabase, createUserSupabase } from "@/lib/server/supabase.server";

export const ACTIVE_TENANT_COOKIE = "gt_active_tenant";
export const SUPPORT_SESSION_COOKIE = "gt_support_session";

export type ClientOwnerContext = {
  userId: string;
  tenantId: string;
  role: "client_owner";
  supportSessionId: null;
};

export type TenantContext =
  | ClientOwnerContext
  | {
      userId: string;
      tenantId: string;
      role: "platform_admin";
      supportSessionId: string;
    };

export type TenantOption = {
  id: string;
  displayName: string;
  access: "client_owner" | "platform_admin";
};

type Membership = {
  tenantId: string;
  role: "client_owner";
};

type SupportSession = {
  id: string;
  tenantId: string;
  active: boolean;
  audited: boolean;
};

type ResolveTenantInput = {
  userId: string | null;
  requestedTenantId: string | null;
  requestedSupportSessionId?: string | null;
  memberships: Membership[];
  supportSessions?: SupportSession[];
};

export class TenantContextError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "TENANT_FORBIDDEN"
      | "TENANT_SELECTION_REQUIRED"
      | "SUPPORT_READ_ONLY"
      | "SECURITY_AUDIT_FAILED",
  ) {
    super(code);
    this.name = "TenantContextError";
  }
}

export async function resolveTenantContext(input: ResolveTenantInput): Promise<TenantContext> {
  if (!input.userId) throw new TenantContextError("UNAUTHENTICATED");

  const owners = new Map(input.memberships.map((membership) => [membership.tenantId, membership]));
  const support = new Map(
    (input.supportSessions ?? [])
      .filter(
        (session) =>
          session.id === input.requestedSupportSessionId &&
          session.active &&
          session.audited &&
          !owners.has(session.tenantId),
      )
      .map((session) => [session.tenantId, session]),
  );

  const selectedTenantId = input.requestedTenantId;
  if (selectedTenantId) {
    if (owners.has(selectedTenantId)) {
      return {
        userId: input.userId,
        tenantId: selectedTenantId,
        role: "client_owner",
        supportSessionId: null,
      };
    }

    const supportSession = support.get(selectedTenantId);
    if (supportSession) {
      return {
        userId: input.userId,
        tenantId: selectedTenantId,
        role: "platform_admin",
        supportSessionId: supportSession.id,
      };
    }

    throw new TenantContextError("TENANT_FORBIDDEN");
  }

  const availableTenantIds = [...owners.keys(), ...support.keys()];
  if (availableTenantIds.length !== 1) {
    throw new TenantContextError("TENANT_SELECTION_REQUIRED");
  }

  const tenantId = availableTenantIds[0]!;
  if (owners.has(tenantId)) {
    return {
      userId: input.userId,
      tenantId,
      role: "client_owner",
      supportSessionId: null,
    };
  }

  const supportSession = support.get(tenantId)!;
  return {
    userId: input.userId,
    tenantId,
    role: "platform_admin",
    supportSessionId: supportSession.id,
  };
}

type DeniedAccessEvent = {
  action: "cross_tenant_access_denied";
  actorUserId: string;
  requestedTenantId: string;
  authorizedTenantIds: string[];
  metadata: { reason_code: "tenant_not_allowed" };
};

type TenantContextAdapters = {
  getUserId: () => Promise<string | null>;
  getRequestedTenantId: () => string | null;
  getRequestedSupportSessionId?: () => string | null;
  listMemberships: (userId: string) => Promise<Membership[]>;
  listSupportSessions: (userId: string, sessionId: string | null) => Promise<SupportSession[]>;
  recordDeniedAccess: (event: DeniedAccessEvent) => Promise<void>;
};

export async function resolveTenantContextWithAdapters(
  adapters: TenantContextAdapters,
): Promise<TenantContext> {
  const userId = await adapters.getUserId();
  if (!userId) throw new TenantContextError("UNAUTHENTICATED");

  const requestedSupportSessionId = adapters.getRequestedSupportSessionId?.() ?? null;
  const [memberships, supportSessions] = await Promise.all([
    adapters.listMemberships(userId),
    adapters.listSupportSessions(userId, requestedSupportSessionId),
  ]);
  const requestedTenantId = adapters.getRequestedTenantId();

  try {
    return await resolveTenantContext({
      userId,
      requestedTenantId,
      requestedSupportSessionId,
      memberships,
      supportSessions,
    });
  } catch (error) {
    if (
      requestedTenantId &&
      error instanceof TenantContextError &&
      error.code === "TENANT_FORBIDDEN"
    ) {
      try {
        await adapters.recordDeniedAccess({
          action: "cross_tenant_access_denied",
          actorUserId: userId,
          requestedTenantId,
          authorizedTenantIds: [
            ...new Set([
              ...memberships.map((membership) => membership.tenantId),
              ...supportSessions
                .filter((session) => session.active && session.audited)
                .map((session) => session.tenantId),
            ]),
          ],
          metadata: { reason_code: "tenant_not_allowed" },
        });
      } catch {
        throw new TenantContextError("SECURITY_AUDIT_FAILED");
      }
    }
    throw error;
  }
}

async function loadMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await createUserSupabase()
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", userId);
  if (error) throw error;
  return data.map((membership) => ({
    tenantId: membership.tenant_id,
    role: membership.role,
  }));
}

async function loadSupportSessions(
  userId: string,
  requestedSupportSessionId: string | null,
): Promise<SupportSession[]> {
  if (!requestedSupportSessionId) return [];
  const jobSupabase = createJobSupabase();
  const now = new Date().toISOString();
  const { data: sessions, error } = await jobSupabase
    .from("support_sessions")
    .select("id, tenant_id, expires_at, revoked_at")
    .eq("id", requestedSupportSessionId)
    .eq("admin_user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", now);
  if (error) throw error;
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((session) => session.id);
  const { data: auditEvents, error: auditError } = await jobSupabase
    .from("audit_events")
    .select("target_id")
    .eq("action", "support.started")
    .in("target_id", sessionIds);
  if (auditError) throw auditError;
  const auditedSessionIds = new Set(auditEvents.map((event) => event.target_id));

  return sessions.map((session) => ({
    id: session.id,
    tenantId: session.tenant_id,
    active: session.revoked_at === null && session.expires_at > now,
    audited: auditedSessionIds.has(session.id),
  }));
}

type DeniedAuditAdapters = {
  findRequestedTenant: (tenantId: string) => Promise<string | null>;
  writeAudit: (tenantId: string, event: DeniedAccessEvent) => Promise<void>;
};

export async function persistCrossTenantDenied(
  event: DeniedAccessEvent,
  adapters: DeniedAuditAdapters,
): Promise<void> {
  try {
    const requestedTenant = await adapters.findRequestedTenant(event.requestedTenantId);
    const auditTenantId = requestedTenant ?? event.authorizedTenantIds[0] ?? null;
    if (!auditTenantId) throw new TenantContextError("SECURITY_AUDIT_FAILED");
    await adapters.writeAudit(auditTenantId, event);
  } catch {
    throw new TenantContextError("SECURITY_AUDIT_FAILED");
  }
}

async function recordCrossTenantDenied(event: DeniedAccessEvent): Promise<void> {
  const jobSupabase = createJobSupabase();
  return persistCrossTenantDenied(event, {
    async findRequestedTenant(tenantId) {
      const { data, error } = await jobSupabase
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    async writeAudit(tenantId, deniedEvent) {
      const { error } = await jobSupabase.rpc("write_audit_event", {
        target_tenant: tenantId,
        event_action: deniedEvent.action,
        event_target_type: "tenant_context",
        event_target_id: tenantId,
        event_request_id: randomUUID(),
        event_metadata: deniedEvent.metadata,
        event_actor_user_id: deniedEvent.actorUserId,
      });
      if (error) throw error;
    },
  });
}

function createTenantContextAdapters(): TenantContextAdapters {
  return {
    async getUserId() {
      return (await getAuthenticatedUser())?.id ?? null;
    },
    getRequestedTenantId() {
      return getCookie(ACTIVE_TENANT_COOKIE) ?? null;
    },
    getRequestedSupportSessionId() {
      return getCookie(SUPPORT_SESSION_COOKIE) ?? null;
    },
    listMemberships: loadMemberships,
    listSupportSessions: loadSupportSessions,
    recordDeniedAccess: recordCrossTenantDenied,
  };
}

export async function requireTenantContext(): Promise<TenantContext> {
  return resolveTenantContextWithAdapters(createTenantContextAdapters());
}

export function assertClientOwnerContext(context: TenantContext): ClientOwnerContext {
  if (context.role !== "client_owner") {
    throw new TenantContextError("SUPPORT_READ_ONLY");
  }
  return context;
}

export async function requireClientOwnerContext(): Promise<ClientOwnerContext> {
  return assertClientOwnerContext(await requireTenantContext());
}

export async function selectTenantForCurrentUser(tenantId: string): Promise<TenantContext> {
  const adapters = createTenantContextAdapters();
  return resolveTenantContextWithAdapters({
    ...adapters,
    getRequestedTenantId: () => tenantId,
  });
}

export async function listAvailableTenantOptions(): Promise<TenantOption[]> {
  const user = await getAuthenticatedUser();
  if (!user) throw new TenantContextError("UNAUTHENTICATED");

  const [memberships, supportSessions] = await Promise.all([
    loadMemberships(user.id),
    loadSupportSessions(user.id, getCookie(SUPPORT_SESSION_COOKIE) ?? null),
  ]);
  const accessByTenant = new Map<string, TenantOption["access"]>();
  for (const session of supportSessions) {
    if (session.active && session.audited) accessByTenant.set(session.tenantId, "platform_admin");
  }
  for (const membership of memberships) {
    accessByTenant.set(membership.tenantId, "client_owner");
  }

  const tenantIds = [...accessByTenant.keys()];
  if (tenantIds.length === 0) return [];

  const { data, error } = await createUserSupabase()
    .from("tenants")
    .select("id, display_name")
    .eq("status", "active")
    .in("id", tenantIds)
    .order("display_name");
  if (error) throw error;

  return data.map((tenant) => ({
    id: tenant.id,
    displayName: tenant.display_name,
    access: accessByTenant.get(tenant.id)!,
  }));
}
