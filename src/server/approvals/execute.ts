/**
 * The approval executor.
 *
 * src/lib/approvals.ts documents the lifecycle as pending -> approved ->
 * executed, and approval_mark_executed records a RESULT, but until this module
 * nothing performed the ACTION between those two states. An approval was a
 * decision nothing acted on.
 *
 * The property this exists to preserve: APPROVAL NEVER BYPASSES A GATE. A human
 * approval satisfies "a human authorised this". It does not satisfy "this is
 * otherwise permitted" - that is the subsystem's own question, and it is asked
 * again here, after the approval. CrmActions.advanceDealStage still refuses a
 * Close with no signed SOW, and a refusal is RECORDED rather than swallowed: an
 * operator who clicked Approve and saw nothing would reasonably assume it
 * worked.
 *
 * Pure except for the injected deps, same pattern as src/server/documents/
 * issue.ts: a narrow interface declared here rather than importing CrmActions,
 * so this module is testable with a small fake instead of a database.
 */
import {
  isExecutableAction,
  validateClientCreate,
  validateCrmAssign,
  validateDealClose,
  validateDealLinkLead,
  validateDemoSite,
  validateDocumentRequestSignature,
  validateInvoiceCreate,
  validateLeadSetStatus,
  validateProjectCreate,
  validateSendEmail,
} from "../../lib/approval-actions.ts";
import { buildDemoSiteGates, isDemoSiteRequestable } from "../../lib/crm-guards.ts";

/** The stage a deal_close proposal advances into. A literal rather than a
 *  lookup for the reason crm-guards.ts gives about CLOSE_STAGE_NAME: a gate
 *  whose lookup can fail has to decide whether to open, and there is no good
 *  answer. */
export const CLOSE_STAGE_FOR_APPROVAL = "Close";

export interface StoredApproval {
  id: string;
  actionType: string | null;
  /** Which operator proposed this. Charter section 13 requires a stored fact to
   *  carry its source, and the note below is a claim an agent wrote. */
  agentName: string | null;
  targetType: string | null;
  targetId: string | null;
  status: string;
  payload: unknown;
}

export interface ExecutorDeps {
  getApproval(id: string): Promise<StoredApproval | null>;
  advanceDealStage(input: {
    dealId: string;
    toStage: string;
    note: string;
    actor: string;
  }): Promise<unknown>;
  markExecuted(id: string, result: Record<string, unknown>): Promise<void>;

  /** The address on the target record, re-read now. null when the record is
   *  missing; { email: null } when it exists but has no address. */
  recipientFor(
    targetType: "lead" | "contact",
    targetId: string,
  ): Promise<{ email: string | null } | null>;
  /** do_not_contact, checked fresh against the address on the record. */
  isSuppressed(address: string): Promise<boolean>;
  /** The section 10 kill switch. Anything but an explicit true is off. */
  outboundControl(): Promise<{ outboundEnabled?: boolean; reason?: string }>;
  sendEmail(input: { to: string; subject: string; text: string }): Promise<{ status: string }>;
  /** Whether the record exists and what demos it already carries. */
  demoSiteFacts(
    targetType: "deal" | "company",
    targetId: string,
  ): Promise<{ exists: boolean; existingStatuses: string[] }>;
  requestDemoSite(input: {
    companyId: string | null;
    dealId: string | null;
    businessName: string;
    address: string | null;
    vertical: string | null;
  }): Promise<string>;

  /* Phase 4 record writes. Each is the CrmActions method of the same name;
   * the RPC behind it raises on a missing record or a bad value, and that
   * raise is reported as a refusal without its text (it can name a person). */
  setLeadStatus(leadId: string, status: string): Promise<void>;
  assignRecord(input: {
    table: string;
    column: string;
    id: string;
    userId: string | null;
  }): Promise<void>;
  linkDealToLead(dealId: string, leadId: string): Promise<void>;
  createClient(input: {
    name: string;
    leadId: string | null;
    dealId: string;
    aiProcessingAllowed: boolean;
    ownerId: string | null;
  }): Promise<string>;
  createProject(clientId: string, name: string): Promise<void>;
  createInvoice(input: {
    projectId: string;
    amountCents: number;
    currency: string;
    status: string;
    dueAt: string | null;
  }): Promise<void>;

  /** The document as it is now, or null when it is not on that deal. */
  documentForSignature(
    dealId: string,
    documentId: string,
  ): Promise<{ status: string; bodyHash: string; title: string } | null>;
  /** null is the database refusing because the body moved on; nothing was written. */
  requestSignature(input: {
    documentId: string;
    bodyHash: string;
    recipientName: string;
    recipientEmail: string;
    sentBy: string | null;
  }): Promise<{ id: string; signingToken: string } | null>;
  sendSignatureEmail(input: {
    to: string;
    recipientName: string;
    documentTitle: string;
    signingToken: string;
  }): Promise<{ sent: boolean }>;
}

