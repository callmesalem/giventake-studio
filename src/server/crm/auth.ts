/**
 * Server-only Supabase Auth (GoTrue) helpers for the CRM dashboard.
 *
 * These talk to GoTrue directly with fetch. The service-role key is used as the
 * `apikey` header and NEVER leaves the server. Password login, token refresh and
 * user lookup gate who reaches the CRM read layer; the read layer itself uses the
 * same service-role key to read data server-side.
 *
 * No @supabase/supabase-js dependency: keeps the browser bundle free of any key
 * and any auth SDK. Everything here is import()-ed only from server functions.
 */

type Fetch = typeof globalThis.fetch;

export interface CrmAuthConfig {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

export interface CrmSession {
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "member";
}

export interface CrmTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CrmLoginResult {
  session: CrmSession;
  tokens: CrmTokens;
}

interface GoTrueUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: GoTrueUser;
}

function roleOf(user: GoTrueUser): "admin" | "member" {
  // Authorization role comes ONLY from app_metadata. user_metadata is
  // user-editable (a member can PUT /auth/v1/user {"data":{"role":"admin"}}
  // with their own token), so trusting it here would allow self-escalation to
  // admin. app_metadata is settable only by the service role / admin API.
  return (user.app_metadata ?? {}).role === "admin" ? "admin" : "member";
}

function nameOf(user: GoTrueUser): string {
  const meta = user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name;
  return typeof name === "string" && name.trim() ? name.trim() : (user.email ?? "Unknown");
}

function toSession(user: GoTrueUser): CrmSession {
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: nameOf(user),
    role: roleOf(user),
  };
}

export class CrmAuth {
  readonly #url: string;
  readonly #key: string;
  readonly #fetch: Fetch;

  constructor(config: CrmAuthConfig) {
    if (!config.url || !config.serviceRoleKey) {
      throw new Error("CrmAuth requires url and serviceRoleKey");
    }
    this.#url = config.url.replace(/\/$/, "");
    this.#key = config.serviceRoleKey;
    // Wrap global fetch instead of storing it directly. On the Cloudflare
    // Workers runtime, calling `this.#fetch(...)` when `#fetch` IS the bare
    // global `fetch` throws "Illegal invocation: function called with incorrect
    // `this`" (fetch must run with `this` === globalThis). The wrapper preserves
    // the correct binding. Every Supabase call goes through here, so without
    // this the entire CRM auth/data layer fails on Workers.
    this.#fetch = config.fetch ?? ((input, init) => fetch(input, init));
  }

  #headers(bearer?: string): Record<string, string> {
    return {
      apikey: this.#key,
      Authorization: `Bearer ${bearer ?? this.#key}`,
      "Content-Type": "application/json",
    };
  }

  /** Exchange email + password for a session. Throws on invalid credentials. */
  async login(email: string, password: string): Promise<CrmLoginResult> {
    const res = await this.#fetch(`${this.#url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      // 400 invalid_credentials is the normal wrong-password path.
      throw new Error("invalid_credentials");
    }
    const data = (await res.json()) as GoTrueSession;
    return {
      session: toSession(data.user),
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      },
    };
  }

  /**
   * Build the GoTrue authorize URL for a Google OAuth (PKCE) sign-in. The caller
   * generates the code_verifier, stores it, and passes its s256 challenge here.
   */
  googleAuthorizeUrl(redirectTo: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      provider: "google",
      redirect_to: redirectTo,
      code_challenge: codeChallenge,
      code_challenge_method: "s256",
    });
    return `${this.#url}/auth/v1/authorize?${params.toString()}`;
  }

  /** Exchange an OAuth authorization code (PKCE) for a session. Throws on failure. */
  async exchangeCodeForSession(authCode: string, codeVerifier: string): Promise<CrmLoginResult> {
    const res = await this.#fetch(`${this.#url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
    });
    if (!res.ok) throw new Error("oauth_exchange_failed");
    const data = (await res.json()) as GoTrueSession;
    return {
      session: toSession(data.user),
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      },
    };
  }

  /** Validate an access token and return the session, or null if invalid/expired. */
  async userFromAccessToken(accessToken: string): Promise<CrmSession | null> {
    if (!accessToken) return null;
    const res = await this.#fetch(`${this.#url}/auth/v1/user`, {
      headers: this.#headers(accessToken),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as GoTrueUser;
    if (!user?.id) return null;
    return toSession(user);
  }

  /** Trade a refresh token for a fresh session, or null if the refresh token is dead. */
  async refresh(refreshToken: string): Promise<CrmLoginResult | null> {
    if (!refreshToken) return null;
    const res = await this.#fetch(`${this.#url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GoTrueSession;
    return {
      session: toSession(data.user),
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      },
    };
  }

  /** Best-effort server-side sign out (revokes the refresh token). */
  async logout(accessToken: string): Promise<void> {
    if (!accessToken) return;
    try {
      await this.#fetch(`${this.#url}/auth/v1/logout`, {
        method: "POST",
        headers: this.#headers(accessToken),
      });
    } catch {
      // Clearing the cookies is what actually ends the browser session; ignore.
    }
  }

  /**
   * Admin: create a team member. Uses the service-role key against the GoTrue
   * admin API. Email is confirmed immediately so the member can log in with the
   * temporary password right away. Returns the new user id.
   */
  async createTeamMember(input: {
    email: string;
    password: string;
    fullName: string;
    role: "admin" | "member";
  }): Promise<{ id: string }> {
    const res = await this.#fetch(`${this.#url}/auth/v1/admin/users`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName, role: input.role },
        app_metadata: { role: input.role },
      }),
    });
    if (!res.ok) {
      let msg = `create failed (${res.status})`;
      try {
        const body = (await res.json()) as { msg?: string; message?: string };
        msg = body.msg ?? body.message ?? msg;
      } catch {
        // keep default
      }
      throw new Error(msg);
    }
    const user = (await res.json()) as GoTrueUser;
    return { id: user.id };
  }

  /** Admin: list team members (id, email, name, role). */
  async listTeamMembers(): Promise<CrmSession[]> {
    const res = await this.#fetch(`${this.#url}/auth/v1/admin/users?per_page=200`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(`list members failed (${res.status})`);
    const data = (await res.json()) as { users?: GoTrueUser[] };
    return (data.users ?? []).map(toSession);
  }
}
