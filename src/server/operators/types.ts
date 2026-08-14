export const OPERATOR_NAMES = {
  cfo: "giventake-cfo-compliance",
  cro: "giventake-cro-pipeline",
  cto: "giventake-cto-site-audit",
  orchestrator: "giventake-synthetic-orchestrator",
} as const;

export type OperatorDecision = "pass" | "block" | "escalate";
export interface SyntheticLead {
  synthetic: true;
  id: string;
  email: string;
  contactName: string;
  businessName: string;
  category: string;
  offerSlug: string;
  observedNeed: string;
  sourceText?: string;
  containsRegulatedData?: boolean;
  classificationAmbiguous?: boolean;
}
export interface CfoResult {
  operator: typeof OPERATOR_NAMES.cfo;
  decision: OperatorDecision;
  blocks: string[];
  escalations: string[];
  flags: string[];
  sendAuthorized: false;
}
export interface DraftResult {
  operator: typeof OPERATOR_NAMES.cro;
  status: "awaiting_human_review";
  leadId: string;
  offerSlug: string;
  draft: string;
  wordCount: number;
  compliance: CfoResult;
  sendAuthorized: false;
  sideEffects: 0;
}
export interface AuditGap {
  label: string;
  evidence: string;
  verified: boolean;
}
export interface SiteAuditInput {
  synthetic: true;
  auditId: string;
  offerSlug: string;
  suppliedFacts: AuditGap[];
}
export interface SiteAuditResult {
  operator: typeof OPERATOR_NAMES.cto;
  status: "gaps_found" | "no_verified_gaps";
  offerSlug: string;
  gaps: AuditGap[];
  actionAuthority: false;
  fetchedUrls: 0;
  sideEffects: 0;
}
