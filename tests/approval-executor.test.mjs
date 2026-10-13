// The dispatcher. Its whole job is to run an approved proposal WITHOUT letting
// the approval bypass anything the action's own subsystem would have refused.
//
// Tested against a fake that records what it was given, following
// tests/documents-issue.test.mjs, so the gate posture can be asserted without a
// database.
import test from "node:test";
import assert from "node:assert/strict";
import { executeApproval, attributedNote } from "../src/server/approvals/execute.ts";

const DEAL = "11111111-2222-3333-4444-555555555555";

/** Records calls rather than persisting. `advanceThrows` is how a real gate
 *  refusal is simulated: CrmActions.advanceDealStage throws on a Close with no
 *  signed SOW. */
function fakeDeps({
  approval,
  advanceThrows = null,
  recipient = { email: "Ana@Example.com" },
  suppressed = false,
  outbound = { outboundEnabled: true },
  sendStatus = "sent",
  demoFacts = { exists: true, existingStatuses: [] },
  writeThrows = null,
  document = { status: "final", bodyHash: "h1", title: "SOW" },
  signatureRequest = { id: "sig-1", signingToken: "tok" },
  signatureSent = true,
} = {}) {
  const marked = [];
  const advanced = [];
  const sent = [];
  const demos = [];
  const writes = [];
  const write =
    (name) =>
    async (...args) => {
      writes.push({ name, args });
      if (writeThrows) throw new Error(writeThrows);
      if (name === "createClient") return "client-1";
      if (name === "requestSignature") return signatureRequest;
      if (name === "sendSignatureEmail") return { sent: signatureSent };
      return undefined;
    };
  return {
    marked,
    advanced,
    sent,
    demos,
    writes,
    setLeadStatus: write("setLeadStatus"),
    assignRecord: write("assignRecord"),
    linkDealToLead: write("linkDealToLead"),
    createClient: write("createClient"),
    createProject: write("createProject"),
    createInvoice: write("createInvoice"),
    async documentForSignature() {
      return document;
    },
    requestSignature: write("requestSignature"),
    sendSignatureEmail: write("sendSignatureEmail"),
    async getApproval() {
      return approval ?? null;
    },
    async advanceDealStage(input) {
      advanced.push(input);
      if (advanceThrows) throw new Error(advanceThrows);
      return { ok: true };
    },
    async markExecuted(id, result) {
      marked.push({ id, result });
    },
    async recipientFor() {
      return recipient;
    },
    async isSuppressed() {
      return suppressed;
    },
    async outboundControl() {
      return outbound;
    },
    async sendEmail(input) {
      sent.push(input);
      return { status: sendStatus };
    },
    async demoSiteFacts() {
      return demoFacts;
    },
    async requestDemoSite(input) {
      demos.push(input);
      return "demo-1";
    },
  };
}

const LEAD = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const emailApproval = (over = {}) => ({
  id: "a2",
  actionType: "send_email",
  agentName: "sami",
  targetType: "lead",
  targetId: LEAD,
  status: "approved",
  payload: { subject: "Your patio quote", body: "Hi Ana,\n\nHere is the quote." },
  ...over,
});

const demoApproval = (over = {}) => ({
  id: "a3",
  actionType: "demo_site",
  agentName: "sami",
  targetType: "deal",
  targetId: DEAL,
  status: "approved",
  payload: { businessName: "Ana's Patios", address: "1 Main St", vertical: "landscaping" },
  ...over,
});

const approved = (over = {}) => ({
  id: "a1",
  actionType: "deal_close",
  agentName: "sami",
  targetType: "deal",
  targetId: DEAL,
  status: "approved",
  payload: { note: "Signed SOW countersigned." },
  ...over,
});

/** Fixed so the recorded date is assertable. */
const AT = new Date("2026-09-13T10:30:00Z");

