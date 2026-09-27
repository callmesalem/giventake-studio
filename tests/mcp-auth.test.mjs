// tests/mcp-auth.test.mjs
// The gate in front of the MCP handler. Order matters: host first (the public
// site never grows an MCP endpoint), then configuration, then the key. Every
// key decision is audited and a wrong key is throttled; a right key never is.
import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateMcpRequest,
  presentedKey,
  postgrestAuditClient,
} from "../src/server/mcp/auth.ts";

const KEY = "k".repeat(43);
const CRM = "https://crm.giventakedevs.com/mcp";
const req = (url = CRM, headers = {}) => new Request(url, { method: "POST", headers });

function audit({ tooMany = false } = {}) {
  const calls = [];
  return {
    calls,
    async rpc(fn, args) {
      calls.push([fn, args]);
      if (fn === "channel_auth_too_many_failures") return { data: tooMany, error: null };
      return { data: null, error: null };
    },
  };
}

test("presentedKey reads a bearer token, then x-api-key, else nothing", () => {
  assert.deepEqual(presentedKey(req(CRM, { authorization: `Bearer ${KEY}` })), {
    key: KEY,
    via: "header",
  });
  assert.deepEqual(presentedKey(req(CRM, { "x-api-key": KEY })), { key: KEY, via: "header" });
  assert.deepEqual(presentedKey(req(CRM, { authorization: "Basic abc" })), {
    key: "",
    via: "none",
  });
  assert.deepEqual(presentedKey(req()), { key: "", via: "none" });
});

test("the public host gets a plain 404 before anything else is looked at", async () => {
  const a = audit();
  const result = await authenticateMcpRequest(
    req("https://giventakedevs.com/mcp", { authorization: `Bearer ${KEY}` }),
    { expectedKey: KEY, audit: a },
  );
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 404);
  assert.equal(await result.response.text(), "Not found");
  assert.equal(a.calls.length, 0);
});

test("localhost and 127.0.0.1 are allowed for the smoke test", async () => {
  for (const host of ["http://localhost:8788/mcp", "http://127.0.0.1:8788/mcp"]) {
    const result = await authenticateMcpRequest(req(host, { authorization: `Bearer ${KEY}` }), {
      expectedKey: KEY,
      audit: null,
    });
    assert.equal(result.ok, true, host);
  }
});

test("an unset or short key is a 503, not a 401", async () => {
  for (const expectedKey of [undefined, "", "short"]) {
    const result = await authenticateMcpRequest(req(CRM, { authorization: `Bearer ${KEY}` }), {
      expectedKey,
      audit: null,
    });
    assert.equal(result.ok, false);
    assert.equal(result.response.status, 503, String(expectedKey));
  }
});

test("no key: 401 with WWW-Authenticate, audited as denied/none", async () => {
  const a = audit();
  const result = await authenticateMcpRequest(req(), { expectedKey: KEY, audit: a });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 401);
  assert.equal(result.response.headers.get("www-authenticate"), "Bearer");
  assert.deepEqual(a.calls[0][0], "channel_auth_record");
  assert.equal(a.calls[0][1].p_surface, "crm-mcp");
  assert.equal(a.calls[0][1].p_outcome, "denied");
  assert.equal(a.calls[0][1].p_presented_via, "none");
  assert.equal(
    a.calls.some(([fn]) => fn === "channel_auth_too_many_failures"),
    false,
  );
});

test("a wrong key: audited, limiter consulted, 401", async () => {
  const a = audit();
  const result = await authenticateMcpRequest(
    req(CRM, { authorization: `Bearer ${"w".repeat(43)}`, "cf-connecting-ip": "203.0.113.9" }),
    { expectedKey: KEY, audit: a },
  );
  assert.equal(result.response.status, 401);
  assert.deepEqual(
    a.calls.map(([fn]) => fn),
    ["channel_auth_record", "channel_auth_too_many_failures"],
  );
});

test("a wrong key from a guessing caller: 429 with Retry-After", async () => {
  const a = audit({ tooMany: true });
  const result = await authenticateMcpRequest(
    req(CRM, { "x-api-key": "w".repeat(43), "cf-connecting-ip": "203.0.113.9" }),
    { expectedKey: KEY, audit: a },
  );
  assert.equal(result.response.status, 429);
  assert.equal(result.response.headers.get("retry-after"), "300");
});

test("the right key: ok, audited as granted, never throttled", async () => {
  const a = audit({ tooMany: true });
  const result = await authenticateMcpRequest(req(CRM, { authorization: `Bearer ${KEY}` }), {
    expectedKey: KEY,
    audit: a,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    a.calls.map(([fn]) => fn),
    ["channel_auth_record"],
  );
  assert.equal(a.calls[0][1].p_outcome, "granted");
});

test("a key of the right length but different content is refused", async () => {
  const result = await authenticateMcpRequest(
    req(CRM, { authorization: `Bearer ${"k".repeat(42)}x` }),
    { expectedKey: KEY, audit: null },
  );
  assert.equal(result.ok, false);
});

test("postgrestAuditClient posts the RPC with the service key and never throws", async () => {
  const seen = [];
  const client = postgrestAuditClient({
    url: "https://db.example/",
    serviceRoleKey: "svc",
    fetch: async (url, init) => {
      seen.push([String(url), init]);
      return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await client.rpc("channel_auth_too_many_failures", { p_surface: "crm-mcp" });
  assert.deepEqual(result, { data: true, error: null });
  assert.equal(seen[0][0], "https://db.example/rest/v1/rpc/channel_auth_too_many_failures");
  assert.equal(seen[0][1].headers.apikey, "svc");
  const failing = postgrestAuditClient({
    url: "https://db.example",
    serviceRoleKey: "svc",
    fetch: async () => {
      throw new Error("down");
    },
  });
  const failed = await failing.rpc("channel_auth_record", {});
  assert.equal(failed.data, null);
  assert.ok(failed.error);
});
