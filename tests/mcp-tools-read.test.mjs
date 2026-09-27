// tests/mcp-tools-read.test.mjs
// The read tools against a fake read port that records the queries. What is
// pinned: every list filters synthetic rows out, limits are clamped, a search
// term cannot alter the PostgREST filter, and get_lead resolves by id or email.
import test from "node:test";
import assert from "node:assert/strict";
import { readTools, sanitizeSearchTerm } from "../src/server/mcp/tools-read.ts";

const LEAD = "11111111-1111-4111-8111-111111111111";
const parse = (result) => JSON.parse(result.content[0].text);

function fakeDeps({ rows = {}, byId = {}, mail = null } = {}) {
  const calls = [];
  const read = {
    async listWhere(table, filters, select, order, limit) {
      calls.push({ op: "listWhere", table, filters, select, order, limit });
      return rows[table] ?? [];
    },
    async getById(table, id, select) {
      calls.push({ op: "getById", table, id, select });
      return byId[`${table}:${id}`] ?? null;
    },
    async relatedBy(table, column, value, select, order, limit) {
      calls.push({ op: "relatedBy", table, column, value, select, order, limit });
      return rows[table] ?? [];
    },
    async searchIn(table, columns, term, select, limit) {
      calls.push({ op: "searchIn", table, columns, term, select, limit });
      return rows[table] ?? [];
    },
    async listStages() {
      return [{ name: "Discovery", sort_order: 1 }];
    },
    async systemControl() {
      return { operatorsEnabled: true, outboundEnabled: false, reason: "x", updatedAt: null };
    },
    async listApprovals() {
      return [];
    },
    async dealDocuments(dealId) {
      calls.push({ op: "dealDocuments", dealId });
      return [];
    },
    async capabilitiesFor(agent) {
      calls.push({ op: "capabilitiesFor", agent });
      return [{ capability: "note_upsert", enabled: true }];
    },
  };
  const deps = {
    read,
    actions: {},
    executor: {},
    mail,
    config: {
      agent: "agent_perplexity",
      operatorEmail: "salem@giventakedevs.com",
      executeHourlyLimit: 20,
    },
    now: () => new Date("2026-09-24T12:00:00Z"),
  };
  return { deps, calls };
}

const tool = (deps, name) => {
  const spec = readTools(() => deps).find((t) => t.name === name);
  assert.ok(spec, `${name} registered`);
  return spec;
};

test("every read tool is marked read-only and the set is exactly the spec's", () => {
  const specs = readTools(() => ({}));
  assert.deepEqual(specs.map((s) => s.name).sort(), [
    "get_company",
    "get_deal",
    "get_lead",
    "list_companies",
    "list_contacts",
    "list_deals",
    "list_leads",
    "list_tasks",
    "mail_inbox",
    "pipeline_summary",
    "recent_activity",
    "search",
    "system_status",
  ]);
  for (const s of specs) assert.equal(s.readOnly, true, s.name);
});

test("list_leads filters synthetic rows, applies the status filter and clamps the limit", async () => {
  const { deps, calls } = fakeDeps({ rows: { leads: [{ id: LEAD, name: "Ana" }] } });
  const result = await tool(deps, "list_leads").handler({ status: "new", limit: 500 });
  assert.equal(parse(result).data.count, 1);
  assert.deepEqual(calls[0].filters, { synthetic: "eq.false", status: "eq.new" });
  assert.equal(calls[0].limit, 100);
  assert.equal(calls[0].order, "created_at.desc");
});

test("list_leads default limit is 20 and status is optional", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "list_leads").handler({});
  assert.deepEqual(calls[0].filters, { synthetic: "eq.false" });
  assert.equal(calls[0].limit, 20);
});

test("get_lead by id returns the lead with its notes and touchpoints", async () => {
  const { deps, calls } = fakeDeps({
    byId: { [`leads:${LEAD}`]: { id: LEAD, name: "Ana", synthetic: false } },
    rows: { notes: [{ content: "n" }], touchpoints: [{ kind: "email", content: "t" }] },
  });
  const data = parse(await tool(deps, "get_lead").handler({ lead_id: LEAD })).data;
  assert.equal(data.found, true);
  assert.equal(data.lead.name, "Ana");
  assert.equal(data.notes.length, 1);
  assert.equal(data.touchpoints.length, 1);
  assert.ok(
    calls.some(
      (c) =>
        c.op === "relatedBy" && c.table === "notes" && c.column === "lead_id" && c.value === LEAD,
    ),
  );
});

test("get_lead by email matches case-insensitively and exactly, not as a substring", async () => {
  const { deps } = fakeDeps({
    rows: {
      leads: [
        { id: LEAD, email: "Ana@Example.com", synthetic: false },
        { id: "x", email: "ana@example.com.au", synthetic: false },
      ],
    },
  });
  const data = parse(await tool(deps, "get_lead").handler({ email: "ana@example.com" })).data;
  assert.equal(data.found, true);
  assert.equal(data.lead.id, LEAD);
});

test("get_lead needs an id or an email, and reports not found plainly", async () => {
  const { deps } = fakeDeps();
  assert.equal((await tool(deps, "get_lead").handler({})).isError, true);
  assert.equal(parse(await tool(deps, "get_lead").handler({ lead_id: LEAD })).data.found, false);
});