test("an approved deal_close advances the deal and is marked executed", () => {
  const deps = fakeDeps({ approval: approved() });
  return executeApproval(deps, "a1", "crm:salem@example.com").then((outcome) => {
    assert.equal(outcome.ok, true);
    assert.equal(deps.advanced.length, 1);
    assert.equal(deps.advanced[0].dealId, DEAL);
    assert.equal(deps.advanced[0].toStage, "Close");
    assert.equal(deps.advanced[0].actor, "crm:salem@example.com");
    assert.equal(deps.marked.length, 1);
    assert.equal(deps.marked[0].result.ok, true);
  });
});

test("a gate refusal does NOT advance, and is recorded rather than swallowed", async () => {
  // The single most important test here. An operator who clicked Approve and
  // saw nothing would reasonably assume it worked.
  const deps = fakeDeps({
    approval: approved(),
    advanceThrows: "Stage 4 (Close) requires a signed SOW.",
  });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.marked.length, 1);
  assert.equal(deps.marked[0].result.ok, false);
  assert.equal(deps.marked[0].result.refused, "deal_close");
});

test("an unexecutable action_type never reaches a handler", async () => {
  const deps = fakeDeps({ approval: approved({ actionType: "set_price" }) });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "not-executable");
  assert.equal(deps.advanced.length, 0);
  assert.equal(deps.marked.length, 1);
  assert.equal(deps.marked[0].result.ok, false);
});

test("an approved send_email sends the approved text verbatim to the record's address", async () => {
  const deps = fakeDeps({ approval: emailApproval() });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(deps.sent.length, 1);
  // Lower-cased from the record, never taken from the payload.
  assert.equal(deps.sent[0].to, "ana@example.com");
  assert.equal(deps.sent[0].subject, "Your patio quote");
  assert.equal(deps.sent[0].text, "Hi Ana,\n\nHere is the quote.");
  assert.equal(deps.marked[0].result.ok, true);
  assert.equal(deps.marked[0].result.action, "send_email");
  // The recipient's address is personal data and never lands in the result.
  assert.doesNotMatch(JSON.stringify(deps.marked[0].result), /example\.com/);
});

test("send_email re-checks do_not_contact against the record and refuses a hit", async () => {
  const deps = fakeDeps({ approval: emailApproval(), suppressed: true });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.match(outcome.detail, /do_not_contact/);
  assert.equal(deps.sent.length, 0);
  assert.equal(deps.marked.length, 1);
});

test("send_email refuses when outbound is switched off", async () => {
  const deps = fakeDeps({ approval: emailApproval(), outbound: { outboundEnabled: false } });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(deps.sent.length, 0);
});

test("send_email refuses when the payload names a different address than the record", async () => {
  const deps = fakeDeps({
    approval: emailApproval({
      payload: { subject: "s", body: "b", to: "attacker@example.net" },
    }),
  });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.match(outcome.detail, /disagree/);
  assert.equal(deps.sent.length, 0);
});

test("send_email refuses a missing record or one with no address, without sending", async () => {
  for (const recipient of [null, { email: null }]) {
    const deps = fakeDeps({ approval: emailApproval(), recipient });
    const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
    assert.equal(outcome.ok, false);
    assert.equal(deps.sent.length, 0);
    assert.equal(deps.marked.length, 1);
  }
});

test("send_email records a provider failure as a refusal, naming no address", async () => {
  const deps = fakeDeps({ approval: emailApproval(), sendStatus: "error" });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.doesNotMatch(JSON.stringify(deps.marked[0].result), /example\.com/);
});

