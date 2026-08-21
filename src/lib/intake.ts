import { createServerFn } from "@tanstack/react-start";
import {
  contactSchema,
  dsarSchema,
  type ContactInput,
  type DsarInput,
  type IntakeResult,
} from "@/lib/intake-schema";
import {
  LEAD_AUTOREPLY_SUBJECT,
  renderLeadAutoReply,
  shouldSendAutoReply,
} from "@/lib/lead-autoreply";

/**
 * Server-side intake for the contact and data-request forms.
 *
 * Both forms previously handed off to `window.location.href = "mailto:..."`,
 * which silently loses every submission from a device with no configured mail
 * client — most mobile and webmail users. For the DSAR form that was a
 * compliance gap, not just a lost lead, because the privacy policy promises a
 * 30-day response to requests that were never arriving.
 *
 * Deliberately degrades rather than breaks: with no mail provider configured
 * these return `unconfigured` and the form falls back to the old mailto:
 * behaviour. That keeps the site deployable before the provider is set up, and
 * means a provider outage downgrades the experience instead of dropping the
 * enquiry on the floor.
 *
 * Configure with (see docs/business/06-launch-checklist.md):
 *   RESEND_API_KEY   - provider key. Absent => unconfigured => mailto fallback.
 *   INTAKE_TO_EMAIL  - destination. Defaults to build@giventakedevs.com.
 *   INTAKE_FROM_EMAIL- verified sender on your domain.
 *
 * The website lead welcome auto-reply is built here but ships DORMANT. It sends
 * nothing until the RESEND_API_KEY + INTAKE_FROM_EMAIL above are set AND the
 * explicit LEAD_AUTOREPLY_ENABLED flag is turned on (defaults OFF). See
 * `sendLeadAutoReply` below.
 *
 * Adding a provider makes it a processor: add it to the privacy policy and to
 * docs/contracts/subprocessor-list.md BEFORE it goes live.
 */

const FALLBACK_TO = "build@giventakedevs.com";
const PRIVACY_TO = "privacy@giventakedevs.com";

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Best-effort CRM persistence for a contact-form submission.
 *
 * Writes the enquiry to Supabase (`leads` + `touchpoint` + `agent_log`) via the
 * server-only capture RPC. This is track-only: it never sends anything and never
 * starts an operator run. Sending stays hard-disabled at every layer.
 *
 * Degrades exactly like the mail path: with no `SUPABASE_URL` /
 * `SUPABASE_SERVICE_ROLE_KEY` configured it does nothing, and any write failure
 * is swallowed (never logged with PII) so a CRM outage can never drop or block
 * an enquiry — the mail/mailto path still runs.
 *
 * The store is imported dynamically so this server-only module (service-role
 * key, PostgREST client) is never pulled into the browser bundle.
 *
 * Returns the lead's suppression status so the caller can honour do_not_contact
 * before any auto-reply. `null` means the lead was NOT recorded (CRM
 * unconfigured or the write failed) — in that case suppression is unknown and
 * the caller must not send.
 */
