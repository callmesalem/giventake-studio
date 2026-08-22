/**
 * HMAC request signing for worker callbacks.
 *
 * The render worker holds no database credential; these signatures are the only
 * thing authenticating it to /api/video/*. Signing covers timestamp, nonce and
 * the canonical payload together, so none of the three can be swapped between
 * requests.
 *
 * Canonicalisation is delegated to operator-control/hash.ts, which sorts object
 * keys. Without that, a signature would break whenever JSON serialisation order
 * changed between the worker and the app.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalPayload } from "../operator-control/hash.ts";

export const SIGNATURE_HEADER = "x-gt-signature";
export const TIMESTAMP_HEADER = "x-gt-timestamp";
export const NONCE_HEADER = "x-gt-nonce";

/** Requests more than five minutes from server time are rejected. */
export const MAX_SKEW_MS = 5 * 60 * 1000;

export type VerifyFailure =
  "secret_missing" | "timestamp_invalid" | "timestamp_skew" | "signature_mismatch";

export interface VerifyInput {
  secret: string;
  timestamp: string;
  nonce: string;
  payload: unknown;
  signature: string;
  now?: number;
}

export function signPayload(
  secret: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
): string {
  if (!secret) throw new Error("signPayload requires a non-empty secret");
  // Normalise through JSON before canonicalising. The receiver only ever sees
  // JSON.parse(body), so signing the pre-serialised object would disagree with
  // it for any `undefined` value: a dropped key on one side, a present key on
  // the other. That would reject legitimate traffic as a forgery.
  const normalised = JSON.parse(JSON.stringify(payload ?? null)) as unknown;
  const base = `${timestamp}.${nonce}.${canonicalPayload(normalised)}`;
  return createHmac("sha256", secret).update(base).digest("hex");
}

export function verifySigned(
  input: VerifyInput,
): { ok: true } | { ok: false; reason: VerifyFailure } {
  // verifySigned must be total: its return type promises a result, and callers
  // treat a throw as a 500. A missing secret is a server misconfiguration, so it
  // is reported rather than thrown — videoEnv() is what refuses to start without
  // one.
  if (!input.secret) return { ok: false, reason: "secret_missing" };

  const sent = Number(input.timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: "timestamp_invalid" };

  const now = input.now ?? Date.now();
  if (Math.abs(now - sent) > MAX_SKEW_MS) return { ok: false, reason: "timestamp_skew" };

  const expected = signPayload(input.secret, input.timestamp, input.nonce, input.payload);

  // Compare as bytes of equal length; timingSafeEqual throws on length mismatch,
  // which a malformed signature would otherwise trigger.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature ?? "", "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
