// src/server/mcp/auth.ts
// The gate in front of the MCP handler: host, configuration, key. Spec section 1.
import {
  recordChannelAuth,
  timingSafeEqual,
  tooManyFailures,
  type AuditClient,
  type PresentedVia,
} from "../channel-auth.ts";

export const SURFACE = "crm-mcp" as const;
export const ALLOWED_HOSTS: readonly string[] = ["crm.giventakedevs.com", "localhost", "127.0.0.1"];
const MIN_KEY_LENGTH = 43;

export interface McpAuthOptions {
  expectedKey: string | undefined;
  audit: AuditClient | null;
  allowedHosts?: readonly string[];
}

export type McpAuthResult = { ok: true } | { ok: false; response: Response };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

/** Bearer first (what Perplexity's own MCP server uses), then x-api-key. */
export function presentedKey(req: Request): { key: string; via: PresentedVia } {
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1] ?? "";
  const apiKey = req.headers.get("x-api-key")?.trim() ?? "";
  const key = bearer || apiKey;
  return { key, via: key ? "header" : "none" };
}

export async function authenticateMcpRequest(
  req: Request,
  options: McpAuthOptions,
): Promise<McpAuthResult> {
  const hosts = options.allowedHosts ?? ALLOWED_HOSTS;
  if (!hosts.includes(new URL(req.url).hostname)) {
    // A plain body on purpose: the public site must not describe an MCP endpoint.
    return { ok: false, response: new Response("Not found", { status: 404 }) };
  }
  if (!options.expectedKey || options.expectedKey.length < MIN_KEY_LENGTH) {
    return { ok: false, response: json(503, { error: "MCP gateway is not configured" }) };
  }
  const { key, via } = presentedKey(req);
  if (!key || !timingSafeEqual(key, options.expectedKey)) {
    // Awaited, so the row exists before the response goes out: the edge
    // function fired this and forgot it, and the audit called that a gap.
    await recordChannelAuth(options.audit, req, {
      surface: SURFACE,
      outcome: "denied",
      presentedVia: via,
    });
    if (key && (await tooManyFailures(options.audit, req, SURFACE))) {
      return {
        ok: false,
        response: json(429, { error: "Too many failed attempts" }, { "retry-after": "300" }),
      };
    }
    return {
      ok: false,
      response: json(401, { error: "Unauthorized" }, { "www-authenticate": "Bearer" }),
    };
  }
  await recordChannelAuth(options.audit, req, {
    surface: SURFACE,
    outcome: "granted",
    presentedVia: via,
  });
  return { ok: true };
}

/** The smallest Supabase client the audit helpers need, over PostgREST. */
export function postgrestAuditClient(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): AuditClient {
  const base = config.url.replace(/\/$/, "");
  const doFetch = config.fetch ?? ((input, init) => fetch(input, init));
  return {
    async rpc(fn, args) {
      try {
        const response = await doFetch(`${base}/rest/v1/rpc/${fn}`, {
          method: "POST",
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(args),
        });
        if (!response.ok) return { data: null, error: `${fn} failed: ${response.status}` };
        // PostgREST answers a `returns void` function with 204 and an empty body.
        // response.json() throws on empty, so we must guard: 204 means success with no data.
        if (response.status === 204) return { data: null, error: null };
        return { data: await response.json(), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
