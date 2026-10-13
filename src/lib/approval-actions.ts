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

import { canAssign } from "./crm-guards.ts";

export const EXECUTABLE_ACTIONS = [
  "send_email",
  "deal_close",
  "demo_site",
  // MCP gateway phase 4: record writes the CRM already exposes as RPCs.
  "lead_set_status",
  "crm_assign",
  "deal_link_lead",
  "client_create",
  "project_create",
  "invoice_create",
  "document_request_signature",
] as const;

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

/* ── Phase 4: record writes ───────────────────────────────────────────────
 *
 * Each of these fronts an RPC that already validates for itself (a status must
 * be a short lowercase word, an amount must be zero or more cents). The checks
 * here repeat only what keeps a malformed row from reaching the executor and
 * keep the one-source rule: the record acted on is always the structured
 * target, never something the payload names.
 */

/** The RPCs' own rule for lead and invoice statuses. */
const SHORT_WORD = /^[a-z][a-z_]{0,39}$/;
const NAME_MAX = 200;

function fail<T>(reason: string): ValidationResult<T> {
  return { ok: false, reason };
}

function targetUuid(targetId: unknown): string | null {
  const id = typeof targetId === "string" ? targetId.trim() : "";
  return UUID.test(id) ? id : null;
}

function payloadObject(payload: unknown): Record<string, unknown> | null {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

function optionalUuid(v: unknown): string | null | false {
  if (v === undefined || v === null || v === "") return null;
  return typeof v === "string" && UUID.test(v.trim()) ? v.trim() : false;
}

function shortName(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, NAME_MAX) : "";
}

export function validateLeadSetStatus(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{ leadId: string; status: string }> {
  if (targetType !== "lead") return fail("A lead_set_status proposal must target a lead.");
  const leadId = targetUuid(targetId);
  if (!leadId) return fail("The proposal does not name a valid lead.");
  const record = payloadObject(payload);
  const status = typeof record?.status === "string" ? record.status.trim() : "";
  if (!SHORT_WORD.test(status)) {
    return fail("A status is required: one short lowercase word, such as qualified.");
  }
  return { ok: true, value: { leadId, status } };
}

export function validateCrmAssign(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{ table: string; column: string; id: string; userId: string | null }> {
  const record = payloadObject(payload);
  const column = typeof record?.column === "string" ? record.column.trim() : "";
  if (!canAssign(targetType, column)) {
    return fail("That record and column cannot be assigned (see ASSIGNABLE in crm-guards).");
  }
  const id = targetUuid(targetId);
  if (!id) return fail("The proposal does not name a valid record.");
  const userId = optionalUuid(record?.userId);
  if (userId === false) return fail("userId must be a member id, or empty to unassign.");
  return { ok: true, value: { table: targetType as string, column, id, userId } };
}

export function validateDealLinkLead(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{ dealId: string; leadId: string }> {
  if (targetType !== "deal") return fail("A deal_link_lead proposal must target a deal.");
  const dealId = targetUuid(targetId);
  if (!dealId) return fail("The proposal does not name a valid deal.");
  const leadId = optionalUuid(payloadObject(payload)?.leadId);
  if (!leadId) return fail("leadId is required: the lead this deal came from.");
  return { ok: true, value: { dealId, leadId } };
}

export function validateClientCreate(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{
  dealId: string;
  name: string;
  leadId: string | null;
  aiProcessingAllowed: boolean;
  ownerId: string | null;
}> {
  if (targetType !== "deal") return fail("A client_create proposal must target the won deal.");
  const dealId = targetUuid(targetId);
  if (!dealId) return fail("The proposal does not name a valid deal.");
  const record = payloadObject(payload);
  const name = shortName(record?.name);
  if (!name) return fail("A client name is required.");
  const leadId = optionalUuid(record?.leadId);
  if (leadId === false) return fail("leadId must be a lead id, or empty.");
  const ownerId = optionalUuid(record?.ownerId);
  if (ownerId === false) return fail("ownerId must be a member id, or empty.");
  const ai = record?.aiProcessingAllowed;
  if (ai !== undefined && typeof ai !== "boolean") {
    return fail("aiProcessingAllowed must be true or false.");
  }
  // Consent to AI processing is never assumed: absent means no.
  return {
    ok: true,
    value: { dealId, name, leadId, aiProcessingAllowed: ai === true, ownerId },
  };
}

export function validateProjectCreate(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{ clientId: string; name: string }> {
  if (targetType !== "client") return fail("A project_create proposal must target a client.");
  const clientId = targetUuid(targetId);
  if (!clientId) return fail("The proposal does not name a valid client.");
  const name = shortName(payloadObject(payload)?.name);
  if (!name) return fail("A project name is required.");
  return { ok: true, value: { clientId, name } };
}

export function validateInvoiceCreate(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{
  projectId: string;
  amountCents: number;
  currency: string;
  status: string;
  dueAt: string | null;
}> {
  if (targetType !== "project") return fail("An invoice_create proposal must target a project.");
  const projectId = targetUuid(targetId);
  if (!projectId) return fail("The proposal does not name a valid project.");
  const record = payloadObject(payload);
  const amountCents = record?.amountCents;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents < 0) {
    return fail("amountCents must be a whole number of cents, zero or more.");
  }
  const currency =
    typeof record?.currency === "string" && record.currency.trim()
      ? record.currency.trim().toLowerCase()
      : "usd";
  if (!/^[a-z]{3}$/.test(currency)) return fail("currency must be a three-letter code.");
  const status =
    typeof record?.status === "string" && record.status.trim() ? record.status.trim() : "draft";
  if (!SHORT_WORD.test(status)) return fail("status must be one short lowercase word.");
  let dueAt: string | null = null;
  if (record?.dueAt !== undefined && record?.dueAt !== null && record?.dueAt !== "") {
    const parsed = typeof record.dueAt === "string" ? Date.parse(record.dueAt) : NaN;
    if (Number.isNaN(parsed)) return fail("dueAt must be an ISO date, or empty.");
    dueAt = new Date(parsed).toISOString();
  }
  return { ok: true, value: { projectId, amountCents, currency, status, dueAt } };
}

export function validateDocumentRequestSignature(
  targetType: unknown,
  targetId: unknown,
  payload: unknown,
): ValidationResult<{
  documentId: string;
  dealId: string;
  recipientName: string;
  recipientEmail: string;
}> {
  if (targetType !== "document") {
    return fail("A document_request_signature proposal must target a document.");
  }
  const documentId = targetUuid(targetId);
  if (!documentId) return fail("The proposal does not name a valid document.");
  const record = payloadObject(payload);
  const dealId = optionalUuid(record?.dealId);
  if (!dealId) return fail("dealId is required: the deal the document belongs to.");
  const recipientName = shortName(record?.recipientName);
  if (!recipientName || /[\r\n]/.test(recipientName)) {
    return fail("A recipient name is required, on one line.");
  }
  const recipientEmail =
    typeof record?.recipientEmail === "string" ? record.recipientEmail.trim().toLowerCase() : "";
  if (recipientEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return fail("A recipient email address is required.");
  }
  return { ok: true, value: { documentId, dealId, recipientName, recipientEmail } };
}
