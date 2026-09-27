// The judgements scripts/worker-smoke.mjs makes, kept pure so
// tests/worker-smoke-checks.test.mjs can pin them down without a runtime.

/** The <title> of src/lib/error-page.ts - what production served, with
 *  status 500, on every path during the 2026-09-08 outage. A 200 carrying it
 *  is still a broken page. */
export const ERROR_PAGE_MARKER = "This page didn't load";

/**
 * What the built Worker must answer with no environment at all. Every path
 * here renders without Supabase, Resend or OpenAI configured; anything that
 * needs a secret does not belong in this table.
 *
 * /sign/<token> is the route that took the site down. With no Supabase
 * config its handler refuses with the "Link unavailable" page, which is the
 * exact code path that used to be built at module scope.
 */
export const EXPECTATIONS = Object.freeze([
  { path: "/", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  { path: "/careers", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  { path: "/crm/login", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  {
    path: "/sign/smoke-probe",
    status: 200,
    mustContain: "Link unavailable",
    mustNotContain: ERROR_PAGE_MARKER,
  },
  { path: "/definitely-not-a-page", status: 404 },
]);

/**
 * The compatibility_date pinned in wrangler.jsonc, or null.
 *
 * A regex rather than a JSONC parser: the file is committed, hand-written,
 * and the only thing wanted from it is one dated string. The date form is
 * required, so `"latest"` reads as "not pinned".
 */
export function pinnedCompatibilityDate(wranglerJsoncText) {
  const match = /"compatibility_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(wranglerJsoncText);
  return match ? match[1] : null;
}

/**
 * Null when the response satisfies the expectation, otherwise one line saying
 * what was wrong. Status first: a body check on the wrong status would report
 * the symptom, not the fact.
 */
/**
 * A key for the local smoke run only. Passed to wrangler dev as a --var so the
 * gateway is "configured" without any real secret; 64 characters so it clears
 * the gateway's 43-character floor. Never used anywhere else.
 */
export const MCP_SMOKE_KEY = "smoke-only-not-a-secret-".padEnd(64, "0");

const INITIALIZE = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "worker-smoke", version: "1" },
  },
});

/**
 * The MCP gateway under the real runtime. Two facts: a wrong key is a 401
 * before any MCP parsing, and the right key reaches the SDK handler and gets
 * the server's name back. `initialize` needs no database, so these hold with
 * no other environment. The public-host 404 cannot be exercised here (Node's
 * fetch sets Host from the URL); tests/mcp-auth.test.mjs pins it, and Task 15
 * checks it once in production.
 */
export const MCP_EXPECTATIONS = Object.freeze([
  {
    name: "mcp wrong key",
    path: "/mcp",
    method: "POST",
    headers: {
      authorization: "Bearer wrong-key-wrong-key-wrong-key-wrong-key-wrong-key",
      "content-type": "application/json",
    },
    body: INITIALIZE,
    status: 401,
  },
  {
    name: "mcp initialize",
    path: "/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${MCP_SMOKE_KEY}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: INITIALIZE,
    status: 200,
    mustContain: '"name":"giventake-crm"',
  },
]);

export function evaluate(expectation, response) {
  const { path } = expectation;
  if (response.status !== expectation.status) {
    return `${path}: expected ${expectation.status}, got ${response.status}`;
  }
  if (expectation.mustContain && !response.body.includes(expectation.mustContain)) {
    return `${path}: body does not contain "${expectation.mustContain}"`;
  }
  if (expectation.mustNotContain && response.body.includes(expectation.mustNotContain)) {
    return `${path}: body contains "${expectation.mustNotContain}" - the generic error page`;
  }
  return null;
}
