// CrmActions holds the service-role key, and service_role has no write privilege
// on any table (20260918120000_service_role_grants_reconciliation.sql). Every
// write therefore has to arrive as an RPC. These tests pin the wire contract of
// the six methods that used to PATCH and POST tables directly, and the rule
// itself: nothing this class sends may address a table.
import test from "node:test";
import assert from "node:assert/strict";
import { CrmActions } from "../src/server/crm/actions.ts";

const LEAD = "11111111-1111-4111-8111-111111111111";
const DEAL = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const PROJECT = "55555555-5555-4555-8555-555555555555";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function harness(reply = () => json(null)) {
  const calls = [];
  const actions = new CrmActions({
    url: "https://db.example",
    serviceRoleKey: "service-key",
    fetch: async (url, init) => {
      const call = {
        path: new URL(String(url)).pathname,
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return reply(call);
    },
  });
  return { actions, calls };
}

test("setLeadStatus goes through the lead_set_status RPC", async () => {
  const { actions, calls } = harness();
  await actions.setLeadStatus(LEAD, "converted");
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/lead_set_status",
      method: "POST",
      body: { p_lead_id: LEAD, p_status: "converted" },
    },
  ]);
});

test("linkDealToLead goes through the deal_link_lead RPC", async () => {
  const { actions, calls } = harness();
  await actions.linkDealToLead(DEAL, LEAD);
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/deal_link_lead",
      method: "POST",
      body: { p_deal_id: DEAL, p_lead_id: LEAD },
    },
  ]);
});

test("assign goes through the crm_assign RPC", async () => {
  const { actions, calls } = harness();
  await actions.assign("deals", "assigned_to", DEAL, USER);
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/crm_assign",
      method: "POST",
      body: { p_table: "deals", p_column: "assigned_to", p_id: DEAL, p_user_id: USER },
    },
  ]);
});

test("assign can clear an owner by sending null", async () => {
  const { actions, calls } = harness();
  await actions.assign("leads", "owner_id", LEAD, null);
  assert.equal(calls[0].body.p_user_id, null);
});

test("assign refuses a table and column pair outside the allowlist before any request", async () => {
  const { actions, calls } = harness();
  await assert.rejects(
    () => actions.assign("operator_controls", "enabled", DEAL, USER),
    (thrown) => thrown instanceof Response && thrown.status === 400,
  );
  assert.deepEqual(calls, []);
});

test("createClient goes through the client_create RPC and returns the new id", async () => {
  const { actions, calls } = harness(() => json(CLIENT));
  const id = await actions.createClient({
    name: "Sample Electric",
    leadId: LEAD,
    dealId: DEAL,
    aiProcessingAllowed: true,
    ownerId: USER,
  });
  assert.equal(id, CLIENT);
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/client_create",
      method: "POST",
      body: {
        p_name: "Sample Electric",
        p_lead_id: LEAD,
        p_deal_id: DEAL,
        p_ai_processing_allowed: true,
        p_owner_id: USER,
      },
    },
  ]);
});

test("createProject goes through the project_create RPC", async () => {
  const { actions, calls } = harness(() => json(PROJECT));
  await actions.createProject(CLIENT, "Intake automation");
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/project_create",
      method: "POST",
      body: { p_client_id: CLIENT, p_name: "Intake automation" },
    },
  ]);
});

test("createInvoice goes through the invoice_create RPC with the amount in cents", async () => {
  const { actions, calls } = harness(() => json(PROJECT));
  await actions.createInvoice({
    projectId: PROJECT,
    amountCents: 150000,
    currency: "USD",
    status: "draft",
    dueAt: null,
  });
  assert.deepEqual(calls, [
    {
      path: "/rest/v1/rpc/invoice_create",
      method: "POST",
      body: {
        p_project_id: PROJECT,
        p_amount_cents: 150000,
        p_currency: "USD",
        p_status: "draft",
        p_due_at: null,
      },
    },
  ]);
});

test("a refusal from the database reaches the caller in the database's words", async () => {
  const { actions } = harness(() => json({ message: "lead not found" }, 400));
  await assert.rejects(() => actions.setLeadStatus(LEAD, "converted"), /lead not found/);
});

test("no write this class makes addresses a table", async () => {
  const { actions, calls } = harness((call) =>
    json(call.path.endsWith("client_create") ? CLIENT : null),
  );
  await actions.assign("companies", "owner_id", DEAL, USER);
  await actions.linkDealToLead(DEAL, LEAD);
  await actions.setLeadStatus(LEAD, "converted");
  await actions.createClient({
    name: "Sample Electric",
    leadId: null,
    dealId: DEAL,
    aiProcessingAllowed: false,
    ownerId: null,
  });
  await actions.createProject(CLIENT, "Intake automation");
  await actions.createInvoice({
    projectId: PROJECT,
    amountCents: 1,
    currency: "USD",
    status: "draft",
    dueAt: null,
  });
  assert.equal(calls.length, 6);
  for (const call of calls) {
    assert.match(call.path, /^\/rest\/v1\/rpc\/[a-z_]+$/, `${call.method} ${call.path}`);
  }
});