test("send_email refuses a header injection in the subject", async () => {
  const deps = fakeDeps({
    approval: emailApproval({ payload: { subject: "Hi\r\nBcc: x@y.z", body: "b" } }),
  });
  const outcome = await executeApproval(deps, "a2", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(deps.sent.length, 0);
});

test("an approved demo_site queues a demo against the targeted deal", async () => {
  const deps = fakeDeps({ approval: demoApproval() });
  const outcome = await executeApproval(deps, "a3", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(deps.demos.length, 1);
  assert.equal(deps.demos[0].dealId, DEAL);
  assert.equal(deps.demos[0].companyId, null);
  assert.equal(deps.demos[0].businessName, "Ana's Patios");
  assert.equal(deps.marked[0].result.demoSiteId, "demo-1");
});

test("demo_site runs the CRM's own gates: a build already in flight refuses", async () => {
  const deps = fakeDeps({
    approval: demoApproval(),
    demoFacts: { exists: true, existingStatuses: ["building"] },
  });
  const outcome = await executeApproval(deps, "a3", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.match(outcome.detail, /already queued or building/);
  assert.equal(deps.demos.length, 0);
});

test("demo_site refuses when outbound is off or the record is gone", async () => {
  for (const over of [
    { outbound: { outboundEnabled: false, reason: "maintenance" } },
    { demoFacts: { exists: false, existingStatuses: [] } },
  ]) {
    const deps = fakeDeps({ approval: demoApproval(), ...over });
    const outcome = await executeApproval(deps, "a3", "crm:salem@example.com");
    assert.equal(outcome.ok, false);
    assert.equal(deps.demos.length, 0);
    assert.equal(deps.marked.length, 1);
  }
});

test("a proposal that is not approved is not executed", async () => {
  // approval_mark_executed raises unless the status is exactly 'approved', so
  // the dispatcher must not even try.
  for (const status of ["pending", "rejected", "expired", "executed"]) {
    const deps = fakeDeps({ approval: approved({ status }) });
    const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
    assert.equal(outcome.ok, false, `${status} must not execute`);
    assert.equal(outcome.reason, "not-approved");
    assert.equal(deps.advanced.length, 0);
    assert.equal(deps.marked.length, 0);
  }
});

test("a missing proposal is not found, and nothing is marked", async () => {
  const deps = fakeDeps({ approval: null });
  const outcome = await executeApproval(deps, "nope", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "not-found");
  assert.equal(deps.marked.length, 0);
});

test("a payload naming a different deal is refused before anything runs", async () => {
  // The injection test. An agent steered into proposing a redirected action
  // cannot execute one.
  const deps = fakeDeps({
    approval: approved({ payload: { dealId: "99999999-9999-9999-9999-999999999999", note: "go" } }),
  });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.advanced.length, 0);
});

test("an invalid payload is refused and recorded", async () => {
  const deps = fakeDeps({ approval: approved({ payload: { note: "" } }) });
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "refused");
  assert.equal(deps.advanced.length, 0);
  assert.equal(deps.marked.length, 1);
});

test("the recorded refusal carries no client data", async () => {
  // Following campaigns/mailer.ts: errors never echo personal data.
  const deps = fakeDeps({
    approval: approved(),
    advanceThrows: "Stage 4 (Close) requires a signed SOW for Ana at Trattoria Nino",
  });
  await executeApproval(deps, "a1", "crm:salem@example.com");
  const serialised = JSON.stringify(deps.marked[0].result);
  assert.doesNotMatch(serialised, /Ana|Trattoria/);
});

test("a bookkeeping failure after a real advance still reports the advance", async () => {
  // The deal IS closed. Telling the operator it failed would be a lie they
  // cannot correct: approval_decide now raises on a retry.
  const deps = fakeDeps({ approval: approved() });
  deps.markExecuted = async () => {
    throw new Error("rpc failed");
  };
  const outcome = await executeApproval(deps, "a1", "crm:salem@example.com");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.recorded, false);
  assert.equal(deps.advanced.length, 1);
});

/* Charter section 13: never store an assumption as a fact, and every meaningful
 * fact carries source and date. The note is stored by deal_advance_stage as the
 * evidence the stage gate was met, and an agent wrote it. */

