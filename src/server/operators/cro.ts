import { offerBySlug } from "../../lib/offers.ts";
import { audit } from "../operator-control/audit.ts";
import { PolicyDenied, requireControls } from "../operator-control/policy.ts";
import type { OperatorStore } from "../operator-control/types.ts";
import { runCfoComplianceGate } from "./cfo.ts";
import { OPERATOR_NAMES, type DraftResult, type SyntheticLead } from "./types.ts";

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export function buildCroSyntheticDraft(
  lead: SyntheticLead,
  compliance: DraftResult["compliance"],
): DraftResult {
  if (lead?.synthetic !== true) throw new PolicyDenied("synthetic_only");
  if (compliance.decision !== "pass") throw new PolicyDenied(`cfo_${compliance.decision}`);
  const offer = offerBySlug(lead.offerSlug);
  if (!offer) throw new PolicyDenied("offer_not_found");
  const draft = `Hello ${lead.contactName}, I noticed ${lead.businessName} may be dealing with ${lead.observedNeed}. GivenTake Devs offers “${offer.title},” which may be relevant. This is an illustrative draft for human review, not a promise of results, price, scope, or timing. If appropriate, a person can decide whether to follow up.\n\n—\nThis message was sent automatically by GivenTake Devs.\nReply and a person will read it.`;
  if (wordCount(draft) > 85) throw new PolicyDenied("draft_word_cap");
  const result: DraftResult = {
    operator: OPERATOR_NAMES.cro,
    status: "awaiting_human_review",
    leadId: lead.id,
    offerSlug: offer.slug,
    draft,
    wordCount: wordCount(draft),
    compliance,
    sendAuthorized: false,
    sideEffects: 0,
  };
  return result;
}

export async function runCroSyntheticPipeline(
  store: OperatorStore,
  lead: SyntheticLead,
): Promise<DraftResult> {
  await requireControls(store, OPERATOR_NAMES.cro, "synthetic");
  if (lead?.synthetic !== true) throw new PolicyDenied("synthetic_only");
  const compliance = await runCfoComplianceGate(store, lead);
  const result = buildCroSyntheticDraft(lead, compliance);
  await audit(store, {
    type: "cro_draft_queued",
    operator: OPERATOR_NAMES.cro,
    runId: lead.id,
    details: {
      synthetic: true,
      offerSlug: result.offerSlug,
      draft: result.draft,
      status: result.status,
    },
    at: new Date().toISOString(),
  });
  return result;
}
