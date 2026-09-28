// The decisions behind scripts/worker-smoke.mjs, tested without a runtime.
//
// The runner exists because CI never executed the built Worker under the
// Workers runtime, and on 2026-09-08 a module-scope Response reached
// production green and took every page to 500. The runner's side effects
// (spawn, poll, fetch) are exercised by running it; the judgements it makes
// live here so they can be pinned down exactly.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_PAGE_MARKER,
  EXPECTATIONS,
  MCP_EXPECTATIONS,
  MCP_SMOKE_KEY,
  evaluate,
  pinnedCompatibilityDate,
} from "../scripts/worker-smoke-checks.mjs";

// --- pinnedCompatibilityDate ------------------------------------------------

test("finds the pinned date in a JSONC file with comments around it", () => {
  const text = [
    "{",
    "  // why this is pinned",
    '  "name": "x",',
    '  "compatibility_date": "2026-09-06",',
    '  "routes": [],',
    "}",
  ].join("\n");
  assert.equal(pinnedCompatibilityDate(text), "2026-09-06");
});

test("returns null when no date is pinned", () => {
  assert.equal(pinnedCompatibilityDate('{ "name": "x" }'), null);
});

test("ignores a value that is not a date", () => {
  assert.equal(pinnedCompatibilityDate('{ "compatibility_date": "latest" }'), null);
});

// --- EXPECTATIONS -----------------------------------------------------------

test("the table covers the home page, a CRM page, the public sign route, and a 404", () => {
  const paths = EXPECTATIONS.map((e) => e.path);
  assert.ok(paths.includes("/"));
  assert.ok(paths.some((p) => p.startsWith("/crm/")));
  assert.ok(paths.some((p) => p.startsWith("/sign/")));
  assert.ok(EXPECTATIONS.some((e) => e.status === 404));
});

test("every 200 expectation refuses the generic error page", () => {
  for (const e of EXPECTATIONS.filter((e) => e.status === 200)) {
    assert.equal(e.mustNotContain, ERROR_PAGE_MARKER, e.path);
  }
});

test("the marker is the title src/lib/error-page.ts renders", () => {
  assert.equal(ERROR_PAGE_MARKER, "This page didn't load");
});

// --- evaluate ---------------------------------------------------------------

const home = EXPECTATIONS.find((e) => e.path === "/");
const sign = EXPECTATIONS.find((e) => e.path.startsWith("/sign/"));
const missing = EXPECTATIONS.find((e) => e.status === 404);

test("a wrong status is reported with both numbers", () => {
  const problem = evaluate(home, { status: 500, body: "<h1>This page didn't load</h1>" });
  assert.match(problem, /expected 200/);
  assert.match(problem, /got 500/);
});

test("a 200 that carries the generic error page is still a failure", () => {
  const problem = evaluate(home, { status: 200, body: "<title>This page didn't load</title>" });
  assert.match(problem, /This page didn't load/);
});

test("a healthy page passes", () => {
  assert.equal(evaluate(home, { status: 200, body: "<title>GivenTake Devs</title>" }), null);
});

test("the sign route must show its refusal page, not just answer 200", () => {
  assert.match(evaluate(sign, { status: 200, body: "<title>Signed</title>" }), /Link unavailable/);
  assert.equal(evaluate(sign, { status: 200, body: "<title>Link unavailable</title>" }), null);
});

test("an unknown path must be a 404, and a body is not inspected", () => {
  assert.equal(evaluate(missing, { status: 404, body: "" }), null);
  assert.match(evaluate(missing, { status: 200, body: "" }), /expected 404/);
});

// --- MCP_EXPECTATIONS / MCP_SMOKE_KEY ---------------------------------------

test("the MCP smoke key is long enough for the gateway's minimum and is not a secret", () => {
  assert.ok(MCP_SMOKE_KEY.length >= 43);
  assert.match(MCP_SMOKE_KEY, /^smoke-/);
});

test("the MCP expectations cover a wrong key and a right key", () => {
  const byName = Object.fromEntries(MCP_EXPECTATIONS.map((e) => [e.name, e]));
  assert.equal(byName["mcp wrong key"].status, 401);
  assert.equal(
    byName["mcp wrong key"].headers.authorization,
    "Bearer wrong-key-wrong-key-wrong-key-wrong-key-wrong-key",
  );
  assert.equal(byName["mcp initialize"].status, 200);
  assert.equal(byName["mcp initialize"].mustContain, '"name":"giventake-crm"');
  assert.equal(JSON.parse(byName["mcp initialize"].body).method, "initialize");
  for (const e of MCP_EXPECTATIONS) assert.equal(e.method, "POST", e.name);
});

test("the MCP expectations also pin tools/list's argument schemas", () => {
  const byName = Object.fromEntries(MCP_EXPECTATIONS.map((e) => [e.name, e]));
  const toolsList = byName["mcp tools/list"];
  assert.equal(toolsList.method, "POST");
  assert.equal(toolsList.path, "/mcp");
  assert.equal(toolsList.status, 200);
  assert.equal(toolsList.mustContain, '"lead_id":{');
  assert.equal(JSON.parse(toolsList.body).method, "tools/list");
  // The schema check must stay specific to a JSON Schema property, not just
  // any mention of the term - a bare '"lead_id"' would also match inside a
  // description.
  assert.ok(toolsList.mustContain.endsWith(":{"));
});
