/**
 * Document creation, finalising, and the hash snapshot that makes a signature
 * evidence.
 *
 * The feature's central evidentiary claim is: editing a document after
 * sending it for signature cannot retroactively change what was signed. That
 * is only true if the document's hash is COPIED onto the signature row at
 * send time — see requestSignature below, and signatureIsStale, which is what
 * makes a later edit detectable instead of silently rewriting history.
 *
 * ClaimNimbus — the sibling product this design borrows from — declared a
 * document_hash column and was never observed writing it. A hash column that
 * is never populated is worse than no column, because it looks like evidence.
 * This module is the one place that copy happens.
 *
 * Pure except for the injected store, same pattern as sign-flow.ts: a narrow
 * local interface declared here rather than importing DocumentStore, so this
 * module is testable with a small fake instead of a full store.
 */
import { fillTemplate, finalizeDocument, hasUnresolvedReview } from "./templates.ts";
import type { MergeData } from "./templates.ts";
import { sha256Hex } from "./hash.ts";

/** Only the three DocumentStore methods this module calls, declared locally
 *  so a test can satisfy it with a small fake. The real DocumentStore
 *  (src/server/documents/store.ts) is a structural superset of this and
 *  needs no adapter. */
export interface IssueStore {
  createDocument(input: {
    dealId: string | null;
    projectId: string | null;
    stageNumber: number | null;
    docType: string;
    title: string;
    body: string;
    bodyHash: string;
    templateId: string | null;
    ownerId: string | null;
  }): Promise<string>;

  updateDocumentBody(input: {
    id: string;
    body: string;
    bodyHash: string;
    status: "draft" | "final";
  }): Promise<void>;

  createSignatureRequest(input: {
    documentId: string;
    recipientName: string;
    recipientEmail: string;
    documentHash: string;
    sentBy: string | null;
  }): Promise<{ id: string; signingToken: string }>;
}

export type DraftInput = {
  templateBody: string;
  data: MergeData;
  dealId: string | null;
  projectId: string | null;
  stageNumber: number | null;
  docType: string;
  title: string;
  templateId: string | null;
  ownerId: string | null;
};

export type DraftResult =
  | { ok: true; documentId: string; bodyHash: string; body: string }
  | { ok: false; reason: "unresolved-review" };

/**
 * Create a draft document from a template. Unfilled placeholders are ALLOWED
 * here — the operator fills the pricing table and MSA date by editing after
 * drafting — but an un-reviewed template must never reach a client even as a
 * draft, so that refusal happens BEFORE anything is written.
 *
 * Nothing may be stored when it refuses. A half-created document that exists
 * but must never be sent is a trap for whoever finds it later.
 */
export async function draftDocument(store: IssueStore, input: DraftInput): Promise<DraftResult> {
  if (hasUnresolvedReview(input.templateBody)) return { ok: false, reason: "unresolved-review" };

  const body = fillTemplate(input.templateBody, input.data);
  const bodyHash = await sha256Hex(body);

  const documentId = await store.createDocument({
    dealId: input.dealId,
    projectId: input.projectId,
    stageNumber: input.stageNumber,
    docType: input.docType,
    title: input.title,
    body,
    bodyHash,
    templateId: input.templateId,
    ownerId: input.ownerId,
  });

  return { ok: true, documentId, bodyHash, body };
}

export type FinaliseResult =
  | { ok: true; bodyHash: string }
  | { ok: false; reason: "unresolved-review" }
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] };

/**
 * Finalise an edited draft. Calls finalizeDocument with no merge data, so it
 * VALIDATES the body rather than filling it — the operator has already done
 * the filling by editing the draft directly.
 *
 * On refusal, nothing is written: a document that fails the review or
 * placeholder guard must not be silently marked final anyway.
 *
 * On success, the CHECKED body — the one finalizeDocument actually validated
 * — is what gets hashed and stored, not the caller's original `body`. Those
 * are the same string once finalizeDocument returns ok:true (no merge data
 * means nothing changes), but hashing the value the guard approved rather
 * than the value the caller supplied is the safer invariant to hold.
 */
export async function finaliseDraft(
  store: IssueStore,
  input: { documentId: string; body: string },
): Promise<FinaliseResult> {
  const result = finalizeDocument(input.body, {});
  if (!result.ok) return result;

  const bodyHash = await sha256Hex(result.body);

  await store.updateDocumentBody({
    id: input.documentId,
    body: result.body,
    bodyHash,
    status: "final",
  });

  return { ok: true, bodyHash };
}

/**
 * Send a finalised document out for signature. `bodyHash` is the document's
 * current hash, copied onto the signature row as `documentHash`. That copy is
 * the entire point of this module: it freezes what was actually shown to the
 * signer, independently of whatever the document row says later.
 */
export function requestSignature(
  store: IssueStore,
  input: {
    documentId: string;
    bodyHash: string;
    recipientName: string;
    recipientEmail: string;
    sentBy: string | null;
  },
): Promise<{ id: string; signingToken: string }> {
  return store.createSignatureRequest({
    documentId: input.documentId,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    documentHash: input.bodyHash,
    sentBy: input.sentBy,
  });
}

/**
 * True when the document has been edited since this signature was sent — its
 * current hash no longer matches the hash frozen onto the signature row at
 * send time. This is what makes that edit detectable rather than a silent
 * rewrite of what was signed.
 */
export function signatureIsStale(
  document: { bodyHash: string },
  signature: { documentHash: string },
): boolean {
  return document.bodyHash !== signature.documentHash;
}