async function persistLead(data: ContactInput): Promise<{ suppressed: boolean } | null> {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  try {
    const { SupabaseOperatorStore } = await import("@/server/operator-control/supabase-store");
    const store = new SupabaseOperatorStore({ url, serviceRoleKey });
    const result = await store.captureWebsiteLead({
      email: data.email,
      name: data.name,
      company: data.company,
      description: data.description,
      budget: data.budget,
      timeline: data.timeline,
      source: data.source,
      source_detail: data.source_detail,
      attribution: {
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        utm_content: data.utm_content,
        utm_term: data.utm_term,
        referrer: data.referrer,
      },
    });
    return { suppressed: Boolean(result.suppressed) };
  } catch (error) {
    // Never drop or block the enquiry over a CRM write; never log the body (PII).
    console.error("Lead persistence failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

/**
 * Website lead welcome auto-reply — the "ack-enquiry" email, DORMANT by default.
 *
 * Renders the ack-enquiry template (src/lib/lead-autoreply.ts) and sends it to
 * the lead AS THE STUDIO via the existing Resend `sendMail` path. Charter §5
 * footer is baked into the template; no personal signature; no price/timeline/
 * availability.
 *
 * SAFE BY DEFAULT — the send is impossible until deliberately enabled. It is
 * gated behind ALL of (see `shouldSendAutoReply`):
 *   - LEAD_AUTOREPLY_ENABLED explicitly on  (defaults OFF — the deliberate switch)
 *   - RESEND_API_KEY set
 *   - INTAKE_FROM_EMAIL set (verified-domain sender)
 *   - the lead was persisted AND is not on do_not_contact (suppression honoured;
 *     unknown suppression => no send)
 * If any condition is unmet the send is skipped silently — no throw, no PII log —
 * exactly like the existing dormant mail pattern.
 *
 * Best-effort and non-blocking: it never changes the human-notification result
 * the form UX depends on, and any failure is swallowed without logging the body.
 */
async function sendLeadAutoReply(
  data: ContactInput,
  persist: { suppressed: boolean } | null,
): Promise<void> {
  if (
    !shouldSendAutoReply({
      flag: process.env.LEAD_AUTOREPLY_ENABLED,
      apiKey: env("RESEND_API_KEY"),
      from: env("INTAKE_FROM_EMAIL"),
      persisted: persist !== null,
      suppressed: persist?.suppressed ?? false,
    })
  ) {
    return;
  }

  try {
    // Reply-to is the human inbox so "reply and a person will read it" is true.
    await sendMail(
      data.email,
      LEAD_AUTOREPLY_SUBJECT,
      renderLeadAutoReply(data.name),
      env("INTAKE_TO_EMAIL") ?? FALLBACK_TO,
    );
  } catch (error) {
    // Never block or surface an auto-reply failure; never log the body (PII).
    console.error("Lead auto-reply failed", error instanceof Error ? error.message : "unknown");
  }
}

async function sendMail(
  to: string,
  subject: string,
  text: string,
  replyTo: string,
): Promise<IntakeResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("INTAKE_FROM_EMAIL");
  if (!apiKey || !from) return { status: "unconfigured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
    });

    if (!response.ok) {
      // Never log the body — it echoes the submission, which is personal data.
      console.error(`Intake mail failed: ${response.status}`);
      return { status: "error", message: "We couldn't send that. Please email us directly." };
    }
    return { status: "sent" };
  } catch (error) {
    console.error("Intake mail threw", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: "We couldn't send that. Please email us directly." };
  }
}

export const submitContact = createServerFn({ method: "POST" })
  .validator((data: ContactInput) => contactSchema.parse(data))
  .handler(async ({ data }): Promise<IntakeResult> => {
    const subject = `Project brief · ${data.name}${data.company ? ` · ${data.company}` : ""}`;
    const text = [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      data.company ? `Company: ${data.company}` : null,
      `Budget: ${data.budget}`,
      `Timeline: ${data.timeline}`,
      `Source: ${data.source}`,
      data.source_detail ? `Source detail: ${data.source_detail}` : null,
      data.utm_source ? `UTM source: ${data.utm_source}` : null,
      data.utm_medium ? `UTM medium: ${data.utm_medium}` : null,
      data.utm_campaign ? `UTM campaign: ${data.utm_campaign}` : null,
      data.utm_content ? `UTM content: ${data.utm_content}` : null,
      data.utm_term ? `UTM term: ${data.utm_term}` : null,
      data.referrer ? `Referrer: ${data.referrer}` : null,
      "",
      "Project:",
      data.description,
    ]
      .filter(Boolean)
      .join("\n");

    // Track the lead in the CRM (best-effort, no send).
    const persist = await persistLead(data);

    // Welcome auto-reply to the lead — dormant unless deliberately enabled; a
    // no-op (no send attempted) by default. Never blocks the human notification.
    await sendLeadAutoReply(data, persist);

    // Notify the human.
    return sendMail(env("INTAKE_TO_EMAIL") ?? FALLBACK_TO, subject, text, data.email);
  });

export const submitDsar = createServerFn({ method: "POST" })
  .validator((data: DsarInput) => dsarSchema.parse(data))
  .handler(async ({ data }): Promise<IntakeResult> => {
    const subject = `Data rights request · ${data.requestType} · ${data.name}`;
    const text = [
      `Request type: ${data.requestType}`,
      `Name: ${data.name}`,
      `Email on file: ${data.email}`,
      data.residency ? `Residency / jurisdiction: ${data.residency}` : null,
      "",
      "Details:",
      data.details,
      data.identity ? `\nIdentity verification notes:\n${data.identity}` : null,
      "",
      "Declaration: the requester confirmed the information is accurate and that they",
      "are the data subject or an authorized agent.",
      "",
      "Received via the website data-request form.",
      "Statutory response window: 30 days (see /privacy section 7).",
    ]
      .filter(Boolean)
      .join("\n");

    return sendMail(env("INTAKE_TO_EMAIL") ?? PRIVACY_TO, subject, text, data.email);
  });
