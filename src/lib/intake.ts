import { createServerFn } from "@tanstack/react-start";
import {
  contactSchema,
  dsarSchema,
  type ContactInput,
  type DsarInput,
  type IntakeResult,
} from "@/lib/intake-schema";

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
 *   INTAKE_TO_EMAIL  - destination. Defaults to hello@giventakedevs.com.
 *   INTAKE_FROM_EMAIL- verified sender on your domain.
 *
 * Adding a provider makes it a processor: add it to the privacy policy and to
 * docs/contracts/subprocessor-list.md BEFORE it goes live.
 */

const FALLBACK_TO = "hello@giventakedevs.com";
const PRIVACY_TO = "privacy@giventakedevs.com";

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
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
