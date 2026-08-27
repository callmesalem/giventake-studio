/**
 * Newsletter suite — pure domain logic (no I/O, no DB, no secrets).
 *
 * Encodes the compliance-critical parts of an owned newsletter so they live in
 * tested code:
 *  - double opt-in: a subscription is `pending` until a confirmation token is
 *    used before it expires; only then does it become `confirmed`,
 *  - send-eligibility: only confirmed, non-unsubscribed, non-suppressed
 *    subscribers may receive an issue (CAN-SPAM + your `do_not_contact` list),
 *  - issue lifecycle: draft -> scheduled -> sent (or canceled/archived).
 *
 * Sending stays human/gated via Resend; this module only decides eligibility
 * and state, never sends.
 */

export type SubscriberStatus =
  | "pending" // signed up, awaiting double opt-in confirmation
  | "confirmed" // opted in, may receive issues
  | "unsubscribed" // opted out
  | "suppressed" // on do_not_contact
  | "bounced"; // hard-bounced address

export type IssueStatus = "draft" | "scheduled" | "sent" | "canceled" | "archived";

export type ConfirmResult =
  { ok: true; status: "confirmed" } | { ok: false; reason: "not_pending" | "token_expired" };

/**
 * Apply a double opt-in confirmation. Succeeds only from `pending` and only
 * while the confirmation token is within its TTL. Anything else is rejected —
 * confirmation is never inferred.
 */
export function confirmSubscription(
  status: SubscriberStatus,
  tokenIssuedAtMs: number,
  nowMs: number,
  ttlHours = 72,
): ConfirmResult {
  if (status !== "pending") return { ok: false, reason: "not_pending" };
  const expiresAt = tokenIssuedAtMs + ttlHours * 3_600_000;
  if (nowMs > expiresAt) return { ok: false, reason: "token_expired" };
  return { ok: true, status: "confirmed" };
}

/**
 * Whether a subscriber may receive a newsletter issue. Requires an explicit
 * confirmed opt-in and no suppression — fail-closed on anything else.
 */
export function canReceiveNewsletter(status: SubscriberStatus, isSuppressed: boolean): boolean {
  if (isSuppressed) return false;
  return status === "confirmed";
}

/** Unsubscribe is always honored from any active state; idempotent otherwise. */
export function applyUnsubscribe(status: SubscriberStatus): SubscriberStatus {
  if (status === "suppressed" || status === "bounced") return status;
  return "unsubscribed";
}

const ISSUE_TRANSITIONS: Record<IssueStatus, ReadonlySet<IssueStatus>> = {
  draft: new Set(["scheduled", "canceled", "archived"]),
  scheduled: new Set(["sent", "canceled", "draft"]),
  sent: new Set(["archived"]),
  canceled: new Set(["draft", "archived"]),
  archived: new Set([]),
};

export function canTransitionIssue(from: IssueStatus, to: IssueStatus): boolean {
  return ISSUE_TRANSITIONS[from].has(to);
}

/** Reduce a subscriber list to the addresses eligible to receive an issue. */
export function eligibleRecipients<T extends { status: SubscriberStatus; suppressed: boolean }>(
  subscribers: T[],
): T[] {
  return subscribers.filter((s) => canReceiveNewsletter(s.status, s.suppressed));
}