export type ExecutionOutcome =
  | { ok: true; action: string; recorded?: false }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-approved"; status: string }
  | { ok: false; reason: "not-executable"; actionType: string; recorded?: false }
  | { ok: false; reason: "refused"; detail: string; recorded?: false };

/*
 * There is deliberately no separate "error" variant in phase 1, though the spec
 * describes refusal and error as two kinds.
 *
 * CrmActions.advanceDealStage throws a plain Error for BOTH: the signed-SOW gate
 * throws one, and #rpc throws one on a transport failure. Telling them apart
 * would mean matching on message text, which breaks the first time someone
 * rewords the gate. So phase 1 reports one outcome and says only what it can
 * stand behind: the deal was not advanced.
 *
 * Distinguishing them properly means giving CrmActions a typed error, which is
 * a change to a class eleven other call sites depend on. Worth doing before the
 * send_email handler lands, where "it was refused" and "it did not run" lead an
 * operator to do different things. Out of scope here.
 */

/** Record the result, and report whether recording worked.
 *
 *  A bookkeeping failure after a committed side effect is the one case where
 *  throwing would be actively harmful: the action HAS happened, the operator
 *  would be told it failed, and no retry is possible because approval_decide
 *  now raises "already decided". So the failure is reported alongside the real
 *  outcome instead. Nothing is retried and nothing is rolled back: the side
 *  effect is committed and re-running it would be worse than not recording it. */
