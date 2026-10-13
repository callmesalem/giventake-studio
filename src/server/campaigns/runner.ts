import { evaluateGates } from "./policy.ts";
import { type CampaignStore, type Mailer, type DueSend } from "./types.ts";
import { unsubscribeToken } from "./tokens.ts";
import { renderTemplate } from "../../lib/campaign-template.ts";
import { renderBrandedEmail } from "../../lib/email-brand.ts";

export interface RunnerDeps {
  store: CampaignStore;
  mailer: Mailer;
  replyTo: string;
  unsubscribeBase: string;
  secret: string;
  limit?: number;
  leaseSeconds?: number;
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
        await deps.store.markStatus(
          row.enrollmentId,
          gate.status ?? "stopped",
          false,
          "gate_refused",
          {
            reason: gate.reason,
            step: row.stepOrder,
          },
        );
        continue;
      }

      // Claim the step before sending. The claim is a state machine, not a
      // boolean: a boolean could not say "this failed and may be retried", so
      // a failed step was re-claimed by claim_due every tick and skipped forever.
      const claim = await deps.store.claimStep(row.enrollmentId, row.stepOrder);

      if (claim === "already_sent") {
        // A previous tick sent this and died before advancing. Advance now
        // rather than re-sending, and leave a trace so it is not invisible.
        skipped++;
        await deps.store.markStatus(row.enrollmentId, "active", true, "recovered", {
          step: row.stepOrder,
        });
        continue;
      }
      if (claim === "in_flight") {
        skipped++;
        continue;
      }
      if (claim === "exhausted") {
        skipped++;
        await deps.store.markStatus(row.enrollmentId, "stopped", false, "send_failed", {
          step: row.stepOrder,
          reason: "max_attempts",
        });
        continue;
      }

      const token = await unsubscribeToken(row.enrollmentId, deps.secret);
      const url = `${deps.unsubscribeBase}/${token}`;
      // Merge fields were validated when the step was saved
      // (src/lib/campaign-template.ts); an unknown token left in an old row
      // passes through untouched rather than throwing inside the tick.
      const ctx = { name: row.name, company: row.company };
      const subject = renderTemplate(row.template.subject ?? "", ctx);
      // Branded like every other outbound email. The signed link is the
      // opt-out that works without a reply, so it stays in the body and in
      // the List-Unsubscribe header; "marketing" adds the reply-to-opt-out
      // line on top, which the inbound handler honours as a reply.
      const branded = renderBrandedEmail({
        subject,
        textBody: `${renderTemplate(row.template.text ?? "", ctx)}\n\n---\nUnsubscribe: ${url}`,
        kind: "marketing",
      });
      const outcome = await deps.mailer.send({
        to: row.email as string,
        subject,
        text: branded.text,
        html: branded.html,
        replyTo: deps.replyTo,
        headers: { "List-Unsubscribe": `<${url}>` },
      });

      if (outcome.status === "sent") {
        // Counted only after both writes land. Incrementing first meant a throw
        // in either await counted the row as sent AND again as skipped by the
        // catch below, so the two counters were not a partition of the batch.
        await deps.store.recordResult(
          row.enrollmentId,
          row.stepOrder,
          "sent",
          outcome.providerMessageId,
        );
        await deps.store.markStatus(row.enrollmentId, "active", true, "sent", {
          step: row.stepOrder,
          messageId: outcome.providerMessageId,
        });
        sent++;
        continue;
      }

      if (outcome.ambiguous) {
        // No response came back, so this may have been delivered. The house
        // rule is that ambiguity resolves to sent: advance rather than risk a
        // duplicate, and record that we are not certain.
        skipped++;
        await deps.store.recordResult(
          row.enrollmentId,
          row.stepOrder,
          "sent",
          undefined,
          outcome.error,
        );
        await deps.store.markStatus(row.enrollmentId, "active", true, "sent_ambiguous", {
          step: row.stepOrder,
          error: outcome.error,
        });
        continue;
      }

      skipped++;
      await deps.store.recordResult(
        row.enrollmentId,
        row.stepOrder,
        "failed",
        undefined,
        outcome.error,
      );
      if (outcome.permanent) {
        await deps.store.markStatus(row.enrollmentId, "stopped", false, "send_failed", {
          step: row.stepOrder,
          error: outcome.error,
          permanent: true,
        });
      }
      // A non-permanent failure is left for the next tick; campaign_claim_step
      // re-claims it until attempts are exhausted.
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