test("the stored note names who proposed it and who approved it", async () => {
  const deps = fakeDeps({ approval: approved() });
  await executeApproval(deps, "a1", "crm:salem@example.com", AT);
  const stored = deps.advanced[0].note;
  assert.match(stored, /^Signed SOW countersigned\./);
  assert.match(stored, /Proposed by sami/);
  assert.match(stored, /approved by crm:salem@example\.com/);
  assert.match(stored, /on 2026-09-13\./);
});

test("an unnamed proposer is said to be unnamed, not silently dropped", () => {
  // A missing agent_name must not produce a note that reads as the approver's
  // own first-hand observation.
  for (const name of [null, undefined, "", "   "]) {
    const out = attributedNote("Ready.", name, "crm:salem@example.com", AT);
    assert.match(
      out,
      /Proposed by an unnamed operator/,
      `${String(name)} must be named as unnamed`,
    );
  }
});

test("attribution never invents a confidence value", () => {
  // Section 13 asks for source, date AND confidence. The proposal carries no
  // confidence, and manufacturing one would be the assumption-stored-as-fact
  // the rule forbids. Its absence is deliberate and asserted so nobody adds a
  // fabricated one later.
  const out = attributedNote("Ready.", "sami", "crm:salem@example.com", AT);
  assert.doesNotMatch(out, /confidence/i);
});

test("the operator's own text is preserved verbatim ahead of the attribution", () => {
  const out = attributedNote("Ready to close.", "sami", "crm:x@example.com", AT);
  assert.ok(out.startsWith("Ready to close.\n\nProposed by"));
});

/* ── Phase 4: record writes ─────────────────────────────────────────────── */

const CLIENT = "cccccccc-1111-2222-3333-444444444444";
const PROJECT = "dddddddd-1111-2222-3333-444444444444";
const DOC = "eeeeeeee-1111-2222-3333-444444444444";

const writeApproval = (actionType, targetType, targetId, payload) => ({
  id: "w1",
  actionType,
  agentName: "agent_perplexity",
  targetType,
  targetId,
  status: "approved",
  payload,
});

