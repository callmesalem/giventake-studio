// tests/mcp-tools-write.test.mjs
// The "do directly" tier against a fake write port. Pinned: every write is
// sourced as the agent, a stage advance to Close is refused here (Close is a
// proposal), a guard refusal is explained by name, and record keys let the
// model update the same row later.
import test from "node:test";
import assert from "node:assert/strict";
import { writeTools } from "../src/server/mcp/tools-write.ts";

const DEAL = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const parse = (result) => JSON.parse(result.content[0].text);

function fakeDeps({ throws = null } = {}) {
  const calls = [];
  const record =
    (name) =>
    async (...args) => {
      calls.push([name, ...args]);
      if (throws) throw new Error(throws);
      return { ok: true };
    };
  const deps = {
    read: {},
    executor: {},
    mail: null,
    actions: {
      upsertNote: record("upsertNote"),
      upsertTask: record("upsertTask"),
      upsertCompany: record("upsertCompany"),
      upsertContact: record("upsertContact"),
      upsertDeal: record("upsertDeal"),
      advanceDealStage: record("advanceDealStage"),
      upsertReferralPartner: record("upsertReferralPartner"),
      recordReferral: record("recordReferral"),
      setReferralStatus: record("setReferralStatus"),
      decideApproval: record("decideApproval"),
      requestApproval: record("requestApproval"),
    },
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
  const spec = writeTools(() => deps).find((t) => t.name === name);
  assert.ok(spec, `${name} registered`);
  return spec;
};

test("the write tools are exactly the ten guarded functions minus approval_request, and none is read-only", () => {
  const specs = writeTools(() => ({}));
  assert.deepEqual(specs.map((s) => s.name).sort(), [
    "company_upsert",
    "contact_upsert",
    "deal_advance_stage",
    "deal_upsert",
    "note_add",
    "referral_partner_upsert",
    "referral_record",
    "referral_set_status",
    "task_upsert",
  ]);
  for (const s of specs) assert.equal(s.readOnly, false, s.name);
});

test("note_add writes a note sourced as the agent with a fresh record key", async () => {
  const { deps, calls } = fakeDeps();
  const data = parse(
    await tool(deps, "note_add").handler({
      content: "Called Ana",
      lead_id: "11111111-1111-4111-8111-111111111111",
    }),
  ).data;
  assert.equal(calls[0][0], "upsertNote");
  assert.equal(calls[0][1].source, "agent_perplexity");
  assert.match(calls[0][1].sourceRecordId, /^[0-9a-f-]{36}$/);
  assert.equal(calls[0][1].leadId, "11111111-1111-4111-8111-111111111111");
  assert.equal(data.record_key, calls[0][1].sourceRecordId);
});

test("task_upsert reuses a given record_key so the same task can be updated", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "task_upsert").handler({
    content: "Send SOW",
    record_key: "sow-ana",
    deadline_at: "2026-10-01T00:00:00Z",
  });
  assert.equal(calls[0][1].sourceRecordId, "sow-ana");
  assert.equal(calls[0][1].deadlineAt, "2026-10-01T00:00:00Z");
  assert.equal(calls[0][1].isCompleted, false);
});

test("deal_advance_stage refuses Close without calling the action", async () => {
  const { deps, calls } = fakeDeps();
  const result = await tool(deps, "deal_advance_stage").handler({
    deal_id: DEAL,
    to_stage: "Close",
    note: "done",
  });
  assert.equal(result.isError, true);
  assert.match(parse(result).error, /propose.*deal_close/i);
  assert.equal(calls.length, 0);
});

test("deal_advance_stage passes the agent as actor for any other stage", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "deal_advance_stage").handler({
    deal_id: DEAL,
    to_stage: "Proposal",
    note: "Sent the proposal.",
  });
  assert.deepEqual(calls[0], [
    "advanceDealStage",
    { dealId: DEAL, toStage: "Proposal", note: "Sent the proposal.", actor: "agent_perplexity" },
  ]);
});

test("a guard refusal is explained by capability name and changes nothing", async () => {
  const { deps } = fakeDeps({
    throws: "agent_capability_denied: capability_disabled (agent_perplexity, note_upsert)",
  });
  const result = await tool(deps, "note_add").handler({ content: "x" });
  assert.equal(result.isError, true);
  assert.match(parse(result).error, /"note_upsert" is off for agent_perplexity/);
});

test("company_upsert, contact_upsert and deal_upsert are sourced as the agent", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "company_upsert").handler({ name: "Sample Electric", domain: "sample.example" });
  await tool(deps, "contact_upsert").handler({
    name: "Ana",
    email: "ana@sample.example",
    company_id: COMPANY,
  });
  await tool(deps, "deal_upsert").handler({
    name: "Website",
    company_id: COMPANY,
    value_usd: 4500,
  });
  for (const call of calls) assert.equal(call[1].source, "agent_perplexity", call[0]);
  assert.equal(calls[2][1].valueUsd, 4500);
});

test("referral tools map straight onto the actions", async () => {
  const { deps, calls } = fakeDeps();
  await tool(deps, "referral_partner_upsert").handler({ name: "Bob's Agency" });
  await tool(deps, "referral_record").handler({
    partner_id: COMPANY,
    company_name: "Sample Electric",
  });
  await tool(deps, "referral_set_status").handler({ referral_id: COMPANY, status: "won" });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["upsertReferralPartner", "recordReferral", "setReferralStatus"],
  );
  assert.deepEqual(calls[2].slice(1), [COMPANY, "won"]);
});

test("arguments are validated: an empty note and a bad uuid are refused before any call", async () => {
  const { deps, calls } = fakeDeps();
  assert.equal((await tool(deps, "note_add").handler({ content: "" })).isError, true);
  assert.equal(
    (
      await tool(deps, "deal_advance_stage").handler({
        deal_id: "nope",
        to_stage: "Proposal",
        note: "n",
      })
    ).isError,
    true,
  );
  assert.equal(calls.length, 0);
});
