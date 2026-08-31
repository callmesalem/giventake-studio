// Shared-secret auth helpers for the Sami channel.
//
// giventake-mcp is gated by one static string, SAMI_CHANNEL_TOKEN. That gate is
// not changed here: the surface is read-only, the token is the only boundary,
// and it must stay long and rotatable. What this module adds is the part that
// was missing — a record that the token was used, and a brake on guessing it.
//
// DELIBERATELY PORTABLE. No Deno globals and no https:// imports live in this
// file, so the edge function stays Deno while these helpers stay importable by
// `node --experimental-strip-types` in tests/. The auth decision is the one part
// of that function worth testing, and it is not testable if it can only run on
// the edge.

/**
 * Only what this module actually calls on a Supabase client.
 *
 * Typed structurally rather than as `any` so these functions cannot quietly grow
 * a second dependency on the client. The edge function passes `any` clients
 * around; that is not a reason for new code to add to it, and a shape this small
 * is cheaper to read than the full client type.
 */
export interface AuditClient {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

export type ChannelSurface = "giventake-mcp";
export type PresentedVia = "header" | "query" | "none";

/**
 * Constant-time string comparison.
 *
 * `a === b` returns as soon as two bytes differ, so how long a failure takes
 * leaks how much of the prefix was right. Over the public internet jitter
 * swamps that signal, so this is hardening rather than a fix for a live hole —
 * but the token is long-lived, shared across every surface, and rotating it
 * means touching every client at once, so the cheap version is worth having.
 *
 * Length is compared first and separately. The loop below runs over `a`, so
 * without that guard a shorter candidate would simply be compared against a
 * prefix of the real token, and the comparison count would leak the length.
 *
 * Note this is true for two empty strings. Callers must refuse an unset token
 * before they get here; see the SAMI_CHANNEL_TOKEN check in giventake-mcp.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * The caller's IP, as far as the edge can tell.
 *
 * `cf-connecting-ip` first. The edge sets it to the peer that actually opened
 * the connection and overwrites anything the client sent under that name, so it
 * is the one value here a caller cannot choose for itself.
 *
 * Then `x-forwarded-for` — and the LAST entry, which is the opposite of the
 * snippet you will find everywhere. Each hop APPENDS as it forwards, so the
 * rightmost entry is the one our own trusted proxy wrote and everything to its
 * left is whatever the client invented before the request arrived. Taking the
 * leftmost is correct only when every hop in the chain is trusted; here the
 * client is one of the hops. Keying a brake on guessing to a value the guesser
 * picks is not a brake at all — he sends a different X-Forwarded-For on each
 * attempt and every attempt is his first.
 *
 * An empty rightmost entry yields null rather than reaching further left. An
 * unidentified caller is allowed through by tooManyFailures, which is a better
 * failure than confidently limiting the wrong person on a value they supplied.
 *
 * Capped at 64 characters because the value lands in an unbounded text column
 * and in an index key.
 */
export function clientIp(req: Request): string | null {
  const direct = req.headers.get("cf-connecting-ip")?.trim().slice(0, 64) ?? "";
  if (direct) return direct;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const nearest = hops[hops.length - 1]?.trim().slice(0, 64) ?? "";
    if (nearest) return nearest;
  }
  return null;
}

/**
 * How the token arrived, for the audit row.
 *
 * Worth recording separately: a query-param token ends up in access logs and
 * browser history in a way a header does not, so if the token ever leaks, the
 * split between `header` and `query` is the first thing that narrows down where
 * from. `none` is the internet knocking rather than an attempt at the token.
 */
export function presentedVia(req: Request, headerName: string, queryParam: string): PresentedVia {
  if (req.headers.get(headerName)) return "header";
  if (new URL(req.url).searchParams.get(queryParam)) return "query";
  return "none";
}

/**
 * Record one token presentation.
 *
 * Never throws, on any path. This is observability, and observability must not
 * be the reason a legitimate request fails — if the write fails, the error goes
 * to the function logs and the request carries on being authorised or refused on
 * its own merits.
 *
 * A null client is not an error either: when the service-role env is missing
 * there is nowhere to write, and the auth decision still has to be made.
 */
export async function recordChannelAuth(
  db: AuditClient | null,
  req: Request,
  entry: {
    surface: ChannelSurface;
    outcome: "granted" | "denied";
    presentedVia: PresentedVia;
  },
): Promise<void> {
  try {
    if (!db) return;
    const { error } = await db.rpc("channel_auth_record", {
      p_surface: entry.surface,
      p_outcome: entry.outcome,
      p_presented_via: entry.presentedVia,
      p_client_ip: clientIp(req),
      p_user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    if (error) console.error("channel_auth_record failed (request continues):", error);
  } catch (e) {
    console.error("channel_auth_record threw (request continues):", e);
  }
}

/**
 * Slow down guessing against the shared token.
 *
 * Applied to DENIALS only, by the caller. A wrong token is either a
 * misconfigured device retrying or somebody trying values, and neither should
 * run at full speed. A correct token is never throttled here: Sami polls, and
 * neither his polling nor a burst of real reads should ever be told to wait.
 *
 * Fails OPEN on every error path — no client, no identifiable IP, an RPC that
 * errors, an RPC that throws. That is the right trade for this one check: the
 * limiter is a brake on guessing, not the gate itself — the token comparison is
 * — and a database hiccup must not lock Salem out of his own agent.
 */
export async function tooManyFailures(
  db: AuditClient | null,
  req: Request,
  surface: ChannelSurface,
  max = 10,
  windowSeconds = 300,
): Promise<boolean> {
  try {
    if (!db) return false;
    const ip = clientIp(req);
    if (!ip) return false;
    const { data, error } = await db.rpc("channel_auth_too_many_failures", {
      p_surface: surface,
      p_client_ip: ip,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("channel_auth_too_many_failures failed (allowing):", error);
      return false;
    }
    // Explicitly `=== true`: the RPC answers "is this caller guessing", and
    // anything that is not a clear yes has to read as no.
    return data === true;
  } catch (e) {
    console.error("channel_auth_too_many_failures threw (allowing):", e);
    return false;
  }
}
