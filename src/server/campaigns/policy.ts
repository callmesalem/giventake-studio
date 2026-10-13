import type { CampaignStore } from "./types.ts";

export interface GateDecision {
  allow: boolean;
  status?: "suppressed" | "stopped";
  reason?: string;
}

/**
 * Charter §3.8. Both checks fail closed: a network error refuses the send
 * rather than allowing it, matching how crm-data.ts already treats these
 * (`.catch(() => true)` for suppression, `.catch(() => false)` for approval).
 *
 * Evaluated at send time, not enrollment time: an address can reach
 * do_not_contact, or an approval can pass expires_at, mid-sequence.
 *
 * Two audiences, two consent models. A cold campaign needs the per-SOP human
 * allowlist. An opt_in campaign needs the lead's own recorded consent
 * (leads.consent_given, written at intake and never by an agent) and no
 * allowlist. do_not_contact wins over both: suppression is consent withdrawn.
 */
export async function evaluateGates(
  store: Pick<CampaignStore, "isSuppressed" | "isApprovedRecipient">,
  input: {
    email: string | null;
    sop: string | null;
    audienceKind?: "cold" | "opt_in";
    consentGiven?: boolean;
  },
): Promise<GateDecision> {
  if (!input.email) return { allow: false, status: "stopped", reason: "no_address" };

  const suppressed = await store.isSuppressed(input.email).catch(() => true);
  if (suppressed) return { allow: false, status: "suppressed", reason: "do_not_contact" };

  if (input.audienceKind === "opt_in") {
    if (input.consentGiven !== true) {
      return { allow: false, status: "stopped", reason: "no_consent" };
    }
    return { allow: true };
  }

  if (!input.sop) return { allow: false, status: "stopped", reason: "no_sop" };
  const approved = await store.isApprovedRecipient(input.email, input.sop).catch(() => false);
  if (!approved) return { allow: false, status: "stopped", reason: "not_approved" };

  return { allow: true };
}
