import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import type { LeadEventV1 } from "@giventake/growth-os-contract";
import {
  contactSchema,
  dsarSchema,
  type ContactInput,
  type DsarInput,
  type IntakeResult,
} from "@/lib/intake-schema";
import { buildGrowthOsLeadEvent, deliverLeadToGrowthOs } from "@/lib/growth-os-ingest";

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
      return { status: "error", message: "We couldn't send that. Please email us directly." };
    }
    return { status: "sent" };
  } catch {
    return { status: "error", message: "We couldn't send that. Please email us directly." };
  }
}

type GrowthDeliveryResult = "accepted" | "duplicate" | "unconfigured";
type DeliveryDestination = "email" | "growth_os";

type ContactDeliveryDependencies = {
  requestId: () => string;
  buildEvent: (input: ContactInput) => LeadEventV1;
  sendEmail: (input: ContactInput) => Promise<IntakeResult>;
  sendGrowthOs: (event: LeadEventV1) => Promise<GrowthDeliveryResult>;
  logStatus: (destination: DeliveryDestination, status: string, requestId: string) => void;
};

export async function deliverContactWith(
  input: ContactInput,
  dependencies: ContactDeliveryDependencies,
): Promise<IntakeResult> {
  const requestId = dependencies.requestId();
  const event = dependencies.buildEvent(input);
  const [email, growthOs] = await Promise.allSettled([
    dependencies.sendEmail(input),
    dependencies.sendGrowthOs(event),
  ]);

  if (email.status === "rejected") {
    dependencies.logStatus("email", "failed", requestId);
  } else if (email.value.status === "error") {
    dependencies.logStatus("email", "error", requestId);
  }
  if (growthOs.status === "rejected") {
    dependencies.logStatus("growth_os", "failed", requestId);
  }

  const emailSent = email.status === "fulfilled" && email.value.status === "sent";
  const growthSent =
    growthOs.status === "fulfilled" &&
    (growthOs.value === "accepted" || growthOs.value === "duplicate");
  if (emailSent || growthSent) return { status: "sent" };

  const bothUnconfigured =
    email.status === "fulfilled" &&
    email.value.status === "unconfigured" &&
    growthOs.status === "fulfilled" &&
    growthOs.value === "unconfigured";
  if (bothUnconfigured) return { status: "unconfigured" };
  return { status: "error", message: "We couldn't send that. Please email us directly." };
}

export function formatContactEmail(input: ContactInput) {
  let referrerDomain: string | null = null;
  try {
    referrerDomain = input.referrer ? new URL(input.referrer).hostname : null;
  } catch {
    referrerDomain = null;
  }
  const subject = `Project brief · ${input.name}${input.company ? ` · ${input.company}` : ""}`;
  const text = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.company ? `Company: ${input.company}` : null,
    `Budget: ${input.budget}`,
    `Timeline: ${input.timeline}`,
    `Source: ${input.source}`,
    input.source_detail ? `Source detail: ${input.source_detail}` : null,
    input.utm_source ? `UTM source: ${input.utm_source}` : null,
    input.utm_medium ? `UTM medium: ${input.utm_medium}` : null,
    input.utm_campaign ? `UTM campaign: ${input.utm_campaign}` : null,
    input.utm_content ? `UTM content: ${input.utm_content}` : null,
    input.utm_term ? `UTM term: ${input.utm_term}` : null,
    referrerDomain ? `Referrer domain: ${referrerDomain}` : null,
    "",
    "Project:",
    input.description,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text };
}

function logDeliveryStatus(destination: DeliveryDestination, status: string, requestId: string) {
  console.error(`Intake ${destination} status=${status} request_id=${requestId}`);
}

export const submitContact = createServerFn({ method: "POST" })
  .validator((data: ContactInput) => contactSchema.parse(data))
  .handler(async ({ data }): Promise<IntakeResult> => {
    return deliverContactWith(data, {
      requestId: randomUUID,
      buildEvent: buildGrowthOsLeadEvent,
      async sendEmail(input) {
        const { subject, text } = formatContactEmail(input);
        return sendMail(env("INTAKE_TO_EMAIL") ?? FALLBACK_TO, subject, text, input.email);
      },
      sendGrowthOs: deliverLeadToGrowthOs,
      logStatus: logDeliveryStatus,
    });
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

    const requestId = randomUUID();
    const result = await sendMail(env("INTAKE_TO_EMAIL") ?? PRIVACY_TO, subject, text, data.email);
    if (result.status === "error") logDeliveryStatus("email", "error", requestId);
    return result;
  });
