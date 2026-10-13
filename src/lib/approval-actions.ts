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

export interface SendEmailPayload {
  /** Which record the recipient is re-read from. The address itself is never
   *  taken from the payload; see validateSendEmail. */
  targetType: "lead" | "contact";
  targetId: string;
  subject: string;
  body: string;
  /** The address the agent BELIEVED it was writing to, if it said. Compared to
   *  the record at execution time; a disagreement refuses. */
  claimedTo: string | null;
}

const SUBJECT_MAX = 200;
const BODY_MAX = 20_000;

/**
 * Validate a send_email proposal.
 *
 * The recipient is resolved from the target record at execution time, never
 * from the payload: an agent that read a lead's own words can be steered by
 * them, and "send this to attacker@example.com" is the obvious steer. The
 * payload may name an address, and if it does it must match the record, for
 * the same one-source reason validateDealClose gives.
 */
export function validateSendEmail(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<SendEmailPayload> {
  if (targetType !== "lead" && targetType !== "contact") {
    return { ok: false, reason: "A send_email proposal must target a lead or a contact." };
  }
  const id = typeof targetId === "string" ? targetId.trim() : "";
  if (!UUID.test(id)) {
    return { ok: false, reason: "The proposal does not name a valid recipient record." };
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "The proposal carries no payload object." };
  }
  const record = payload as Record<string, unknown>;

  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  if (!subject) return { ok: false, reason: "A subject is required." };
  if (subject.length > SUBJECT_MAX) {
    return { ok: false, reason: `The subject is longer than ${SUBJECT_MAX} characters.` };
  }
  // A header injection ("Subject: x\r\nBcc: ...") is refused outright rather
  // than sanitised: a payload trying it is not a payload to repair.
  if (/[\r\n]/.test(subject)) return { ok: false, reason: "The subject contains a line break." };

  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!body) return { ok: false, reason: "An email body is required." };
  if (body.length > BODY_MAX) {
    return { ok: false, reason: `The body is longer than ${BODY_MAX} characters.` };
  }

  const claimedTo =
    typeof record.to === "string" && record.to.trim() ? record.to.trim().toLowerCase() : null;

  return { ok: true, value: { targetType, targetId: id, subject, body, claimedTo } };
}

export interface DemoSitePayload {
  targetType: "deal" | "company";
  targetId: string;
  businessName: string;
  address: string | null;
  vertical: string | null;
}

/**
 * Validate a demo_site proposal. The record it attaches to is the structured
 * target; the payload carries only what the builder needs to know.
 */
export function validateDemoSite(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<DemoSitePayload> {
  if (targetType !== "deal" && targetType !== "company") {
    return { ok: false, reason: "A demo_site proposal must target a deal or a company." };
  }
  const id = typeof targetId === "string" ? targetId.trim() : "";
  if (!UUID.test(id)) {
    return { ok: false, reason: "The proposal does not name a valid deal or company." };
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "The proposal carries no payload object." };
  }
  const record = payload as Record<string, unknown>;
  const businessName =
    typeof record.businessName === "string" ? record.businessName.trim().slice(0, 200) : "";
  if (!businessName) {
    return {
      ok: false,
      reason: "A business name is required: it is what the builder searches for.",
    };
  }
  const optional = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;
  return {
    ok: true,
    value: {
      targetType,
      targetId: id,
      businessName,
      address: optional(record.address),
      vertical: optional(record.vertical),
    },
  };
}
