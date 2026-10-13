/**
 * Response headers every page from this Worker should carry.
 *
 * Until 2026-10-12 the origin sent none of these: Lighthouse best-practices
 * sat at 82 and the SEO audit listed "no security headers" as its first
 * technical finding. The set is deliberately the conservative one. A full
 * Content-Security-Policy would break the inlined critical CSS and the
 * analytics tags unless every source is enumerated, so CSP here governs only
 * who may frame the site. Anything the app already set wins; these fill gaps.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "frame-ancestors 'self'",
};

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  let changed = false;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value);
      changed = true;
    }
  }
  if (!changed) return response;
  // A new Response over the same body keeps a streamed SSR body streaming.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
