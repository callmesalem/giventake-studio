/**
 * TanStack Start answers any page request whose Accept header names neither
 * text/html nor * / * with a 500 `{"error":"Only HTML requests are supported
 * here"}` (start-server-core, createStartHandler.js, executeRouter). AI agents
 * and fetch tools send `Accept: text/markdown` or `text/plain`, and
 * Cloudflare's Markdown for Agents needs the origin's HTML for exactly those
 * requests, so on 2026-10-12 every such request to giventakedevs.com was a 500.
 *
 * For a read request the only thing this origin can serve is the page, so ask
 * the router for it. Server routes (/api/*) and server functions never reach
 * that guard; the method check leaves every non-read request untouched.
 */
const SSR_ACCEPTED = ["text/html", "*/*"];

export function acceptsHtml(accept: string | null): boolean {
  return (accept || "*/*")
    .split(",")
    .some((part) => SSR_ACCEPTED.some((mime) => part.trim().startsWith(mime)));
}

export function coerceAcceptForSsr(request: Request): Request {
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  if (acceptsHtml(request.headers.get("accept"))) return request;
  const headers = new Headers(request.headers);
  headers.set("accept", "text/html");
  return new Request(request, { headers });
}
