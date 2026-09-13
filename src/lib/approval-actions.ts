/**
 * The closed set of proposals the CRM knows how to execute, and the validation
 * that stands between an agent's jsonb payload and a real action.
 *
 * approval_request takes action_type as free text, so an agent can propose
 * anything. That is fine: an unrecognised proposal is still a legitimate record
 * of a decision. What must never happen is "execute" coming to mean "run
 * whatever an agent put in a jsonb column", and a closed set is what prevents
 * it.
 *
 * These live in src/lib/ rather than src/server/ because the approvals route
 * renders them in the browser, and they touch nothing server-only. Keeping them
 * pure is what makes the payload boundary testable without a database.
 */

export const EXECUTABLE_ACTIONS = ["send_email", "deal_close", "demo_site"] as const;

export type ExecutableAction = (typeof EXECUTABLE_ACTIONS)[number];

export function isExecutableAction(value: unknown): value is ExecutableAction {
  return typeof value === "string" && (EXECUTABLE_ACTIONS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DealClosePayload {
  dealId: string;
  note: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Validate a deal_close proposal.
 *
 * The deal id is taken from `target_id`, the structured field, and never from
 * the payload. Both are agent-supplied, so this is not about trusting one over
 * the other: it is about having ONE source. A payload naming a different deal
 * is a disagreement to refuse, not a tie to break, because whichever we picked
 * we would be guessing about what a human thought they were approving.
 */
export function validateDealClose(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<DealClosePayload> {
  if (targetType !== "deal") {
    return { ok: false, reason: "A deal_close proposal must target a deal." };
  }

  const dealId = typeof targetId === "string" ? targetId.trim() : "";
  if (!UUID.test(dealId)) {
    return { ok: false, reason: "The proposal does not name a valid deal." };
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "The proposal carries no payload object." };
  }
  const record = payload as Record<string, unknown>;

  const claimed = record.dealId;
  if (typeof claimed === "string" && claimed.trim() && claimed.trim() !== dealId) {
    return {
      ok: false,
      reason: "The payload and the proposal target disagree about which deal this is.",
    };
  }

  const note = typeof record.note === "string" ? record.note.trim() : "";
  if (!note) {
    return { ok: false, reason: "A note is required: it is the evidence the gate was met." };
  }

  return { ok: true, value: { dealId, note } };
}
