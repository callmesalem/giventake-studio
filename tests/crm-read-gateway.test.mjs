// The four reads the MCP gateway added to CrmRead. listWhere builds a PostgREST
// query from filter expressions; the other three are thin RPC calls. Pinned at
// the wire so a later edit cannot quietly widen what the gateway can ask for.
import test from "node:test";
import assert from "node:assert/strict";
import { CrmRead } from "../src/server/crm/read.ts";

const json = (body) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function harness(reply = () => json([])) {
  const calls = [];
  const read = new CrmRead({
    url: "https://db.example",
    serviceRoleKey: "service-key",
    fetch: async (url, init) => {
      const u = new URL(String(url));
      const call = {
        path: u.pathname,
        search: u.search,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return reply(call);
    },
  });
  return { read, calls };
}

test("listWhere encodes each filter as column=expression and appends order and limit", async () => {
  const { read, calls } = harness();
  await read.listWhere("tasks", { synthetic: "eq.false", is_completed: "eq.false" }, "id,content", "deadline_at.asc", 50);
  assert.equal(calls[0].path, "/rest/v1/tasks");
  assert.equal(
    calls[0].search,
    "?select=id,content&synthetic=eq.false&is_completed=eq.false&order=deadline_at.asc&limit=50",
  );
});

test("listWhere URL-encodes a filter value with spaces and colons", async () => {
  const { read, calls } = harness();
  await read.listWhere("approval_queue", { decided_by: "eq.crm:salem@x.com via agent_perplexity" }, "id", "decided_at.desc", 21);
  assert.match(calls[0].search, /decided_by=eq\.crm%3Asalem%40x\.com%20via%20agent_perplexity/);
});

test("listWhere refuses a filter column that is not a plain identifier", async () => {
  const { read } = harness();
  await assert.rejects(
    () => read.listWhere("tasks", { "id=eq.x&select": "eq.1" }, "id", "created_at.desc", 1),
    /filter column/,
  );
});

test("listApprovals, dealDocuments and capabilitiesFor are RPC calls", async () => {
  const { read, calls } = harness(() => json([]));
  await read.listApprovals("pending");
  await read.dealDocuments("22222222-2222-4222-8222-222222222222");
  await read.capabilitiesFor("agent_perplexity");
  assert.deepEqual(
    calls.map((c) => [c.path, c.body]),
    [
      ["/rest/v1/rpc/approval_queue_list", { p_status: "pending" }],
      ["/rest/v1/rpc/document_list_for_deal", { p_deal_id: "22222222-2222-4222-8222-222222222222" }],
      ["/rest/v1/rpc/agent_capabilities_for", { p_agent: "agent_perplexity" }],
    ],
  );
});
