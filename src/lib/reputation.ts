/**
 * Reputation suite — pure domain logic (no I/O, no DB, no secrets).
 *
 * A review moves draft -> approved -> published -> archived. The hard rule,
 * enforced here AND at the DB layer: a review may NEVER become 'published'
 * unless explicit permission has been obtained from its author. GivenTake has no
 * real case studies yet; nothing gets published as proof without permission.
 */

export type ReviewStatus = "draft" | "approved" | "published" | "archived";

const REVIEW_TRANSITIONS: Record<ReviewStatus, ReadonlySet<ReviewStatus>> = {
  draft: new Set<ReviewStatus>(["approved", "archived"]),
  approved: new Set<ReviewStatus>(["published", "draft", "archived"]),
  published: new Set<ReviewStatus>(["archived"]),
  archived: new Set<ReviewStatus>([]),
};

/** A review can only be published with author permission. */
export function canPublish(permissionObtained: boolean): boolean {
  return permissionObtained === true;
}

/**
 * Whether a status change is legal. Transitioning to 'published' additionally
 * requires permission — the compliance gate, checked before the state machine.
 */
export function canTransitionReview(
  from: ReviewStatus,
  to: ReviewStatus,
  permissionObtained: boolean,
): boolean {
  if (to === "published" && !canPublish(permissionObtained)) return false;
  return REVIEW_TRANSITIONS[from].has(to);
}
