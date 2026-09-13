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
import { isExecutableAction, validateDealClose } from "../../lib/approval-actions.ts";

/** The stage a deal_close proposal advances into. A literal rather than a
 *  lookup for the reason crm-guards.ts gives about CLOSE_STAGE_NAME: a gate
 *  whose lookup can fail has to decide whether to open, and there is no good
 *  answer. */
export const CLOSE_STAGE_FOR_APPROVAL = "Close";

export interface StoredApproval {
  id: string;
  actionType: string | null;
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
}

export type ExecutionOutcome =
  | { ok: true; action: string; recorded?: false }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-approved"; status: string }
  | { ok: false; reason: "not-executable"; actionType: string }
  | { ok: false; reason: "refused"; detail: string };

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
export async function executeApproval(
  deps: ExecutorDeps,
  id: string,
  actor: string,
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
    await record(deps, id, { ok: false, refused: "not-executable", detail });
    return { ok: false, reason: "not-executable", actionType };
  }

  if (actionType !== "deal_close") {
    // send_email and demo_site are later phases. Recognised, deliberately not
    // yet runnable, and said so rather than failing silently.
    const detail = "This action is recognised but not implemented yet.";
    await record(deps, id, { ok: false, refused: actionType, detail });
    return { ok: false, reason: "refused", detail };
  }

  const validated = validateDealClose(approval.targetType, approval.targetId, approval.payload);
  if (!validated.ok) {
    await record(deps, id, { ok: false, refused: "deal_close", detail: validated.reason });
    return { ok: false, reason: "refused", detail: validated.reason };
  }

  try {
    await deps.advanceDealStage({
      dealId: validated.value.dealId,
      toStage: CLOSE_STAGE_FOR_APPROVAL,
      note: validated.value.note,
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
    await record(deps, id, { ok: false, refused: "deal_close", detail });
    return { ok: false, reason: "refused", detail };
  }

  const recorded = await record(deps, id, { ok: true, action: "deal_close" });
  return recorded
    ? { ok: true, action: "deal_close" }
    : { ok: true, action: "deal_close", recorded: false };
}
