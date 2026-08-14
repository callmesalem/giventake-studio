import { audit } from "../operator-control/audit.ts";
import { PolicyDenied, requireControls } from "../operator-control/policy.ts";
import type { OperatorStore } from "../operator-control/types.ts";
import { OPERATOR_NAMES, type CfoResult, type SyntheticLead } from "./types.ts";

const BANNED = [
  /free website/i,
  /risk[- ]free/i,
  /click here/i,
  /guarantee(?:d)?/i,
  /limited[- ]time/i,
  /act now/i,
  /only \d+ (?:spots?|slots?)/i,
  /our team of/i,
  /we (?:will|can) (?:double|triple)/i,
  /save(?:s|d)? \d+ (?:hours?|%)/i,
];
const CONFLICT =
  /(?:restoration|public[- ]adjuster|\bpa\b|claims?[- ]adjuster|insurance[- ]adjuster)/i;
const REGULATED =
  /(?:patient|medical|health record|bank account|social security|government id|credit card)/i;

export async function runCfoComplianceGate(
  store: OperatorStore,
  lead: SyntheticLead,
): Promise<CfoResult> {
  await requireControls(store, OPERATOR_NAMES.cfo, "synthetic");
  if (lead?.synthetic !== true) throw new PolicyDenied("synthetic_only");
  const missing = [
    "id",
    "email",
    "contactName",
    "businessName",
    "category",
    "offerSlug",
    "observedNeed",
  ].filter((key) => !String(lead[key as keyof SyntheticLead] ?? "").trim());
  const blocks: string[] = [];
  const escalations: string[] = [];
  const flags: string[] = [];
  if (missing.length) escalations.push(`missing_required:${missing.join(",")}`);
  if (lead.classificationAmbiguous) escalations.push("ambiguous_classification");
  if (lead.email && (await store.isSuppressed(lead.email))) blocks.push("suppressed");
  const scan = [lead.sourceText, lead.observedNeed].filter(Boolean).join(" ");
  if (BANNED.some((phrase) => phrase.test(scan))) blocks.push("banned_phrase");
  if (lead.containsRegulatedData || REGULATED.test(scan)) escalations.push("regulated_data");
  if (CONFLICT.test(lead.category || "")) {
    flags.push("atc_conflict_review");
    escalations.push("salem_human_review");
  }
  const decision = blocks.length ? "block" : escalations.length ? "escalate" : "pass";
  const result: CfoResult = {
    operator: OPERATOR_NAMES.cfo,
    decision,
    blocks,
    escalations,
    flags,
    sendAuthorized: false,
  };
  await audit(store, {
    type: "cfo_compliance_decision",
    operator: OPERATOR_NAMES.cfo,
    runId: lead.id || undefined,
    details: { synthetic: true, decision, blocks, escalations, flags },
    at: new Date().toISOString(),
  });
  return result;
}
