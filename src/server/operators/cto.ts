import { offerBySlug } from "../../lib/offers.ts";
import { audit } from "../operator-control/audit.ts";
import { PolicyDenied, requireControls } from "../operator-control/policy.ts";
import type { OperatorStore } from "../operator-control/types.ts";
import { OPERATOR_NAMES, type SiteAuditInput, type SiteAuditResult } from "./types.ts";

export async function runCtoSyntheticSiteAudit(
  store: OperatorStore,
  input: SiteAuditInput,
): Promise<SiteAuditResult> {
  await requireControls(store, OPERATOR_NAMES.cto, "synthetic");
  if (input?.synthetic !== true) throw new PolicyDenied("synthetic_only");
  if (!input.auditId || !input.offerSlug || !Array.isArray(input.suppliedFacts))
    throw new PolicyDenied("missing_required_input");
  if (!offerBySlug(input.offerSlug)) throw new PolicyDenied("offer_not_found");
  const gaps = input.suppliedFacts
    .filter((fact) => fact.verified === true && fact.label.trim() && fact.evidence.trim())
    .slice(0, 2);
  const result: SiteAuditResult = {
    operator: OPERATOR_NAMES.cto,
    status: gaps.length ? "gaps_found" : "no_verified_gaps",
    offerSlug: input.offerSlug,
    gaps,
    actionAuthority: false,
    fetchedUrls: 0,
    sideEffects: 0,
  };
  await audit(store, {
    type: "cto_synthetic_audit",
    operator: OPERATOR_NAMES.cto,
    runId: input.auditId,
    details: { synthetic: true, status: result.status, offerSlug: input.offerSlug, gaps },
    at: new Date().toISOString(),
  });
  return result;
}
