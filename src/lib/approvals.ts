/**
 * Approval queue — pure domain logic (no I/O, no DB, no secrets).
 *
 * The human-facing inbox where an agent's proposed action waits for Salem's
 * decision. Richer than the raw operator_approvals primitive: it carries who
 * proposed it, what kind of action, a human summary, and a risk level, so the
 * dashboard can render a real decision queue.
 *
 * Lifecycle: pending -> approved -> executed, or pending -> rejected, or
 * pending/approved -> expired. Nothing executes without an explicit approval;
 * this module decides which status changes are legal.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export const RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high", "critical"];

const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ReadonlySet<ApprovalStatus>> = {
  pending: new Set<ApprovalStatus>(["approved", "rejected", "expired"]),
  approved: new Set<ApprovalStatus>(["executed", "expired"]),
  rejected: new Set<ApprovalStatus>([]),
  expired: new Set<ApprovalStatus>([]),
  executed: new Set<ApprovalStatus>([]),
};

export function canDecideApproval(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return APPROVAL_TRANSITIONS[from].has(to);
}

/** A request is expired once past its expiry. No expiry (null) never expires. */
export function isApprovalExpired(expiresAtMs: number | null, nowMs: number): boolean {
  return expiresAtMs != null && nowMs > expiresAtMs;
}

export function isValidRiskLevel(value: string): value is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(value);
}
