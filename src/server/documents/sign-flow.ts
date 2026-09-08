/**
 * Decisions for the public signing route, pulled out of the route the same way
 * supabase/functions/_shared/channel-auth.ts pulled the auth decision out of
 * giventake-mcp: the edge/route handler is not comfortably testable in this
 * repo, and the decision inside it is the part worth testing, so it has to be
 * reachable without a live server.
 *
 * The property this module exists to guarantee: viewing a document must never
 * sign it. Mail clients and security scanners prefetch links - a prefetched
 * unsubscribe was already judged unacceptable when the campaign engine
 * shipped, and a prefetched signature is categorically worse. viewSigningRequest
 * never calls markSigned; see tests/documents-sign-flow.test.mjs.
 *
 * Pure except for the injected store: `now` is passed in rather than read from
 * `new Date()`, and the store is a parameter, not an import, so both functions
 * run the same in a test as they will in the route.
 */
import { canSign, validateSignatureInput } from "./signing.ts";
import type { SignatureRow, SigningView } from "./types.ts";

export const CONSENT_TEXT =
  "I intend to sign this document electronically, and I agree that my typed name " +
  "is my signature and has the same effect as a handwritten one.";

/**
 * Only the three DocumentStore methods this module calls, declared locally so
 * a test can satisfy it with a small fake instead of a full store. The real
 * DocumentStore (src/server/documents/store.ts) is a structural superset of
 * this and needs no adapter.
 */
export interface SignFlowStore {
  findByToken(token: string): Promise<(SignatureRow & { body: string; title: string }) | null>;
  markViewed(id: string): Promise<void>;
  markSigned(input: {
    id: string;
    signedName: string;
    consentText: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<boolean>;
}

export type ViewSigningResult =
  | { ok: true; view: SigningView }
  | {
      ok: false;
      reason: "not-found" | "unavailable" | "already-signed";
      signedAt?: string | null;
    };

/**
 * Render the signer's copy of the document. Marks the request viewed, but -
 * this is the guarantee the whole module exists for - never signs it.
 *
 * `already-signed` is split out from the rest of canSign's refusals only here,
 * because the route shows a signer who already signed a different page (their
 * completed signature, with signedAt) than one whose link is merely expired,
 * declined, or otherwise unavailable.
 */
export async function viewSigningRequest(
  store: SignFlowStore,
  token: string,
  now: Date,
): Promise<ViewSigningResult> {
  const row = await store.findByToken(token);
  if (!row) return { ok: false, reason: "not-found" };

  const guard = canSign(row, now);
  if (!guard.ok) {
    if (guard.reason === "already-signed") {
      return { ok: false, reason: "already-signed", signedAt: row.signedAt };
    }
    return { ok: false, reason: "unavailable" };
  }

  // Swallowed deliberately: a failed view-marking must not stop someone from
  // reading their own contract. Losing the "viewed" timestamp is a smaller
  // problem than an unreadable signing page.
  try {
    await store.markViewed(row.id);
  } catch {
    // intentionally ignored - see comment above
  }

  return {
    ok: true,
    view: {
      title: row.title,
      body: row.body,
      recipientName: row.recipientName,
      status: row.status,
      // canSign above already required this request to be unexpired to reach
      // here, so this is always false for a view this function returns.
      expired: false,
    },
  };
}

export type PerformSignatureResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "unavailable" | "invalid-input" | "already-signed" };

/**
 * Record a signature. Unlike viewSigningRequest, canSign's "already-signed"
 * refusal here is NOT distinguished from any other reason it fails - it reads
 * "unavailable" like "expired" or "declined" would. The "already-signed"
 * result this function can return comes only from markSigned resolving false:
 * that is the replay guard, catching a second POST that raced past the
 * canSign check while a first one was already being written. A resubmitted
 * request must not be told it recorded a signature the database refused.
 */
export async function performSignature(
  store: SignFlowStore,
  token: string,
  input: { typedName: unknown; consent: unknown },
  now: Date,
  meta: { ip: string | null; userAgent: string | null },
): Promise<PerformSignatureResult> {
  const row = await store.findByToken(token);
  if (!row) return { ok: false, reason: "not-found" };

  if (!canSign(row, now).ok) return { ok: false, reason: "unavailable" };

  const inputGuard = validateSignatureInput(input);
  if (!inputGuard.ok) return { ok: false, reason: "invalid-input" };

  const applied = await store.markSigned({
    id: row.id,
    signedName: inputGuard.typedName,
    consentText: CONSENT_TEXT,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (!applied) return { ok: false, reason: "already-signed" };

  return { ok: true };
}
