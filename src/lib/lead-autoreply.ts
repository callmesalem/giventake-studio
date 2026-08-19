/**
 * Website lead welcome auto-reply — the "ack-enquiry" template, as decided
 * 2026-08-18 (see docs/operations/02-sales-pipeline/templates.md and
 * drafts/welcome-email-lead-form.md). This is the copy a new lead receives after
 * the contact form is submitted.
 *
 * Guardrails, from the agent operating charter (docs/operations/00-...charter.md):
 *   §5  Every automated outbound message carries the disclosure footer verbatim,
 *       sends AS THE STUDIO, and never as a named individual with a personal
 *       sign-off.
 *   §3  No specific price, timeline, or availability. The template speaks in
 *       generalities ("a clear proposal covering scope, timeline, and price")
 *       and commits to no number or date.
 *
 * This module is pure text + gating logic only. It sends nothing itself; the
 * send lives behind the dormancy gates in src/lib/intake.ts.
 */

/** Charter §5 disclosure footer, verbatim. Must be reproduced exactly. */
export const CHARTER_FOOTER = `—
This message was sent automatically by GivenTake Devs.
Reply and a person will read it.`;

/** Subject line for the ack-enquiry auto-reply. No price/timeline/availability. */
export const LEAD_AUTOREPLY_SUBJECT =
  "Welcome to GivenTake Devs, let's turn that into something built";

/**
 * First name from the free-text `name` field. Falls back to "there" so a
 * single-word or empty name never produces "Hi ,". The contact schema already
 * guarantees a non-empty name, so the fallback is belt-and-braces.
 */
export function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

/**
 * Render the ack-enquiry body with {{first_name}} substituted and the §5 footer
 * appended verbatim. Studio voice, no personal signature, no price/timeline/
 * availability commitment.
 */
export function renderLeadAutoReply(name: string): string {
  const firstName = firstNameOf(name);
  return `Hi ${firstName},

Thanks for reaching out to GivenTake Devs. We build software for businesses: websites, web apps, internal tools, automations, and AI, without you having to hire and manage a dev team.

Here is how we work:
- You tell us the problem or the idea.
- A short discovery call to understand your business and what "done" looks like.
- A clear proposal covering scope, timeline, and price, before any work begins.

Our model is simple: you bring the problem, we figure out the technology and build the solution. Think of us as your on-demand development team.

${CHARTER_FOOTER}`;
}

/**
 * Parse the LEAD_AUTOREPLY_ENABLED feature flag. OFF by default: only the
 * explicit truthy strings enable it. Anything else — including unset, empty,
 * "false", "0", or garbage — is disabled. This is the deliberate on/off switch
 * that keeps the auto-reply dormant until a human flips it.
 */
export function autoReplyFlagEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

/**
 * The single source of truth for whether a lead auto-reply may be sent. ALL of
 * the following must hold, or the send is skipped silently:
 *   1. flag        — LEAD_AUTOREPLY_ENABLED is explicitly on (default OFF)
 *   2. apiKey      — RESEND_API_KEY is set
 *   3. from        — INTAKE_FROM_EMAIL (a verified-domain sender) is set
 *   4. persisted   — the lead was actually recorded in the CRM (so we can trust
 *                    the suppression check below)
 *   5. !suppressed — the address is NOT on the do_not_contact list
 *
 * Suppression is authoritative: a do_not_contact lead never gets an auto-reply,
 * and if suppression status is unknown (CRM unconfigured / write failed →
 * persisted:false) we do NOT send.
 */
export function shouldSendAutoReply(opts: {
  flag: string | undefined;
  apiKey: string | undefined;
  from: string | undefined;
  persisted: boolean;
  suppressed: boolean;
}): boolean {
  return (
    autoReplyFlagEnabled(opts.flag) &&
    Boolean(opts.apiKey) &&
    Boolean(opts.from) &&
    opts.persisted &&
    !opts.suppressed
  );
}