test("lead_set_status sets the status named in the payload on the target lead", async () => {
  const deps = fakeDeps({
    approval: writeApproval("lead_set_status", "lead", LEAD, { status: "qualified" }),
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.deepEqual(out, { ok: true, action: "lead_set_status" });
  assert.deepEqual(deps.writes, [{ name: "setLeadStatus", args: [LEAD, "qualified"] }]);
  assert.equal(deps.marked[0].result.status, "qualified");
});

test("lead_set_status refuses a status that is not one lowercase word, before any write", async () => {
  const deps = fakeDeps({
    approval: writeApproval("lead_set_status", "lead", LEAD, { status: "Won!; drop table" }),
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, false);
  assert.equal(out.reason, "refused");
  assert.equal(deps.writes.length, 0);
  assert.equal(deps.marked[0].result.refused, "lead_set_status");
});

test("crm_assign refuses a table/column pair outside ASSIGNABLE", async () => {
  const deps = fakeDeps({
    approval: writeApproval("crm_assign", "approval_queue", DEAL, { column: "decided_by" }),
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, false);
  assert.equal(deps.writes.length, 0);
});

test("crm_assign with an empty userId unassigns the record", async () => {
  const deps = fakeDeps({
    approval: writeApproval("crm_assign", "deals", DEAL, { column: "owner_id", userId: "" }),
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, true);
  assert.deepEqual(deps.writes[0], {
    name: "assignRecord",
    args: [{ table: "deals", column: "owner_id", id: DEAL, userId: null }],
  });
});

test("deal_link_lead links the target deal to the lead in the payload", async () => {
  const deps = fakeDeps({
    approval: writeApproval("deal_link_lead", "deal", DEAL, { leadId: LEAD }),
  });
  assert.equal((await executeApproval(deps, "w1", "salem")).ok, true);
  assert.deepEqual(deps.writes[0].args, [DEAL, LEAD]);
});

test("client_create never assumes AI-processing consent and records the new id", async () => {
  const deps = fakeDeps({
    approval: writeApproval("client_create", "deal", DEAL, { name: "Acme Patios" }),
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, true);
  assert.deepEqual(deps.writes[0].args[0], {
    dealId: DEAL,
    name: "Acme Patios",
    leadId: null,
    aiProcessingAllowed: false,
    ownerId: null,
  });
  assert.equal(deps.marked[0].result.clientId, "client-1");
});

test("project_create targets a client and needs a name", async () => {
  const deps = fakeDeps({ approval: writeApproval("project_create", "client", CLIENT, {}) });
  assert.equal((await executeApproval(deps, "w1", "salem")).ok, false);
  assert.equal(deps.writes.length, 0);
});

test("invoice_create defaults currency and status and refuses a fractional amount", async () => {
  const ok = fakeDeps({
    approval: writeApproval("invoice_create", "project", PROJECT, { amountCents: 49900 }),
  });
  assert.equal((await executeApproval(ok, "w1", "salem")).ok, true);
  assert.deepEqual(ok.writes[0].args[0], {
    projectId: PROJECT,
    amountCents: 49900,
    currency: "usd",
    status: "draft",
    dueAt: null,
  });

  const bad = fakeDeps({
    approval: writeApproval("invoice_create", "project", PROJECT, { amountCents: 499.5 }),
  });
  assert.equal((await executeApproval(bad, "w1", "salem")).ok, false);
  assert.equal(bad.writes.length, 0);
});

test("a record write the database refuses is recorded as not carried out, without its text", async () => {
  const deps = fakeDeps({
    approval: writeApproval("lead_set_status", "lead", LEAD, { status: "qualified" }),
    writeThrows: "lead not found: ana@example.com",
  });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, false);
  assert.doesNotMatch(out.detail, /example\.com/);
  assert.doesNotMatch(JSON.stringify(deps.marked), /example\.com/);
});

const signatureApproval = (over = {}) =>
  writeApproval("document_request_signature", "document", DOC, {
    dealId: DEAL,
    recipientName: "Ana",
    recipientEmail: "Ana@Example.com",
    ...over,
  });

test("document_request_signature creates the request and sends the link", async () => {
  const deps = fakeDeps({ approval: signatureApproval() });
  const out = await executeApproval(deps, "w1", "salem");
  assert.deepEqual(out, { ok: true, action: "document_request_signature" });
  assert.deepEqual(
    deps.writes.map((w) => w.name),
    ["requestSignature", "sendSignatureEmail"],
  );
  assert.equal(deps.writes[0].args[0].bodyHash, "h1");
  assert.equal(deps.writes[0].args[0].recipientEmail, "ana@example.com");
  assert.equal(deps.writes[1].args[0].signingToken, "tok");
  assert.deepEqual(deps.marked[0].result, {
    ok: true,
    action: "document_request_signature",
    signatureRequestId: "sig-1",
    sent: true,
  });
});

test("document_request_signature refuses a draft, a suppressed address, and outbound off", async () => {
  for (const over of [
    { document: { status: "draft", bodyHash: "h1", title: "SOW" } },
    { suppressed: true },
    { outbound: { outboundEnabled: false } },
  ]) {
    const deps = fakeDeps({ approval: signatureApproval(), ...over });
    const out = await executeApproval(deps, "w1", "salem");
    assert.equal(out.ok, false, JSON.stringify(over));
    assert.equal(deps.writes.length, 0, JSON.stringify(over));
  }
});

test("a stale document hash refuses without sending", async () => {
  const deps = fakeDeps({ approval: signatureApproval(), signatureRequest: null });
  const out = await executeApproval(deps, "w1", "salem");
  assert.equal(out.ok, false);
  assert.deepEqual(
    deps.writes.map((w) => w.name),
    ["requestSignature"],
  );
});
