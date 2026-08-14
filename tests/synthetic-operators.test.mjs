import test from "node:test";
import assert from "node:assert/strict";
import {
  OPERATOR_NAMES,
  compileSyntheticOperatorReport,
  runCfoComplianceGate,
  runCroSyntheticPipeline,
  runCtoSyntheticSiteAudit,
} from "../src/server/operators/index.ts";

const store = () => ({
  controls: { globalEnabled: true, enabled: true, allowedModes: ["synthetic"] },
  events: [],
  suppressed: new Set(),
  async getControls() {
    return this.controls;
  },
  async isSuppressed(email) {
    return this.suppressed.has(email);
  },
  async appendAudit(event) {
    this.events.push(event);
  },
});
const lead = (patch = {}) => ({
  synthetic: true,
  id: "synthetic-1",
  email: "alex@example.invalid",
  contactName: "Alex",
  businessName: "Sample Electric",
  category: "electrical contractor",
  offerSlug: "business-automation",
  observedNeed: "manual job intake",
  ...patch,
});
const rejects = (promise, code) =>
  assert.rejects(promise, (error) => error.code === code || error.message === code);

test("green trades and general small businesses pass without ATC flags", async () => {
  for (const category of ["electrical contractor", "plumber", "general small business"]) {
    const result = await runCfoComplianceGate(store(), lead({ category }));
    assert.equal(result.decision, "pass");
    assert.deepEqual(result.flags, []);
    assert.equal(result.sendAuthorized, false);
  }
});
test("restoration, PA, and adjuster categories flag and escalate rather than blanket drop", async () => {
  for (const category of ["water restoration", "public adjuster", "insurance claims adjuster"]) {
    const result = await runCfoComplianceGate(store(), lead({ category }));
    assert.equal(result.decision, "escalate");
    assert.deepEqual(result.blocks, []);
    assert.ok(result.flags.includes("atc_conflict_review"));
    assert.ok(result.escalations.includes("salem_human_review"));
  }
});
test("regulated and missing or ambiguous data escalate", async () => {
  let result = await runCfoComplianceGate(store(), lead({ containsRegulatedData: true }));
  assert.ok(result.escalations.includes("regulated_data"));
  result = await runCfoComplianceGate(
    store(),
    lead({ contactName: "", classificationAmbiguous: true }),
  );
  assert.equal(result.decision, "escalate");
  assert.match(result.escalations.join(" "), /missing_required:contactName/);
  assert.ok(result.escalations.includes("ambiguous_classification"));
});
test("suppression and banned phrases block", async () => {
  const s = store();
  s.suppressed.add("alex@example.invalid");
  assert.ok((await runCfoComplianceGate(s, lead())).blocks.includes("suppressed"));
  assert.ok(
    (
      await runCfoComplianceGate(store(), lead({ sourceText: "Act now for guaranteed results" }))
    ).blocks.includes("banned_phrase"),
  );
  for (const phrase of ["free website", "risk-free", "click here"]) {
    assert.ok(
      (await runCfoComplianceGate(store(), lead({ sourceText: phrase }))).blocks.includes(
        "banned_phrase",
      ),
    );
  }
});
test("CRO maps an offer, stays under cap, invents no forbidden commitments, and never sends", async () => {
  const s = store();
  const result = await runCroSyntheticPipeline(s, lead());
  assert.equal(result.status, "awaiting_human_review");
  assert.ok(result.wordCount <= 85);
  assert.equal(result.sendAuthorized, false);
  assert.equal(result.sideEffects, 0);
  assert.doesNotMatch(
    result.draft,
    /\$|guaranteed|limited.time|by (?:monday|friday)|\b\d+ weeks?\b/i,
  );
  assert.doesNotMatch(s.events.map((e) => e.type).join(" "), /sent|send_authorized/);
  assert.match(
    result.draft,
    /This message was sent automatically by GivenTake Devs\.\nReply and a person will read it\./,
  );
});
test("CRO stops on CFO escalation or block", async () => {
  await rejects(
    runCroSyntheticPipeline(store(), lead({ category: "public adjuster" })),
    "cfo_escalate",
  );
  const s = store();
  s.suppressed.add("alex@example.invalid");
  await rejects(runCroSyntheticPipeline(s, lead()), "cfo_block");
});
test("CTO uses at most two verified supplied gaps and has no actions", async () => {
  const result = await runCtoSyntheticSiteAudit(store(), {
    synthetic: true,
    auditId: "a1",
    offerSlug: "marketing-site",
    suppliedFacts: [
      { label: "Missing form label", evidence: "Synthetic fixture line 4", verified: true },
      { label: "Broken heading order", evidence: "Synthetic fixture line 8", verified: true },
      { label: "Invented", evidence: "none", verified: false },
    ],
  });
  assert.equal(result.status, "gaps_found");
  assert.equal(result.gaps.length, 2);
  assert.equal(result.fetchedUrls, 0);
  assert.equal(result.actionAuthority, false);
  assert.equal(result.sideEffects, 0);
});
test("CTO no-gap behavior does not invent findings", async () => {
  const result = await runCtoSyntheticSiteAudit(store(), {
    synthetic: true,
    auditId: "a2",
    offerSlug: "marketing-site",
    suppliedFacts: [],
  });
  assert.equal(result.status, "no_verified_gaps");
  assert.deepEqual(result.gaps, []);
});
test("orchestrator aggregates a plain zero-authority report", async () => {
  const s = store(),
    compliance = await runCfoComplianceGate(s, lead()),
    draft = await runCroSyntheticPipeline(s, lead());
  const auditResult = await runCtoSyntheticSiteAudit(s, {
    synthetic: true,
    auditId: "a",
    offerSlug: "marketing-site",
    suppliedFacts: [],
  });
  const result = await compileSyntheticOperatorReport(s, {
    synthetic: true,
    runId: "run",
    compliance: [compliance],
    drafts: [draft],
    audits: [auditResult],
  });
  assert.deepEqual(result.counts, { compliance: 1, drafts: 1, audits: 1 });
  assert.equal(result.draftsAwaitingHumanReview, 1);
  assert.equal(result.actionAuthority, 0);
  assert.match(result.report, /Action authority: zero/);
});
test("every operator enforces synthetic-only and controls", async () => {
  await rejects(runCfoComplianceGate(store(), { ...lead(), synthetic: false }), "synthetic_only");
  await rejects(
    runCroSyntheticPipeline(store(), { ...lead(), synthetic: false }),
    "synthetic_only",
  );
  await rejects(
    runCtoSyntheticSiteAudit(store(), {
      synthetic: false,
      auditId: "x",
      offerSlug: "marketing-site",
      suppliedFacts: [],
    }),
    "synthetic_only",
  );
  await rejects(
    compileSyntheticOperatorReport(store(), {
      synthetic: false,
      runId: "x",
      compliance: [],
      drafts: [],
      audits: [],
    }),
    "synthetic_only",
  );
  for (const operator of Object.values(OPERATOR_NAMES)) {
    const s = store();
    s.controls = { ...s.controls, enabled: false };
    await rejects(
      (async () => {
        if (operator === OPERATOR_NAMES.cfo) return runCfoComplianceGate(s, lead());
        if (operator === OPERATOR_NAMES.cro) return runCroSyntheticPipeline(s, lead());
        if (operator === OPERATOR_NAMES.cto)
          return runCtoSyntheticSiteAudit(s, {
            synthetic: true,
            auditId: "x",
            offerSlug: "marketing-site",
            suppliedFacts: [],
          });
        return compileSyntheticOperatorReport(s, {
          synthetic: true,
          runId: "x",
          compliance: [],
          drafts: [],
          audits: [],
        });
      })(),
      "control_disabled",
    );
  }
});
test("audit failure blocks operator completion", async () => {
  const s = store();
  s.appendAudit = async () => {
    throw Error("down");
  };
  await rejects(runCfoComplianceGate(s, lead()), "audit_failed");
});