test("a synthetic lead is reported as not found even when it exists", async () => {
  const { deps } = fakeDeps({ byId: { [`leads:${LEAD}`]: { id: LEAD, synthetic: true } } });
  assert.equal(parse(await tool(deps, "get_lead").handler({ lead_id: LEAD })).data.found, false);
});

test("pipeline_summary groups deals by stage and leads by status and counts open tasks", async () => {
  const { deps } = fakeDeps({
    rows: {
      deals: [
        { stage: "Discovery", value_usd: 100 },
        { stage: "Discovery", value_usd: 50.5 },
        { stage: null, value_usd: null },
      ],
      leads: [{ status: "new" }, { status: "new" }, { status: null }],
      tasks: [{ is_completed: false }, { is_completed: true }],
    },
  });
  const data = parse(await tool(deps, "pipeline_summary").handler({})).data;
  assert.deepEqual(data.deals_by_stage, {
    Discovery: { deals: 2, value_usd: 150.5 },
    "(no stage)": { deals: 1, value_usd: 0 },
  });
  assert.equal(data.total_deal_value_usd, 150.5);
  assert.deepEqual(data.leads_by_status, { new: 2, "(no status)": 1 });
  assert.equal(data.open_tasks, 1);
  assert.equal(data.stages[0].name, "Discovery");
});

test("list_tasks computes overdue against today and hides completed tasks by default", async () => {
  const { deps, calls } = fakeDeps({
    rows: {
      tasks: [
        { id: "a", is_completed: false, deadline_at: "2026-09-01T00:00:00Z" },
        { id: "b", is_completed: false, deadline_at: "2026-10-01T00:00:00Z" },
        { id: "c", is_completed: false, deadline_at: null },
      ],
    },
  });
  const data = parse(await tool(deps, "list_tasks").handler({})).data;
  assert.deepEqual(
    data.tasks.map((t) => t.overdue),
    [true, false, false],
  );
  assert.deepEqual(calls[0].filters, { synthetic: "eq.false", is_completed: "eq.false" });
  const { deps: d2, calls: c2 } = fakeDeps();
  await tool(d2, "list_tasks").handler({ include_completed: true });
  assert.deepEqual(c2[0].filters, { synthetic: "eq.false" });
});

test("sanitizeSearchTerm strips PostgREST filter syntax and caps length", () => {
  assert.equal(sanitizeSearchTerm("ana,(email.eq.x)*"), "anaemail.eq.x");
  assert.equal(sanitizeSearchTerm("  Sample Electric  "), "Sample Electric");
  assert.equal(sanitizeSearchTerm("x".repeat(100)).length, 60);
});

test("search runs one query per table with the sanitized term and refuses an empty one", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "search").handler({ query: "sam,ple" });
  const searched = calls.filter((c) => c.op === "searchIn");
  assert.deepEqual(searched.map((c) => c.table).sort(), [
    "companies",
    "contacts",
    "deals",
    "leads",
  ]);
  for (const c of searched) assert.equal(c.term, "sample");
  assert.equal((await tool(deps, "search").handler({ query: "(),*" })).isError, true);
});

test("get_deal returns the deal, its stage events and documents", async () => {
  const DEAL = "22222222-2222-4222-8222-222222222222";
  const { deps, calls } = fakeDeps({
    byId: { [`deals:${DEAL}`]: { id: DEAL, name: "D", synthetic: false } },
    rows: { deal_stage_events: [{ to_stage: "Close" }] },
  });
  const data = parse(await tool(deps, "get_deal").handler({ deal_id: DEAL })).data;
  assert.equal(data.deal.name, "D");
  assert.equal(data.stage_events.length, 1);
  assert.ok(calls.some((c) => c.op === "dealDocuments" && c.dealId === DEAL));
});

test("mail_inbox returns only thread metadata and refuses when the mail store is absent", async () => {
  const { deps } = fakeDeps({
    mail: {
      async listInbox() {
        return [
          {
            id: "t1",
            subject: "Hi",
            snippet: "…",
            participants: ["a@x.com"],
            messageCount: 2,
            lastMessageAt: null,
            unread: true,
            contactId: null,
            dealId: null,
            companyId: null,
            contactName: null,
            dealName: null,
            companyName: null,
            gmailThreadId: "g",
          },
        ];
      },
    },
  });
  const data = parse(await tool(deps, "mail_inbox").handler({})).data;
  assert.equal(data.threads[0].subject, "Hi");
  assert.equal("gmailThreadId" in data.threads[0], false);
  const { deps: none } = fakeDeps({ mail: null });
  assert.equal((await tool(none, "mail_inbox").handler({})).isError, true);
});

test("system_status reports the kill switches and Perplexity's capabilities", async () => {
  const { deps, calls } = fakeDeps();
  const data = parse(await tool(deps, "system_status").handler({})).data;
  assert.equal(data.operators_enabled, true);
  assert.equal(data.outbound_enabled, false);
  assert.deepEqual(data.capabilities, [{ capability: "note_upsert", enabled: true }]);
  assert.ok(calls.some((c) => c.op === "capabilitiesFor" && c.agent === "agent_perplexity"));
});
