/**
 * Whether a signature may proceed, and whether the submitted input constitutes
 * a signature. Pure and clock-injected so both are testable without a database.
 *
 * Every guard here is an allowlist. The previous version named the cases it
 * wanted to stop and permitted everything else, which meant status "expired",
 * status "revoked", expiresAt "never" and consent "false" all sailed through.
 */
import type { SignatureStatus } from "./types.ts";

export type SignGuard =
  | { ok: true }
  | {
      ok: false;
      reason: "expired" | "already-signed" | "declined" | "not-signable" | "invalid-expiry";
    };

/**
 * Signability, decided for every status by name. Keyed on SignatureStatus so
 * that adding a member to the union in types.ts is a COMPILE ERROR here — the
 * new state has to be classified deliberately rather than inheriting whatever
 * the fall-through happened to do.
 */
const SIGNABILITY: Record<SignatureStatus, boolean> = {
  pending: true,
  viewed: true,
  signed: false,
  declined: false,
  expired: false,
};

/** A Set, not the record itself: `SIGNABILITY["constructor"]` is truthy. */
const SIGNABLE: ReadonlySet<string> = new Set(
  Object.entries(SIGNABILITY)
    .filter(([, signable]) => signable)
    .map(([status]) => status),
);

export function canSign(
  request: { status: SignatureStatus; expiresAt: string },
  now: Date,
): SignGuard {
  // "already-signed" and "declined" stay distinct because the route shows the
  // signer a different page for each. Everything else is simply not signable.
  if (request.status === "signed") return { ok: false, reason: "already-signed" };
  if (request.status === "declined") return { ok: false, reason: "declined" };
  if (!SIGNABLE.has(request.status)) return { ok: false, reason: "not-signable" };

  // Parse once and insist it parsed. new Date("never").getTime() is NaN, and
  // every comparison against NaN is false, so an unparseable expiry used to
  // skip the expiry check altogether rather than fail it.
  //
  // The typeof guard is not redundant at runtime: this value comes back from
  // storage, and new Date(null) is the epoch rather than an error, which would
  // turn a missing expiry into the wrong refusal.
  const expiry =
    typeof request.expiresAt === "string" ? new Date(request.expiresAt).getTime() : Number.NaN;
  if (!Number.isFinite(expiry)) return { ok: false, reason: "invalid-expiry" };

  // <=, not <: a request whose expiry is exactly now has expired.
  if (expiry <= now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true };
}

export type InputGuard =
  | { ok: true; typedName: string }
  | { ok: false; reason: "no-consent" | "no-name" };

/**
 * Characters that occupy no space: format characters (zero-width space, ZWNJ,
 * ZWJ, the bidi marks, soft hyphen, the byte order mark) and controls. trim()
 * removes none of them, so a name made entirely of them used to be accepted
 * as a signature and stored as one.
 */
const INVISIBLE = /[\p{Cf}\p{Cc}]/gu;

/** A signature has to say something. U+2800 BRAILLE PATTERN BLANK is not a
 * format character and survives the strip above, so require real content. */
const HAS_CONTENT = /[\p{L}\p{N}]/u;

const MAX_NAME_LENGTH = 200;

/**
 * Consent is checked before the name. Under ESIGN/UETA what makes this a
 * signature is demonstrated intent to sign electronically, so an unticked box
 * is not a validation nit - it means no signature happened.
 *
 * Both fields arrive from an HTTP body, so both are unknown until proven
 * otherwise: consent must be the boolean true (the string "false" is truthy),
 * and typedName must actually be a string (a missing one used to throw a
 * TypeError out of .trim() instead of refusing).
 */
export function validateSignatureInput(input: {
  typedName: unknown;
  consent: unknown;
}): InputGuard {
  if (input.consent !== true) return { ok: false, reason: "no-consent" };
  if (typeof input.typedName !== "string") return { ok: false, reason: "no-name" };

  const typedName = input.typedName.replace(INVISIBLE, "").trim();
  if (!HAS_CONTENT.test(typedName)) return { ok: false, reason: "no-name" };
  if (typedName.length > MAX_NAME_LENGTH) return { ok: false, reason: "no-name" };

  return { ok: true, typedName };
}
