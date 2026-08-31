import { evaluateGates } from "./policy.ts";
import { MAX_ATTEMPTS, type CampaignStore, type Clock, type Mailer, type DueSend } from "./types.ts";
import { unsubscribeToken } from "./tokens.ts";

export interface RunnerDeps {
  store: CampaignStore;
  mailer: Mailer;
  clock: Clock;
  replyTo: string;
  unsubscribeBase: string;
  secret: string;
  limit?: number;
  leaseSeconds?: number;
}

/**
 * The replacement is a function, not a string: a lead named `Marks & Co` or
 * anything containing `$&`, `$'` or `$1` would otherwise be reinterpreted as a
 * replacement pattern and mangle the greeting on a real prospect's email.
 */
function render(template: string, row: DueSend): string {
  const name = row.name ?? "there";
  return template.replace(/\{\{name\}\}/g, () => name);
}

/**
 * One tick. Claims due enrollments, re-checks the gates for each, sends, and
 * advances. A failure on one enrollment is contained so the rest of the batch
 * still runs — a single bad row must not stall the queue.
 */
export async function runSendTick(deps: RunnerDeps): Promise<{ sent: number; skipped: number }> {
  // Every message must carry a working unsubscribe link. Without a secret the
  // token cannot be verified when the link is followed, so the link is dead on
  // arrival. Refuse the whole tick rather than send unopt-outable mail.
  //
  // Before claimDue on purpose: a misconfigured tick must not claim rows and
  // leave them leased for no reason.
  if (!deps.secret) throw new Error("campaign runner requires a signing secret");

  const rows = await deps.store.claimDue(deps.limit ?? 25, deps.leaseSeconds ?? 300);
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      // Charter §3.8: re-checked here, never trusted from enrollment time. An
      // address can reach do_not_contact, or an approval can expire, mid-sequence.
      const gate = await evaluateGates(deps.store, { email: row.email, sop: row.sop });
      if (!gate.allow) {
        skipped++;
        await deps.store.markStatus(row.enrollmentId, gate.status ?? "stopped", false, "gate_refused", {
          reason: gate.reason,
          step: row.stepOrder,
        });
        continue;
      }

      // Claim the step before sending. A false return means this (enrollment,
      // step) was already recorded, so another tick has it — never send again.
      const claimed = await deps.store.recordSend(row.enrollmentId, row.stepOrder, "sending");
      if (!claimed) {
        skipped++;
        continue;
      }

      const token = await unsubscribeToken(row.enrollmentId, deps.secret);
      const url = `${deps.unsubscribeBase}/${token}`;
      const outcome = await deps.mailer.send({
        to: row.email as string,
        subject: render(row.template.subject ?? "", row),
        text: `${render(row.template.text ?? "", row)}\n\n---\nUnsubscribe: ${url}`,
        replyTo: deps.replyTo,
        headers: { "List-Unsubscribe": `<${url}>` },
      });

      if (outcome.status === "sent") {
        sent++;
        await deps.store.recordSend(row.enrollmentId, row.stepOrder, "sent", outcome.providerMessageId);
        await deps.store.markStatus(row.enrollmentId, "active", true, "sent", {
          step: row.stepOrder,
          messageId: outcome.providerMessageId,
        });
        continue;
      }

      skipped++;
      await deps.store.recordSend(row.enrollmentId, row.stepOrder, "failed", undefined, outcome.error);
      const attempts = await deps.store.attemptsFor(row.enrollmentId, row.stepOrder);
      if (outcome.permanent || attempts >= MAX_ATTEMPTS) {
        await deps.store.markStatus(row.enrollmentId, "stopped", false, "send_failed", {
          step: row.stepOrder,
          error: outcome.error,
          permanent: Boolean(outcome.permanent),
        });
      }
    } catch (error) {
      // Contained per enrollment so one bad row cannot abort the batch. The
      // enrollment id is an internal uuid, not personal data, and without it a
      // stuck enrollment is undiagnosable; the message itself is never logged
      // by the mailer, so nothing here echoes the email body.
      skipped++;
      console.error(
        "campaign tick error",
        row.enrollmentId,
        row.stepOrder,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return { sent, skipped };
}