async function record(
  deps: ExecutorDeps,
  id: string,
  result: Record<string, unknown>,
): Promise<boolean> {
  try {
    await deps.markExecuted(id, result);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run one approved proposal.
 *
 * The id is the only thing taken from the caller. Everything else is re-read,
 * because proposed_payload was written by an agent that reads text strangers
 * wrote.
 */
/**
 * The note as it will be stored, with its source attached.
 *
 * Charter section 13: never store an assumption as a fact, and every meaningful
 * fact carries source and date. `deal_advance_stage` records this note as the
 * evidence the stage gate was met, and an unattributed note reads as the
 * approver's own first-hand observation. It is not: an agent wrote it, and a
 * human accepted it.
 *
 * Confidence is deliberately absent rather than invented. The proposal carries
 * no confidence value, and manufacturing one here would be exactly the
 * assumption-stored-as-fact that section 13 forbids.
 *
 * The advance itself does NOT rest on this text. deal_advance_stage asks
 * deal_has_signed_sow against the database, so the note is the account of why,
 * not the basis for it.
 */
export function attributedNote(
  note: string,
  agentName: string | null,
  actor: string,
  now: Date,
): string {
  const source = agentName?.trim() || "an unnamed operator";
  const day = now.toISOString().slice(0, 10);
  return `${note}

Proposed by ${source}, approved by ${actor} on ${day}.`;
}

export async function executeApproval(
  deps: ExecutorDeps,
  id: string,
  actor: string,
  now: Date = new Date(),
): Promise<ExecutionOutcome> {
  const approval = await deps.getApproval(id);
  if (!approval) return { ok: false, reason: "not-found" };

  // approval_mark_executed raises unless the status is exactly 'approved', so
  // marking here would throw. Nothing is recorded and nothing is run.
  if (approval.status !== "approved") {
    return { ok: false, reason: "not-approved", status: approval.status };
  }

  const actionType = approval.actionType ?? "";
  if (!isExecutableAction(actionType)) {
    const detail = "The CRM cannot execute this kind of proposal.";
    const recorded = await record(deps, id, { ok: false, refused: "not-executable", detail });
    return recorded
      ? { ok: false, reason: "not-executable", actionType }
      : { ok: false, reason: "not-executable", actionType, recorded: false };
  }

  const refuse = async (detail: string): Promise<ExecutionOutcome> => {
    const recorded = await record(deps, id, { ok: false, refused: actionType, detail });
    return recorded
      ? { ok: false, reason: "refused", detail }
      : { ok: false, reason: "refused", detail, recorded: false };
  };
  const done = async (extra: Record<string, unknown> = {}): Promise<ExecutionOutcome> => {
    const recorded = await record(deps, id, { ok: true, action: actionType, ...extra });
    return recorded
      ? { ok: true, action: actionType }
      : { ok: true, action: actionType, recorded: false };
  };

  if (actionType === "send_email") return executeSendEmail(deps, approval, refuse, done);
  if (actionType === "demo_site") return executeDemoSite(deps, approval, refuse, done);
  if (actionType === "document_request_signature") {
    return executeSignatureRequest(deps, approval, refuse, done);
  }
  if (actionType !== "deal_close")
    return executeRecordWrite(deps, approval, actionType, refuse, done);

  const validated = validateDealClose(approval.targetType, approval.targetId, approval.payload);
  if (!validated.ok) {
    const recorded = await record(deps, id, {
      ok: false,
      refused: "deal_close",
      detail: validated.reason,
    });
    return recorded
      ? { ok: false, reason: "refused", detail: validated.reason }
      : { ok: false, reason: "refused", detail: validated.reason, recorded: false };
  }

  try {
    await deps.advanceDealStage({
      dealId: validated.value.dealId,
      toStage: CLOSE_STAGE_FOR_APPROVAL,
      note: attributedNote(validated.value.note, approval.agentName, actor, now),
      actor,
    });
  } catch {
    // The thrown message is deliberately not recorded: it can name a deal, a
    // client or a contact, and campaigns/mailer.ts sets the rule that errors
    // never echo personal data.
    //
    // The wording claims only what this code can stand behind. It does NOT say
    // "the gate refused", because a transport failure throws here too and this
    // cannot tell the two apart - see the note on ExecutionOutcome.
    const detail =
      "The deal was not advanced. Approving it again will not help until you check why.";
    const recorded = await record(deps, id, { ok: false, refused: "deal_close", detail });
    return recorded
      ? { ok: false, reason: "refused", detail }
      : { ok: false, reason: "refused", detail, recorded: false };
  }

  const recorded = await record(deps, id, { ok: true, action: "deal_close" });
  return recorded
    ? { ok: true, action: "deal_close" }
    : { ok: true, action: "deal_close", recorded: false };
}

type Refuse = (detail: string) => Promise<ExecutionOutcome>;
type Done = (extra?: Record<string, unknown>) => Promise<ExecutionOutcome>;

/**
 * send_email: the one action that reaches a person.
 *
 * The human approved the subject and body verbatim, so they are sent verbatim:
 * no attribution line is appended, because the recipient is a prospect, not a
 * record. What the approval did NOT settle is re-checked here against the
 * database, never the payload: that the record still exists, that its address
 * is what the agent thought it was, that it is not on do_not_contact, and that
 * outbound is switched on at all.
 */
async function executeSendEmail(
  deps: ExecutorDeps,
  approval: StoredApproval,
  refuse: Refuse,
  done: Done,
): Promise<ExecutionOutcome> {
  const validated = validateSendEmail(approval.targetType, approval.targetId, approval.payload);
  if (!validated.ok) return refuse(validated.reason);
  const { targetType, targetId, subject, body, claimedTo } = validated.value;

  const control = await deps.outboundControl().catch(() => ({ outboundEnabled: false }));
  if (control.outboundEnabled !== true) {
    return refuse("Outbound is switched off (operator_system_control). Nothing was sent.");
  }

  const recipient = await deps.recipientFor(targetType, targetId);
  if (!recipient) return refuse(`The ${targetType} this proposal targets no longer exists.`);
  const to = recipient.email?.trim().toLowerCase() ?? "";
  if (!to) return refuse(`The ${targetType} has no email address on record.`);
  if (claimedTo && claimedTo !== to) {
    return refuse("The payload and the record disagree about the recipient's address.");
  }
  if (await deps.isSuppressed(to)) {
    return refuse("The address is on do_not_contact. A hit is final.");
  }

  let status: string;
  try {
    status = (await deps.sendEmail({ to, subject, text: body })).status;
  } catch {
    return refuse("The email was not sent: the mail provider could not be reached.");
  }
  if (status !== "sent") {
    // "unconfigured" and "error" both end here. The address is deliberately
    // not recorded: campaigns/mailer.ts sets the rule that errors never echo
    // personal data, and an execution_result is read by every admin.
    return refuse(`The email was not sent (${status}). Check the mail configuration.`);
  }
  return done();
}

/**
 * demo_site: publishes under a prospect's name, so it runs the same gates the
 * CRM's own demo button runs (buildDemoSiteGates), against facts read now.
 */
async function executeDemoSite(
  deps: ExecutorDeps,
  approval: StoredApproval,
  refuse: Refuse,
  done: Done,
): Promise<ExecutionOutcome> {
  const validated = validateDemoSite(approval.targetType, approval.targetId, approval.payload);
  if (!validated.ok) return refuse(validated.reason);
  const { targetType, targetId, businessName, address, vertical } = validated.value;

  const control = await deps.outboundControl().catch(() => ({
    outboundEnabled: false,
    reason: "control unreadable",
  }));
  const facts = await deps.demoSiteFacts(targetType, targetId);
  if (!facts.exists) return refuse(`The ${targetType} this proposal targets no longer exists.`);

  const gates = buildDemoSiteGates({
    outboundEnabled: control.outboundEnabled,
    outboundReason: control.reason,
    hasTarget: true,
    businessName,
    existingStatuses: facts.existingStatuses,
  });
  if (!isDemoSiteRequestable(gates)) {
    const failed = gates.find((g) => g.blocking && !g.pass);
    return refuse(failed ? `${failed.label}: ${failed.detail}` : "A demo-site gate refused.");
  }

  let demoSiteId: string;
  try {
    demoSiteId = await deps.requestDemoSite({
      companyId: targetType === "company" ? targetId : null,
      dealId: targetType === "deal" ? targetId : null,
      businessName,
      address,
      vertical,
    });
  } catch {
    return refuse("The demo was not queued. Approving it again will not help until you check why.");
  }
  return done({ demoSiteId });
}

/**
 * Phase 4 record writes: one validator and one CrmActions call each. The RPC
 * is the gate (crm_assign checks the column, lead_set_status checks the word,
 * client_create checks the deal), and its raise is reported the way deal_close
 * reports one: as "not carried out", with no message text, because the text
 * can name a client or a contact.
 */
async function executeRecordWrite(
  deps: ExecutorDeps,
  approval: StoredApproval,
  actionType: string,
  refuse: Refuse,
  done: Done,
): Promise<ExecutionOutcome> {
  const { targetType, targetId, payload } = approval;
  let run: () => Promise<Record<string, unknown>>;

  switch (actionType) {
    case "lead_set_status": {
      const v = validateLeadSetStatus(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => {
        await deps.setLeadStatus(v.value.leadId, v.value.status);
        return { status: v.value.status };
      };
      break;
    }
    case "crm_assign": {
      const v = validateCrmAssign(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => {
        await deps.assignRecord(v.value);
        return { column: v.value.column, userId: v.value.userId };
      };
      break;
    }
    case "deal_link_lead": {
      const v = validateDealLinkLead(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => {
        await deps.linkDealToLead(v.value.dealId, v.value.leadId);
        return { leadId: v.value.leadId };
      };
      break;
    }
    case "client_create": {
      const v = validateClientCreate(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => ({ clientId: await deps.createClient(v.value) });
      break;
    }
    case "project_create": {
      const v = validateProjectCreate(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => {
        await deps.createProject(v.value.clientId, v.value.name);
        return {};
      };
      break;
    }
    case "invoice_create": {
      const v = validateInvoiceCreate(targetType, targetId, payload);
      if (!v.ok) return refuse(v.reason);
      run = async () => {
        await deps.createInvoice(v.value);
        return { amountCents: v.value.amountCents, currency: v.value.currency };
      };
      break;
    }
    default:
      return refuse("The CRM cannot execute this kind of proposal.");
  }

  let extra: Record<string, unknown>;
  try {
    extra = await run();
  } catch {
    return refuse(
      `The ${actionType} was not carried out. Approving it again will not help until you check why.`,
    );
  }
  return done(extra);
}

/**
 * document_request_signature: the one phase-4 action that reaches a person,
 * so it runs the same outbound and do_not_contact checks as send_email, and
 * the same draft and stale-hash refusals as the deal page's Send button.
 */
async function executeSignatureRequest(
  deps: ExecutorDeps,
  approval: StoredApproval,
  refuse: Refuse,
  done: Done,
): Promise<ExecutionOutcome> {
  const validated = validateDocumentRequestSignature(
    approval.targetType,
    approval.targetId,
    approval.payload,
  );
  if (!validated.ok) return refuse(validated.reason);
  const { documentId, dealId, recipientName, recipientEmail } = validated.value;

  const control = await deps.outboundControl().catch(() => ({ outboundEnabled: false }));
  if (control.outboundEnabled !== true) {
    return refuse("Outbound is switched off (operator_system_control). Nothing was sent.");
  }
  if (await deps.isSuppressed(recipientEmail)) {
    return refuse("The address is on do_not_contact. A hit is final.");
  }

  const document = await deps.documentForSignature(dealId, documentId);
  if (!document) return refuse("The document is not on that deal, or no longer exists.");
  if (document.status !== "final") {
    return refuse("The document is still a draft. Finalise it in the CRM before sending it.");
  }

  let request: { id: string; signingToken: string } | null;
  try {
    request = await deps.requestSignature({
      documentId,
      bodyHash: document.bodyHash,
      recipientName,
      recipientEmail,
      sentBy: null,
    });
  } catch {
    return refuse("The signature request was not created: the CRM could not be reached.");
  }
  if (!request) {
    return refuse(
      "The document changed while this ran. Nothing was sent; look at it and propose again.",
    );
  }

  // From here the request row exists, so the outcome is "done" whatever the
  // mail provider says: the deal page shows the request and can resend it.
  let sent = false;
  try {
    ({ sent } = await deps.sendSignatureEmail({
      to: recipientEmail,
      recipientName,
      documentTitle: document.title,
      signingToken: request.signingToken,
    }));
  } catch {
    sent = false;
  }
  return done({ signatureRequestId: request.id, sent });
}
