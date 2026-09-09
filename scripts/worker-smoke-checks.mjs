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
