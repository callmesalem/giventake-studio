import test from "node:test";
import assert from "node:assert/strict";
import { withSecurityHeaders } from "../src/lib/security-headers.ts";

test("every page response carries the five headers", async () => {
  const out = withSecurityHeaders(
    new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
  );
  assert.equal(out.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(out.headers.get("x-content-type-options"), "nosniff");
  assert.equal(out.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(out.headers.get("permissions-policy"), /camera=\(\)/);
  assert.equal(out.headers.get("content-security-policy"), "frame-ancestors 'self'");
  assert.equal(out.headers.get("content-type"), "text/html");
  assert.equal(out.status, 200);
  assert.equal(await out.text(), "<html></html>");
});

test("a header the app already set is left alone", () => {
  const out = withSecurityHeaders(
    new Response("", { headers: { "content-security-policy": "default-src 'self'" } }),
  );
  assert.equal(out.headers.get("content-security-policy"), "default-src 'self'");
  assert.equal(out.headers.get("x-content-type-options"), "nosniff");
});

test("a response that already has them all is returned as-is", () => {
  const first = withSecurityHeaders(new Response(""));
  assert.equal(withSecurityHeaders(first), first);
});
