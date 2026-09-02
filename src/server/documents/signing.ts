/**
 * Whether a signature may proceed, and whether the submitted input constitutes
 * a signature. Pure and clock-injected so both are testable without a database.
 */
export type SignGuard =
  | { ok: true }
  | { ok: false; reason: "expired" | "already-signed" | "declined" };

export function canSign(
  request: { status: string; expiresAt: string },
  now: Date,
): SignGuard {
  if (request.status === "signed") return { ok: false, reason: "already-signed" };
  if (request.status === "declined") return { ok: false, reason: "declined" };
  if (new Date(request.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export type InputGuard =
  | { ok: true; typedName: string }
  | { ok: false; reason: "no-consent" | "no-name" };

/**
 * Consent is checked before the name. Under ESIGN/UETA what makes this a
 * signature is demonstrated intent to sign electronically, so an unticked box
 * is not a validation nit - it means no signature happened.
 */
export function validateSignatureInput(input: {
  typedName: string;
  consent: boolean;
}): InputGuard {
  if (!input.consent) return { ok: false, reason: "no-consent" };
  const typedName = input.typedName.trim();
  if (!typedName) return { ok: false, reason: "no-name" };
  return { ok: true, typedName };
}
