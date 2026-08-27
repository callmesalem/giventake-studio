/**
 * Server-only implementation behind the CRM auth server functions.
 *
 * This module touches request cookies and the service-role key, so it must never
 * enter the client bundle. It is imported ONLY via dynamic import() from inside
 * server-function handlers in crm-auth.ts (and crm-data.ts); the `.server.ts`
 * suffix and the dynamic import keep it off the client dependency graph.
 */
import {
  getCookie,
  setCookie,
  deleteCookie,
  getRequestHeaders,
} from "@tanstack/react-start/server";
import type { CrmAuth, CrmSession } from "@/server/crm/auth";
import type { CrmLoginInput, AddTeamMemberInput } from "@/lib/crm-auth";

const ACCESS_COOKIE = "gt_crm_at";
const REFRESH_COOKIE = "gt_crm_rt";
const PKCE_COOKIE = "gt_pkce_verifier";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Only Google accounts on this Workspace domain may sign in. */
const ALLOWED_EMAIL_DOMAIN = (
  process.env.CRM_ALLOWED_EMAIL_DOMAIN || "giventakedevs.com"
).toLowerCase();

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

/** Absolute origin of the current request, for building the OAuth redirect URL. */
function siteOrigin(): string {
  const headers = getRequestHeaders();
  const host = headers.get("host") ?? "crm.giventakedevs.com";
  const proto =
    headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const { randomBytes, createHash } = await import("node:crypto");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Begin Google sign-in: store the PKCE verifier and return the authorize URL. */
export async function startGoogleLoginImpl(): Promise<string> {
  const auth = await authClient();
  const { verifier, challenge } = await pkcePair();
  setCookie(PKCE_COOKIE, verifier, cookieOptions(600)); // 10 minutes
  return auth.googleAuthorizeUrl(`${siteOrigin()}/crm/auth/callback`, challenge);
}

/**
 * Complete Google sign-in: exchange the code, enforce the Workspace domain, and
 * set the session cookies. Throws a coded Error the callback route maps to a
 * friendly message.
 */
export async function completeGoogleLoginImpl(code: string): Promise<void> {
  const auth = await authClient();
  const verifier = getCookie(PKCE_COOKIE);
  deleteCookie(PKCE_COOKIE, { path: "/" });
  if (!verifier) throw new Error("missing_pkce");

  const result = await auth.exchangeCodeForSession(code, verifier);
  const email = result.session.email.toLowerCase();
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    // Not a Workspace account for this domain: revoke and refuse.
    await auth.logout(result.tokens.accessToken);
    throw new Error("domain_not_allowed");
  }
  setSessionCookies(result.tokens.accessToken, result.tokens.refreshToken, result.tokens.expiresIn);
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

/** Who a record can be assigned to.
 *
 * Deliberately NOT admin-gated, unlike listTeamMembersImpl: a member has to be
 * able to see colleagues in order to hand work to them. It returns only
 * identity - id, email, name - and never role or anything from the admin API
 * beyond that, so widening the audience does not widen what is disclosed. */
export async function listAssignableMembersImpl(): Promise<{
  members: { userId: string; email: string; fullName: string }[];
}> {
  await requireCrmSession();
  const auth = await authClient();
  const members = await auth.listTeamMembers();
  return {
    members: members.map((m) => ({
      userId: m.userId,
      email: m.email,
      fullName: m.fullName,
    })),
  };
}

export async function listTeamMembersImpl(): Promise<{ members: CrmSession[] }> {
  await requireAdmin();
  const auth = await authClient();
  return { members: await auth.listTeamMembers() };
}
