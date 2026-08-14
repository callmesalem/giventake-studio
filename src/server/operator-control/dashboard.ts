export interface DashboardRequest {
  host: string | null;
  origin?: string | null;
  remoteAddress?: string | null;
  forwarded?: boolean;
  accessToken?: string | null;
  mutation?: boolean;
}
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const normalizeHost = (value: string | null) => {
  if (!value) return "";
  if (value.startsWith("[")) return value.slice(1, value.indexOf("]"));
  return value.split(":")[0].toLowerCase();
};
const isLoopbackAddress = (value?: string | null) =>
  value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
};

/**
 * Host alone is never identity. Forwarded requests are rejected. When the runtime
 * exposes a peer address it must be loopback; otherwise a server-only 256-bit token
 * (normally provisioned as an HttpOnly cookie) is mandatory.
 */
export function assertDashboardAccess(
  request: DashboardRequest,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.OPERATOR_DASHBOARD_ENABLED !== "true") throw new Response("Not found", { status: 404 });
  const host = normalizeHost(request.host);
  if (!LOOPBACK_HOSTS.has(host) || request.forwarded)
    throw new Response("Forbidden", { status: 403 });
  const configuredToken = env.OPERATOR_DASHBOARD_ACCESS_TOKEN ?? "";
  const tokenValid =
    /^[A-Za-z0-9_-]{43,}$/.test(configuredToken) &&
    typeof request.accessToken === "string" &&
    safeEqual(request.accessToken, configuredToken);
  if (request.remoteAddress ? !isLoopbackAddress(request.remoteAddress) : !tokenValid)
    throw new Response("Forbidden", { status: 403 });
  if (request.mutation) {
    if (!request.origin) throw new Response("Forbidden", { status: 403 });
    let origin: URL;
    try {
      origin = new URL(request.origin);
    } catch {
      throw new Response("Forbidden", { status: 403 });
    }
    if (normalizeHost(origin.host) !== host || !["http:", "https:"].includes(origin.protocol))
      throw new Response("Forbidden", { status: 403 });
  }
  const syntheticRunsEnabled = env.OPERATOR_SYNTHETIC_RUNS_ENABLED === "true";
  const localActorConfigured = /^local:[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(
    env.OPERATOR_LOCAL_HUMAN_ACTOR ?? "",
  );
  return {
    syntheticRunsEnabled,
    mutationsEnabled:
      env.OPERATOR_DASHBOARD_MUTATIONS_ENABLED === "true" &&
      syntheticRunsEnabled &&
      localActorConfigured,
  };
}

export function dashboardConfigForClient(
  request: DashboardRequest,
  env: NodeJS.ProcessEnv = process.env,
) {
  const { mutationsEnabled } = assertDashboardAccess(request, env);
  return { localOnly: true, syntheticOnly: true, readOnly: !mutationsEnabled };
}
