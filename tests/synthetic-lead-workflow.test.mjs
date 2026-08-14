import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSyntheticLeadFixture,
  runPersistedSyntheticLeadWorkflow,
} from "../src/server/operator-control/synthetic-workflow.ts";

const fixture = (patch = {}) => ({
  idempotencyKey: "fixture:happy-001",
  lead: {
    synthetic: true,
    fixtureKind: "local-synthetic",
    id: "fixture-lead",
    email: "alex@sample.invalid",
    contactName: "Alex Fixture",
    businessName: "Sample Electric",
    category: "electrical-contractor",
    offerSlug: "business-automation",
    observedNeed: "synthetic manual intake",
    ...patch,
  },
});
const store = () => ({
  controls: { globalEnabled: true, enabled: true, allowedModes: ["synthetic"] },
  suppressed: false,
  cfo: [],
  drafts: [],
  async createSyntheticLeadRun() {
    return {
      runId: "00000000-0000-0000-0000-000000000001",
      leadId: "lead",
      duplicate: false,
      status: "running",
    };
  },
  async getControls() {
    return this.controls;
  },
  async isSuppressed() {
    return this.suppressed;
  },
  async recordSyntheticCfo(runId, result) {
    this.cfo.push({ runId, result });
  },
  async recordSyntheticDraftApproval(runId, draft) {
    this.drafts.push({ runId, draft });
    return {
      runId,
      approvalId: "approval",
      payload: { draft },
      payloadHash: "a".repeat(64),
      status: "pending",
    };
  },
});

test("synthetic workflow persists compliance and queues pending exact draft without sends", async () => {
  const s = store();
  const result = await runPersistedSyntheticLeadWorkflow(s, fixture());
  assert.equal(result.status, "awaiting_approval");
  assert.equal(result.approval.status, "pending");
  assert.equal(result.sendAuthorized, false);
  assert.equal(result.sideEffects, 0);
  assert.equal(s.cfo.length, 1);
  assert.equal(s.drafts.length, 1);
  assert.deepEqual(s.drafts[0].draft, result.draft);
});
test("duplicate is idempotent and produces no new outcomes", async () => {
  const s = store();
  s.createSyntheticLeadRun = async () => ({
    runId: "run",
    leadId: "lead",
    duplicate: true,
    status: "awaiting_approval",
  });
  const result = await runPersistedSyntheticLeadWorkflow(s, fixture());
  assert.equal(result.duplicate, true);
  assert.equal(s.cfo.length, 0);
  assert.equal(s.drafts.length, 0);
});
test("duplicate running run resumes deterministic stages after a partial failure", async () => {
  const s = store();
  s.createSyntheticLeadRun = async () => ({
    runId: "run",
    leadId: "lead",
    duplicate: true,
    status: "running",
  });
  const result = await runPersistedSyntheticLeadWorkflow(s, fixture());
  assert.equal(result.status, "awaiting_approval");
  assert.equal(s.cfo.length, 1);
  assert.equal(s.drafts.length, 1);
});
test("non-.invalid and non-explicit fixtures are rejected before persistence", () => {
  assert.throws(
    () => assertSyntheticLeadFixture(fixture({ email: "person@example.com" })),
    /synthetic_invalid_email_required/,
  );
  const input = fixture();
  input.lead.fixtureKind = "real";
  assert.throws(() => assertSyntheticLeadFixture(input), /synthetic_fixture_required/);
  assert.throws(
    () =>
      assertSyntheticLeadFixture(
        fixture({
          contactName: "Alex Smith",
          businessName: "Acme Electric",
          observedNeed: "manual intake",
        }),
      ),
    /synthetic_markers_required/,
  );
  assert.throws(
    () => assertSyntheticLeadFixture({ ...fixture(), extra: "unknown" }),
    /strict_fixture_schema_required/,
  );
  assert.throws(
    () => assertSyntheticLeadFixture(fixture({ sourceText: "raw unrestricted" })),
    /strict_fixture_schema_required/,
  );
  assert.throws(
    () => assertSyntheticLeadFixture(fixture({ observedNeed: "synthetic patient medical record" })),
    /sensitive_or_real_data_prohibited/,
  );
});
test("CFO block and escalation persist stop outcomes and never draft", async () => {
  const blocked = store();
  blocked.suppressed = true;
  let result = await runPersistedSyntheticLeadWorkflow(blocked, fixture());
  assert.equal(result.compliance.decision, "block");
  assert.equal(blocked.drafts.length, 0);
  const escalated = store();
  result = await runPersistedSyntheticLeadWorkflow(
    escalated,
    fixture({ category: "public-adjuster" }),
  );
  assert.equal(result.compliance.decision, "escalate");
  assert.equal(escalated.drafts.length, 0);
});
test("missing controls and database failures fail closed", async () => {
  const disabled = store();
  disabled.controls = null;
  await assert.rejects(runPersistedSyntheticLeadWorkflow(disabled, fixture()), /control_missing/);
  const failed = store();
  failed.recordSyntheticCfo = async () => {
    throw Error("database unavailable");
  };
  await assert.rejects(
    runPersistedSyntheticLeadWorkflow(failed, fixture()),
    /database unavailable/,
  );
  assert.equal(failed.drafts.length, 0);
});
