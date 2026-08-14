import { audit } from "../operator-control/audit.ts";
import { PolicyDenied, requireControls } from "../operator-control/policy.ts";
import type { OperatorStore } from "../operator-control/types.ts";
import { OPERATOR_NAMES, type CfoResult, type DraftResult, type SiteAuditResult } from "./types.ts";

export interface SyntheticOperatorResults {
  synthetic: true;
  runId: string;
  compliance: CfoResult[];
  drafts: DraftResult[];
  audits: SiteAuditResult[];
}
export async function compileSyntheticOperatorReport(
  store: OperatorStore,
  input: SyntheticOperatorResults,
) {
  await requireControls(store, OPERATOR_NAMES.orchestrator, "synthetic");
  if (input?.synthetic !== true) throw new PolicyDenied("synthetic_only");
  const blocks = input.compliance.flatMap((item) => item.blocks);
  const escalations = input.compliance.flatMap((item) => item.escalations);
  const report = [
    `Synthetic GivenTake operator report — ${input.runId}`,
    `Compliance checks: ${input.compliance.length}`,
    `Blocks (${blocks.length}): ${blocks.join(", ") || "none"}`,
    `Escalations (${escalations.length}): ${escalations.join(", ") || "none"}`,
    `Drafts awaiting human review: ${input.drafts.filter((d) => d.status === "awaiting_human_review").length}`,
    `Site audits: ${input.audits.length}; supplied verified gaps: ${input.audits.reduce((n, item) => n + item.gaps.length, 0)}`,
    "Action authority: zero. No sends, deployments, prices, scope, or deadlines are authorized.",
  ].join("\n");
  const result = {
    counts: {
      compliance: input.compliance.length,
      drafts: input.drafts.length,
      audits: input.audits.length,
    },
    blocks,
    escalations,
    draftsAwaitingHumanReview: input.drafts.filter((d) => d.status === "awaiting_human_review")
      .length,
    actionAuthority: 0 as const,
    report,
  };
  await audit(store, {
    type: "synthetic_operator_report",
    operator: OPERATOR_NAMES.orchestrator,
    runId: input.runId,
    details: { synthetic: true, ...result },
    at: new Date().toISOString(),
  });
  return result;
}
