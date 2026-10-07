import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_MESSAGE_SMS_TO,
  DEFAULT_MESSAGE_TO_EMAIL,
  TWILIO_FROM_NUMBER,
  formatMessageEmail,
  formatMessageSms,
  parsePhoneMessagePayload,
  renderMessageEmailHtml,
} from "@/lib/phone-message.ts";

/**
 * POST /api/phone-message — the ElevenLabs voice agent calls this webhook the
 * moment it finishes taking a caller's message. The route fans the message out
 * to email (Resend) and SMS (Twilio) so Shukri gets both.
 *
 * Auth: the caller must send the shared secret in the x-phone-message-secret
 * header. Without it the request is refused before anything is read.
 *
 * Env: PHONE_MESSAGE_SECRET (required), RESEND_API_KEY + INTAKE_FROM_EMAIL
 * (required for email), TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (required for
 * SMS). Optional overrides: PHONE_MESSAGE_TO_EMAIL, PHONE_MESSAGE_SMS_TO,
 * TWILIO_PHONE_NUMBER.
 *
 * Never log the payload: it carries caller PII.
 */
export const Route = createFileRoute("/api/phone-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PHONE_MESSAGE_SECRET;
        if (!secret) return new Response("unconfigured", { status: 503 });
        if (!secretsEqual(request.headers.get("x-phone-message-secret") ?? "", secret)) {
          return new Response("unauthorized", { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "invalid JSON" }, 400);
        }

        const parsed = parsePhoneMessagePayload(raw);
        if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
        const message = parsed.message;

        const toEmail = process.env.PHONE_MESSAGE_TO_EMAIL ?? DEFAULT_MESSAGE_TO_EMAIL;
        const smsTo = process.env.PHONE_MESSAGE_SMS_TO ?? DEFAULT_MESSAGE_SMS_TO;
        const smsFrom = process.env.TWILIO_PHONE_NUMBER ?? TWILIO_FROM_NUMBER;

        const emailResult = await sendEmail({
          apiKey: process.env.RESEND_API_KEY,
          from: process.env.INTAKE_FROM_EMAIL,
          to: toEmail,
          subject: formatMessageEmail(message).subject,
          textBody: formatMessageEmail(message).textBody,
          html: renderMessageEmailHtml(message),
        });

        const smsResult = await sendSms({
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          from: smsFrom,
          to: smsTo,
          body: formatMessageSms(message),
        });

        if (emailResult === "sent" || smsResult === "sent") {
          return json({ ok: true, email: emailResult, sms: smsResult }, 200);
        }
        return json({ ok: false, email: emailResult, sms: smsResult }, 502);
      },
    },
  },
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Constant-time comparison so the secret cannot be probed byte by byte. */
function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(opts: {
  apiKey: string | undefined;
  from: string | undefined;
  to: string;
  subject: string;
  textBody: string;
  html: string;
}): Promise<"sent" | "failed" | "skipped"> {
  if (!opts.apiKey || !opts.from) return "skipped";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.textBody,
        html: opts.html,
      }),
    });
    // Never log the body: it echoes the message, which is personal data.
    return response.ok ? "sent" : "failed";
  } catch {
    // Ambiguous: the send may have reached Resend. Report failed; the caller
    // decides whether a retry is safe.
    return "failed";
  }
}

async function sendSms(opts: {
  accountSid: string | undefined;
  authToken: string | undefined;
  from: string;
  to: string;
  body: string;
}): Promise<"sent" | "failed" | "skipped"> {
  if (!opts.accountSid || !opts.authToken) return "skipped";
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${opts.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Basic auth per Twilio's API. The token never appears in a URL or log.
          Authorization: `Basic ${btoa(`${opts.accountSid}:${opts.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: opts.to, From: opts.from, Body: opts.body }),
      },
    );
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
