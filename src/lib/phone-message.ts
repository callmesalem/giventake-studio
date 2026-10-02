import { renderBrandedEmail } from "./email-brand.ts";

/**
 * Phone-message intake: the voice agent calls the /api/phone-message webhook
 * with the fields it collected, and the route fans out to email + SMS.
 *
 * Everything in this module is pure (no I/O) so it can be unit tested.
 * The live sends (Resend, Twilio) live in src/routes/api.phone-message.ts.
 */

export interface PhoneMessage {
  callerName: string;
  /** Digits normalized to E.164, e.g. +14403347835 */
  callbackNumber: string;
  company: string | null;
  reason: string;
  preferredCallbackTime: string | null;
}

export const DEFAULT_MESSAGE_TO_EMAIL = "build@giventakedevs.com";
export const DEFAULT_MESSAGE_SMS_TO = "+14403347835";
export const TWILIO_FROM_NUMBER = "+12164285999";

type ParseOk = { ok: true; message: PhoneMessage };
type ParseErr = { ok: false; error: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Accept snake_case (ElevenLabs tool params) or camelCase. */
function pick(raw: Record<string, unknown>, snake: string, camel: string): string {
  return str(raw[snake]) || str(raw[camel]);
}

function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function parsePhoneMessagePayload(raw: unknown): ParseOk | ParseErr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "payload must be a JSON object" };
  }
  const r = raw as Record<string, unknown>;

  const callerName = pick(r, "caller_name", "callerName");
  if (!callerName) return { ok: false, error: "caller_name is required" };

  const callbackNumber = normalizePhoneNumber(pick(r, "callback_number", "callbackNumber"));
  if (!callbackNumber) return { ok: false, error: "callback_number is required (10-15 digits)" };

  const reason = pick(r, "reason", "reason");
  if (!reason) return { ok: false, error: "reason is required" };

  const company = pick(r, "company", "company") || null;
  const preferredCallbackTime =
    pick(r, "preferred_callback_time", "preferredCallbackTime") || null;

  return {
    ok: true,
    message: { callerName, callbackNumber, company, reason, preferredCallbackTime },
  };
}

export function formatMessageEmail(message: PhoneMessage): {
  subject: string;
  textBody: string;
} {
  const lines = [
    `Name: ${message.callerName}`,
    `Callback number: ${message.callbackNumber}`,
    ...(message.company ? [`Company: ${message.company}`] : []),
    `Reason for calling: ${message.reason}`,
    ...(message.preferredCallbackTime
      ? [`Preferred callback time: ${message.preferredCallbackTime}`]
      : []),
  ];
  return {
    subject: `New call message: ${message.callerName}`,
    textBody: ["You have a new phone message from the GivenTake Devs line.", "", ...lines].join(
      "\n",
    ),
  };
}

/**
 * One SMS segment (160 chars). Name, number, and the start of the reason —
 * the email carries the full detail.
 */
export function formatMessageSms(message: PhoneMessage): string {
  const head = `Call message from ${message.callerName} ${message.callbackNumber}: `;
  const room = 160 - head.length;
  const reason = room > 0 ? message.reason.slice(0, room) : "";
  return `${head}${reason}`.slice(0, 160);
}

export function renderMessageEmailHtml(message: PhoneMessage): string {
  const { subject, textBody } = formatMessageEmail(message);
  return renderBrandedEmail({ subject, textBody, kind: "transactional" }).html;
}
