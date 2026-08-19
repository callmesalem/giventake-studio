/**
 * Referral suite — pure domain logic (no I/O, no DB, no secrets).
 *
 * Encodes the referral lifecycle so the rules live in tested code, not in an
 * agent's prompt or scattered across SQL. A referral moves from received, through
 * qualification, to converted; it may be declined from received or qualified.
 * Once converted or declined the referral is terminal.
 *
 * Charter alignment: this module decides WHETHER a status change is legal. It
 * never contacts anyone; the DB/RPC layer enforces the same allowed set as a
 * belt-and-suspenders check.
 */

export type ReferralStatus = "received" | "qualified" | "converted" | "declined";

const REFERRAL_TRANSITIONS: Record<ReferralStatus, ReadonlySet<ReferralStatus>> = {
  received: new Set<ReferralStatus>(["qualified", "declined"]),
  qualified: new Set<ReferralStatus>(["converted", "declined"]),
  converted: new Set<ReferralStatus>([]),
  declined: new Set<ReferralStatus>([]),
};

/** Statuses from which no further transition is possible. */
const TERMINAL_REFERRAL: ReadonlySet<ReferralStatus> = new Set<ReferralStatus>([
  "converted",
  "declined",
]);

export function isTerminalReferral(status: ReferralStatus): boolean {
  return TERMINAL_REFERRAL.has(status);
}

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return REFERRAL_TRANSITIONS[from].has(to);
}
