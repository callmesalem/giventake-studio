import { PolicyDenied } from "./policy.ts";
import { SupabaseOperatorStore } from "./supabase-store.ts";
import { runCfoComplianceGate } from "../operators/cfo.ts";
import { buildCroSyntheticDraft } from "../operators/cro.ts";
import type { SyntheticLead } from "../operators/types.ts";

export interface SyntheticLeadFixture extends SyntheticLead {
  fixtureKind: "local-synthetic";
}
export interface SyntheticWorkflowInput {
  idempotencyKey: string;
  lead: SyntheticLeadFixture;
}

const INPUT_KEYS = new Set(["idempotencyKey", "lead"]);
const LEAD_KEYS = new Set([
  "synthetic",
  "fixtureKind",
  "id",
  "email",
  "contactName",
  "businessName",
  "category",
  "offerSlug",
  "observedNeed",
]);
const CATEGORIES = new Set([
  "electrical-contractor",
  "plumbing-contractor",
  "hvac-contractor",
  "landscaping-contractor",
  "public-adjuster",
]);
const OFFERS = new Set(["business-automation", "marketing-site"]);
const SENSITIVE =
  /(?:social security|ssn|credit card|bank account|routing number|medical|patient|health record|passport|driver.?s license|@[\w.-]+\.(?:com|net|org|gov|edu)\b|\+?1?[ .-]?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})/i;
const exactKeys = (value: object, allowed: Set<string>) =>
  Object.keys(value).length === allowed.size && Object.keys(value).every((key) => allowed.has(key));

export function assertSyntheticLeadFixture(input: SyntheticWorkflowInput) {
  if (
    !input ||
    typeof input !== "object" ||
    !exactKeys(input, INPUT_KEYS) ||
    !input.lead ||
    typeof input.lead !== "object" ||
    !exactKeys(input.lead, LEAD_KEYS)
  )
    throw new PolicyDenied("strict_fixture_schema_required");
  if (input?.lead?.synthetic !== true || input.lead.fixtureKind !== "local-synthetic")
    throw new PolicyDenied("synthetic_fixture_required");
  if (!/^[^@\s]+@[^@\s]+\.invalid$/i.test(input.lead.email.trim()))
    throw new PolicyDenied("synthetic_invalid_email_required");
  const fixtureMarker = /(?:fixture|sample|synthetic|test)/i;
  if (
    !fixtureMarker.test(input.lead.contactName) ||
    !fixtureMarker.test(input.lead.businessName) ||
    !fixtureMarker.test(input.lead.observedNeed)
  )
    throw new PolicyDenied("synthetic_markers_required");
  if (
    !/^fixture-[a-z0-9-]{3,80}$/.test(input.lead.id) ||
    !CATEGORIES.has(input.lead.category) ||
    !OFFERS.has(input.lead.offerSlug)
  )
    throw new PolicyDenied("controlled_fixture_values_required");
  for (const value of [input.lead.contactName, input.lead.businessName, input.lead.observedNeed])
    if (SENSITIVE.test(value)) throw new PolicyDenied("sensitive_or_real_data_prohibited");
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(input.idempotencyKey))
    throw new PolicyDenied("invalid_idempotency_key");
}

/** Complete local-only path. It has no transport dependency and cannot send or approve. */
export async function runPersistedSyntheticLeadWorkflow(
  store: SupabaseOperatorStore,
  input: SyntheticWorkflowInput,
) {
  assertSyntheticLeadFixture(input);
  const created = await store.createSyntheticLeadRun(
    input.idempotencyKey,
    input.lead as unknown as Record<string, unknown>,
  );
  if (created.duplicate && created.status !== "running")
    return { ...created, duplicate: true, sideEffects: 0 as const, sendAuthorized: false as const };

  // Pure operators write their audit attempts to this sink. Database stage RPCs are
  // the authoritative, atomic audit+persistence boundary.
  const pureStore = {
    getControls: store.getControls.bind(store),
    isSuppressed: store.isSuppressed.bind(store),
    appendAudit: async () => undefined,
  };
  const lead = { ...input.lead, id: created.runId };
  const compliance = await runCfoComplianceGate(pureStore as never, lead);
  await store.recordSyntheticCfo(created.runId, compliance as unknown as Record<string, unknown>);
  if (compliance.decision !== "pass")
    return {
      ...created,
      status: "blocked" as const,
      compliance,
      sideEffects: 0 as const,
      sendAuthorized: false as const,
    };

  const draft = buildCroSyntheticDraft(lead, compliance);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const approval = await store.recordSyntheticDraftApproval(
    created.runId,
    draft as unknown as Record<string, unknown>,
    expiresAt,
  );
  return {
    ...created,
    status: "awaiting_approval" as const,
    compliance,
    draft,
    approval,
    sideEffects: 0 as const,
    sendAuthorized: false as const,
  };
}
