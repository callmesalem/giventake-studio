/**
 * Server-only implementation behind the CRM auth server functions.
 *
 * This module touches request cookies and the service-role key, so it must never
 * enter the client bundle. It is imported ONLY via dynamic import() from inside
 * server-function handlers in crm-auth.ts (and crm-data.ts); the `.server.ts`
 * suffix and the dynamic import keep it off the client dependency graph.
 */
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import type { CrmAuth, CrmSession } from "@/server/crm/auth";
import type { CrmLoginInput, AddTeamMemberInput } from "@/lib/crm-auth";

const ACCESS_COOKIE = "gt_crm_at";
const REFRESH_COOKIE = "gt_crm_rt";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function setSessionCookies(accessToken: string, refreshToken: string, expiresIn: number) {
  setCookie(ACCESS_COOKIE, accessToken, cookieOptions(Math.max(60, expiresIn)));
  setCookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

function clearSessionCookies() {
  deleteCookie(ACCESS_COOKIE, { path: "/" });
  deleteCookie(REFRESH_COOKIE, { path: "/" });
}

async function authClient(): Promise<CrmAuth> {
  const { CrmAuth } = await import("@/server/crm/auth");
  return new CrmAuth(config());
}

/** Validate the access cookie, refreshing transparently; null when logged out. */
export async function resolveCrmSession(): Promise<CrmSession | null> {
  let auth;
  try {
    auth = await authClient();
  } catch {
    return null;
  }

  const accessToken = getCookie(ACCESS_COOKIE);
  if (accessToken) {
    const session = await auth.userFromAccessToken(accessToken);
    if (session) return session;
  }

  const refreshToken = getCookie(REFRESH_COOKIE);
  if (refreshToken) {
    const refreshed = await auth.refresh(refreshToken);
    if (refreshed) {
      setSessionCookies(
        refreshed.tokens.accessToken,
        refreshed.tokens.refreshToken,
        refreshed.tokens.expiresIn,
      );
      return refreshed.session;
    }
  }

  clearSessionCookies();
  return null;
}

export async function requireCrmSession(): Promise<CrmSession> {
  const session = await resolveCrmSession();
  if (!session) throw new Response("Not authenticated", { status: 401 });
  return session;
}

async function requireAdmin(): Promise<CrmSession> {
  const session = await resolveCrmSession();
  if (!session) throw new Response("Not authenticated", { status: 401 });
  if (session.role !== "admin") throw new Response("Admins only", { status: 403 });
  return session;
}

export async function loginImpl(data: CrmLoginInput): Promise<{ session: CrmSession }> {
  const auth = await authClient();
  let result;
  try {
    result = await auth.login(data.email, data.password);
  } catch {
    throw new Response("Invalid email or password", { status: 401 });
  }
  setSessionCookies(result.tokens.accessToken, result.tokens.refreshToken, result.tokens.expiresIn);
  return { session: result.session };
}

export async function logoutImpl(): Promise<{ ok: true }> {
  const accessToken = getCookie(ACCESS_COOKIE);
  if (accessToken) {
    const auth = await authClient();
    await auth.logout(accessToken);
  }
  clearSessionCookies();
  return { ok: true };
}

async function tempPassword(): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(12).toString("base64url");
}

export async function addTeamMemberImpl(
  data: AddTeamMemberInput,
): Promise<{ id: string; email: string; tempPassword: string }> {
  await requireAdmin();
  const auth = await authClient();
  const password = await tempPassword();
  const created = await auth.createTeamMember({
    email: data.email,
    password,
    fullName: data.fullName,
    role: data.role,
  });
  return { id: created.id, email: data.email, tempPassword: password };
}

export async function listTeamMembersImpl(): Promise<{ members: CrmSession[] }> {
  await requireAdmin();
  const auth = await authClient();
  return { members: await auth.listTeamMembers() };
}
