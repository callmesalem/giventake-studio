import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/features/auth/auth.server";
import { createJobSupabase } from "@/lib/server/supabase.server";
import {
  ACTIVE_TENANT_COOKIE,
  SUPPORT_SESSION_COOKIE,
  requireTenantContext,
} from "./tenant-context.server";
import { supportSessionInputSchema, type SupportSessionInput } from "./support.schemas";

export { ACTIVE_TENANT_COOKIE, SUPPORT_SESSION_COOKIE };
export { supportSessionInputSchema };

export class SupportSessionError extends Error {
  constructor(
    public readonly code:
      | "PLATFORM_ADMIN_REQUIRED"
      | "SUPPORT_SESSION_REQUIRED"
      | "SUPPORT_SESSION_INVALID",
  ) {
    super(code);
    this.name = "SupportSessionError";
  }
}

type CookieOptions = {
  expires: Date;
  httpOnly: true;
  path: "/";
  sameSite: "strict";
  secure: true;
};

type StartSupportDependencies = {
  getActor: () => Promise<{ id: string }>;
  isPlatformAdmin: (userId: string) => Promise<boolean>;
  startSession: (input: {
    tenantId: string;
    adminId: string;
    reason: string;
    expiresAt: string;
  }) => Promise<{ sessionId: string; expiresAt: string }>;
  setCookie: (name: string, value: string, options: CookieOptions) => void;
  now: () => Date;
};

export async function startSupportSessionWith(
  input: SupportSessionInput,
  dependencies: StartSupportDependencies,
): Promise<{ sessionId: string; expiresAt: string }> {
  const parsed = supportSessionInputSchema.parse(input);
  const actor = await dependencies.getActor();
  if (!(await dependencies.isPlatformAdmin(actor.id))) {
    throw new SupportSessionError("PLATFORM_ADMIN_REQUIRED");
  }

  const expiresAt = new Date(
    dependencies.now().getTime() + parsed.durationMinutes * 60 * 1000,
  ).toISOString();
  const session = await dependencies.startSession({
    tenantId: parsed.tenantId,
    adminId: actor.id,
    reason: parsed.reason,
    expiresAt,
  });
  const cookieOptions: CookieOptions = {
    expires: new Date(session.expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: true,
  };
  dependencies.setCookie(ACTIVE_TENANT_COOKIE, parsed.tenantId, cookieOptions);
  dependencies.setCookie(SUPPORT_SESSION_COOKIE, session.sessionId, cookieOptions);
  return session;
}

export async function startSupportSession(
  input: SupportSessionInput,
): Promise<{ sessionId: string; expiresAt: string }> {
  const jobSupabase = createJobSupabase();
  return startSupportSessionWith(input, {
    getActor: requireAuthenticatedUser,
    async isPlatformAdmin(userId) {
      const { data, error } = await jobSupabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new SupportSessionError("PLATFORM_ADMIN_REQUIRED");
      return Boolean(data);
    },
    async startSession({ tenantId, adminId, reason, expiresAt }) {
      const { data: sessionId, error } = await jobSupabase.rpc("start_support_session", {
        target_tenant: tenantId,
        target_admin_user: adminId,
        session_reason: reason,
        requested_expires_at: expiresAt,
      });
      if (error || !sessionId) throw new SupportSessionError("SUPPORT_SESSION_INVALID");

      const { data: session, error: sessionError } = await jobSupabase
        .from("support_sessions")
        .select("expires_at")
        .eq("id", sessionId)
        .eq("tenant_id", tenantId)
        .eq("admin_user_id", adminId)
        .single();
      if (sessionError || !session) throw new SupportSessionError("SUPPORT_SESSION_INVALID");
      return { sessionId, expiresAt: session.expires_at };
    },
    setCookie,
    now: () => new Date(),
  });
}

type EndSupportDependencies = {
  getActor: () => Promise<{ id: string }>;
  getSupportSessionId: () => string | undefined;
  endSession: (input: { sessionId: string; adminId: string; requestId: string }) => Promise<void>;
  clearCookie: (name: string, options: { path: "/" }) => void;
  requestId: () => string;
};

export async function endSupportSessionWith(
  dependencies: EndSupportDependencies,
): Promise<{ ended: true }> {
  try {
    const actor = await dependencies.getActor();
    const sessionId = z.string().uuid().safeParse(dependencies.getSupportSessionId());
    if (!sessionId.success) throw new SupportSessionError("SUPPORT_SESSION_REQUIRED");
    await dependencies.endSession({
      sessionId: sessionId.data,
      adminId: actor.id,
      requestId: dependencies.requestId(),
    });
    return { ended: true };
  } finally {
    dependencies.clearCookie(SUPPORT_SESSION_COOKIE, { path: "/" });
    dependencies.clearCookie(ACTIVE_TENANT_COOKIE, { path: "/" });
  }
}

export async function endSupportSession(): Promise<{ ended: true }> {
  const jobSupabase = createJobSupabase();
  return endSupportSessionWith({
    getActor: requireAuthenticatedUser,
    getSupportSessionId: () => getCookie(SUPPORT_SESSION_COOKIE),
    requestId: randomUUID,
    async endSession({ sessionId, adminId, requestId }) {
      const { data, error } = await jobSupabase.rpc("end_support_session", {
        target_session: sessionId,
        target_admin_user: adminId,
        event_request_id: requestId,
      });
      if (error || !data) throw new SupportSessionError("SUPPORT_SESSION_INVALID");
    },
    clearCookie: deleteCookie,
  });
}

type SupportTenant = { id: string; displayName: string };

type SupportAdminDependencies = {
  getActor: () => Promise<{ id: string }>;
  isPlatformAdmin: (userId: string) => Promise<boolean>;
  listTenants: () => Promise<SupportTenant[]>;
};

export async function getSupportAdminDataWith(
  dependencies: SupportAdminDependencies,
): Promise<{ tenants: SupportTenant[] }> {
  const actor = await dependencies.getActor();
  if (!(await dependencies.isPlatformAdmin(actor.id))) {
    throw new SupportSessionError("PLATFORM_ADMIN_REQUIRED");
  }
  return { tenants: await dependencies.listTenants() };
}

export async function getSupportAdminData(): Promise<{ tenants: SupportTenant[] }> {
  const jobSupabase = createJobSupabase();
  return getSupportAdminDataWith({
    getActor: requireAuthenticatedUser,
    async isPlatformAdmin(userId) {
      const { data, error } = await jobSupabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new SupportSessionError("PLATFORM_ADMIN_REQUIRED");
      return Boolean(data);
    },
    async listTenants() {
      const { data, error } = await jobSupabase
        .from("tenants")
        .select("id, display_name")
        .eq("status", "active")
        .order("display_name");
      if (error) throw error;
      return data.map((tenant) => ({ id: tenant.id, displayName: tenant.display_name }));
    },
  });
}

export async function getSupportSessionStatus(): Promise<{
  sessionId: string;
  expiresAt: string;
} | null> {
  const context = await requireTenantContext();
  if (context.role !== "platform_admin") return null;
  const { data, error } = await createJobSupabase()
    .from("support_sessions")
    .select("expires_at")
    .eq("id", context.supportSessionId)
    .eq("tenant_id", context.tenantId)
    .eq("admin_user_id", context.userId)
    .is("revoked_at", null)
    .single();
  if (error || !data) throw new SupportSessionError("SUPPORT_SESSION_INVALID");
  return { sessionId: context.supportSessionId, expiresAt: data.expires_at };
}
