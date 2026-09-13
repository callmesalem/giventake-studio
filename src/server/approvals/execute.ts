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
  validateDealClose,
  validateDemoSite,
} from "../../lib/approval-actions.ts";

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
  /** Queue a demo site through the SAME gated path the deal page uses.
   *
   *  Returns the refusing gate rather than throwing, which is richer than
   *  advanceDealStage can manage: the demo gates are values, not exceptions, so
   *  the operator can be told the kill switch is off rather than only that it
   *  did not run. */
  requestDemoSite(input: {
    dealId: string;
    businessName: string;
    address: string | null;
    vertical: string | null;
  }): Promise<{ ok: true; demoSiteId: string } | { ok: false; refusedGate: string }>;
  markExecuted(id: string, result: Record<string, unknown>): Promise<void>;
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

  if (actionType === "demo_site") {
    const validated = validateDemoSite(approval.targetType, approval.targetId, approval.payload);
    if (!validated.ok) {
      const recorded = await record(deps, id, {
        ok: false,
        refused: "demo_site",
        detail: validated.reason,
      });
      return recorded
        ? { ok: false, reason: "refused", detail: validated.reason }
        : { ok: false, reason: "refused", detail: validated.reason, recorded: false };
    }

    let queued: Awaited<ReturnType<ExecutorDeps["requestDemoSite"]>>;
    try {
      queued = await deps.requestDemoSite(validated.value);
    } catch {
      // Same reasoning as deal_close's catch below: requestDemoSite talks to
      // Postgres to resolve the deal and to check the gates, and can throw on a
      // transport failure or an unresolvable deal, not only refuse. The thrown
      // message is deliberately not recorded - it can name a deal or a business
      // - and the wording below is deliberately NOT "gate refused", because
      // this branch cannot tell a refusal from a failure apart from one already
      // reported as a value.
      const detail =
        "The demo may not have been queued. Approving it again will not help until you check why.";
      const recorded = await record(deps, id, { ok: false, refused: "demo_site", detail });
      return recorded
        ? { ok: false, reason: "refused", detail }
        : { ok: false, reason: "refused", detail, recorded: false };
    }
    if (!queued.ok) {
      // Named, because "the kill switch is off" and "a demo is already building"
      // lead an operator to do completely different things.
      const detail = `The demo was not queued. Gate refused: ${queued.refusedGate}.`;
      const recorded = await record(deps, id, { ok: false, refused: "demo_site", detail });
      return recorded
        ? { ok: false, reason: "refused", detail }
        : { ok: false, reason: "refused", detail, recorded: false };
    }

    const recorded = await record(deps, id, {
      ok: true,
      action: "demo_site",
      demoSiteId: queued.demoSiteId,
    });
    return recorded
      ? { ok: true, action: "demo_site" }
      : { ok: true, action: "demo_site", recorded: false };
  }

  if (actionType !== "deal_close") {
    // send_email is a later phase. Recognised, deliberately not yet runnable,
    // and said so rather than failing silently.
    const detail = "This action is recognised but not implemented yet.";
    const recorded = await record(deps, id, { ok: false, refused: actionType, detail });
    return recorded
      ? { ok: false, reason: "refused", detail }
      : { ok: false, reason: "refused", detail, recorded: false };
  }

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
