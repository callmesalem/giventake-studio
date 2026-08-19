/**
 * Campaign suite — pure domain logic (no I/O, no DB, no secrets).
 *
 * Encodes the outreach lifecycle so the rules live in tested code, not in an
 * agent's prompt or scattered across SQL:
 *  - campaign status transitions,
 *  - per-lead enrollment status + the compliance STOP rules (reply, unsubscribe,
 *    suppression, bounce, manual) that halt automated outreach,
 *  - whether the next sequence step is due.
 *
 * Charter alignment: this module decides WHEN a step is due and WHETHER an
 * enrollment must stop. It never sends. Sending stays human/gated; suppression
 * (`do_not_contact`) is enforced at the DB/RPC layer as well — this is the
 * belt-and-suspenders decision layer.
 */

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type EnrollmentStatus =
  | "enrolled" // queued, no step sent yet
  | "active" // mid-sequence
  | "replied" // prospect responded -> human takes over
  | "unsubscribed" // opted out
  | "suppressed" // on do_not_contact
  | "bounced" // invalid address
  | "completed" // finished the sequence
  | "stopped"; // manually halted

/** Events that terminate an enrollment's automated outreach. */
export type StopEvent = "reply" | "unsubscribe" | "suppression" | "bounce" | "manual_stop";

/** Enrollment statuses from which no further step is ever sent. */
const TERMINAL_ENROLLMENT: ReadonlySet<EnrollmentStatus> = new Set<EnrollmentStatus>([
  "replied",
  "unsubscribed",
  "suppressed",
  "bounced",
  "completed",
  "stopped",
]);

export function isTerminalEnrollment(status: EnrollmentStatus): boolean {
  return TERMINAL_ENROLLMENT.has(status);
}

/** Map a stop event to the enrollment status it produces. */
export function statusForStopEvent(event: StopEvent): EnrollmentStatus {
  switch (event) {
    case "reply":
      return "replied";
    case "unsubscribe":
      return "unsubscribed";
    case "suppression":
      return "suppressed";
    case "bounce":
      return "bounced";
    case "manual_stop":
      return "stopped";
  }
}

const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, ReadonlySet<CampaignStatus>> = {
  draft: new Set(["active", "archived"]),
  active: new Set(["paused", "completed", "archived"]),
  paused: new Set(["active", "archived"]),
  completed: new Set(["archived"]),
  archived: new Set([]),
};

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return CAMPAIGN_TRANSITIONS[from].has(to);
}

export interface CampaignStep {
  /** 0-based position in the sequence. */
  order: number;
  /** Delay before this step, measured from the previous advance (or enrollment for step 0). */
  delayHours: number;
}

export interface Enrollment {
  status: EnrollmentStatus;
  /** Index of the NEXT step to send (0-based). Equals steps.length when finished. */
  currentStep: number;
  /** Epoch ms of the last advance, or of enrollment for step 0. */
  lastAdvancedAt: number;
}

export interface NextStepDecision {
  /** The step to send now, or null. */
  step: CampaignStep | null;
  /** Why no step: terminal enrollment, sequence finished, or not yet due. */
  reason: "due" | "terminal" | "finished" | "not_due";
}

/**
 * Decide whether the next sequence step is due for an enrollment. Never returns
 * a step for a terminal enrollment or a finished sequence. Steps are read by
 * their `order`; the array may be unsorted.
 */
export function nextStepDue(
  enrollment: Enrollment,
  steps: CampaignStep[],
  nowMs: number,
): NextStepDecision {
  if (isTerminalEnrollment(enrollment.status)) {
    return { step: null, reason: "terminal" };
  }
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  if (enrollment.currentStep >= ordered.length) {
    return { step: null, reason: "finished" };
  }
  const step = ordered[enrollment.currentStep]!;
  const dueAt = enrollment.lastAdvancedAt + step.delayHours * 3_600_000;
  if (nowMs >= dueAt) {
    return { step, reason: "due" };
  }
  return { step: null, reason: "not_due" };
}
