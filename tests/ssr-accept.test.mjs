import test from "node:test";
import assert from "node:assert/strict";
import { acceptsHtml, coerceAcceptForSsr } from "../src/lib/ssr-accept.ts";

const req = (accept, method = "GET") =>
  new Request("https://giventakedevs.com/pricing", {
    method,
    headers: accept === null ? {} : { accept },
  });

test("acceptsHtml mirrors TanStack's guard", () => {
  assert.equal(acceptsHtml("text/html"), true);
  assert.equal(acceptsHtml("*/*"), true);
  assert.equal(acceptsHtml("text/markdown, text/html;q=0.9"), true);
  assert.equal(acceptsHtml(null), true);
  assert.equal(acceptsHtml("text/markdown"), false);
  assert.equal(acceptsHtml("text/plain"), false);
  assert.equal(acceptsHtml("application/json"), false);
});

test("a GET asking for markdown is asked for HTML instead", () => {
  for (const accept of ["text/markdown", "text/plain", "text/*", "application/json"]) {
    const out = coerceAcceptForSsr(req(accept));
    assert.equal(out.headers.get("accept"), "text/html", accept);
    assert.equal(out.url, "https://giventakedevs.com/pricing");
  }
  assert.equal(coerceAcceptForSsr(req("text/markdown", "HEAD")).headers.get("accept"), "text/html");
});

test("requests the router already accepts pass through unchanged", () => {
  for (const accept of ["text/html", "*/*", "text/markdown, text/html;q=0.9", null]) {
    const r = req(accept);
    assert.equal(coerceAcceptForSsr(r), r, String(accept));
  }
});

test("non-read requests are never touched", () => {
  const r = new Request("https://giventakedevs.com/api/webhooks/resend", {
    method: "POST",
    headers: { accept: "application/json" },
    body: "{}",
  });
  assert.equal(coerceAcceptForSsr(r), r);
});
