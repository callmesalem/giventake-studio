/**
 * The deal page's document actions — TanStack Start server functions.
 *
 * This lives in src/lib/ beside crm-data.ts, and NOT in src/server/documents/
 * where the rest of this feature lives, because it has to. The build denies any
 * import of any path under src/server/ from the client environment
 * (@tanstack/start-plugin-core's import-protection plugin), and a server
 * function's declaration is imported by the component that calls it — that is
 * how the RPC bridge is wired. src/server/documents/* stays server-only and is
 * reached from the handlers below by dynamic import, exactly the way
 * crm-data.ts reaches crm-auth.server and CrmRead.
 *
 * So: same shape as crm-data.ts throughout. Every function gates on a valid CRM
 * session first, then reaches the database with the service-role key through a
 * narrow definer RPC. The key never reaches the browser, and neither does a
 * signing token.
 *
 * The workflow is DRAFT → EDIT → FINALISE → SEND, and it is four steps because
 * generation genuinely cannot produce a sendable document in one shot.
 * docs/contracts/sow-template.md carries merge fields the deal does not know:
 * the pricing table's `$[X]` repeats per line item (one value would price every
 * row identically) and `[MSA DATE]` refers to a Master Services Agreement
 * signed outside this system. So drafting fills what it can and LEAVES the rest
 * visible, the operator completes them by editing, and only finaliseDocument —
 * which refuses on any remaining placeholder, naming it — marks the result
 * final.
 *
 * Note what generateSowDraft does TODAY: docs/contracts/sow-template.md still
 * carries the banner "DRAFT — NOT FOR USE WITHOUT ATTORNEY REVIEW", so
 * draftDocument refuses it and this returns
 * { ok: false, reason: "unresolved-review" } having written nothing. That is
 * the feature working. The refusal is RETURNED rather than thrown precisely so
 * the deal page can explain it in words instead of showing an error nobody can
 * act on.
 */
import { createServerFn } from "@tanstack/react-start";
import sowTemplate from "../../docs/contracts/sow-template.md?raw";

/** A document or deal id is a uuid; anything else is a client bug or a probe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID.test(id)) throw new Response(`${field} is not valid`, { status: 400 });
  return id;
}

function requireText(value: unknown, field: string, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new Response(`${field} is required`, { status: 400 });
  if (s.length > max) throw new Response(`${field} is too long`, { status: 400 });
  return s;
}

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

/**
 * Session + a document store, plus proof that this operator may see this deal.
 *
 * The deal lookup is not decoration. crm-data.ts's reader() scopes reads to the
 * signed-in user — an admin sees everything, a member sees only what they own
 * or are assigned — and a member asking for someone else's deal gets a 404
 * before any document is touched. Without this, a document id would be a way
 * around that scoping, because the documents RPCs are keyed by document id and
 * know nothing about who is asking.
 */
async function forDeal(dealId: string) {
  const { requireCrmSession } = await import("./crm-auth.server");
  const session = await requireCrmSession();

  const { CrmRead } = await import("@/server/crm/read");
  const read = new CrmRead({
    ...config(),
    actor: { id: session.userId, isAdmin: session.role === "admin" },
  });
  const deal = await read.getById<Record<string, unknown>>("deals", dealId, "id,name");
  if (!deal) throw new Response("Not found", { status: 404 });

  const { createSupabaseDocumentStore } = await import("@/server/documents/store");
  return { session, store: createSupabaseDocumentStore(config()) };
}

type DocumentStoreFor = Awaited<ReturnType<typeof forDeal>>["store"];

/**
 * Resolve one document on a deal the caller may see, or refuse.
 *
 * Reading the whole list to find one document is a round trip a `document_get`
 * RPC would save, and it is the right trade anyway: the write paths below need
 * the document's CURRENT status and body_hash to decide whether the action is
 * even legal, and reading them here means those decisions are made against the
 * database rather than against whatever the browser believed when the page was
 * rendered.
 */
async function documentOnDeal(store: DocumentStoreFor, dealId: string, documentId: string) {
  const documents = await store.listDealDocuments(dealId);
  const document = documents.find((d) => d.id === documentId);
  if (!document) throw new Response("Not found", { status: 404 });
  return document;
}

/* ── generate ───────────────────────────────────────────────────────────── */

export type GenerateSowResult =
  | { ok: true; documentId: string }
  /** docs/contracts/sow-template.md has not been through attorney review. The
   *  UI must explain this, not retry it: the fix is a lawyer, not a button. */
  | { ok: false; reason: "unresolved-review" };

export const generateSowDraft = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId, "Deal"),
    clientLegalName: requireText(d?.clientLegalName, "Client legal name", 200),
    projectName: requireText(d?.projectName, "Project name", 200),
  }))
  .handler(async ({ data }): Promise<GenerateSowResult> => {
    const { session, store } = await forDeal(data.dealId);
    const { draftDocument } = await import("@/server/documents/issue");

    // Only what the deal actually knows. [GivenTake Devs LLC] is deliberately
    // NOT filled: templates.ts treats it as a merge field because
    // msa-template.md says the registered entity name must be confirmed, and
    // filling it from here would assert a confirmation nobody made. The pricing
    // table and [MSA DATE] are left for the stated reason — the operator
    // supplies them by editing, and finaliseDocument refuses until they have.
    const result = await draftDocument(store, {
      templateBody: sowTemplate,
      data: {
        "CLIENT LEGAL NAME": data.clientLegalName,
        "PROJECT NAME": data.projectName,
        DATE: new Date().toISOString().slice(0, 10),
      },
      dealId: data.dealId,
      projectId: null,
      stageNumber: 3,
      docType: "sow",
      title: `Statement of Work — ${data.projectName}`,
      templateId: "sow",
      ownerId: session.userId,
    });

    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, documentId: result.documentId };
  });

/* ── finalise ───────────────────────────────────────────────────────────── */

export type FinaliseDocumentResult =
  | { ok: true }
  | { ok: false; reason: "unresolved-review" }
  /** Named, so the operator learns exactly which blanks are still open rather
   *  than being told the document is "invalid" and left to hunt for them. */
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] }
  | { ok: false; reason: "not-a-draft" };

export const finaliseDocument = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId, "Deal"),
    documentId: requireUuid(d?.documentId, "Document"),
    body: requireText(d?.body, "Document body", 200_000),
  }))
  .handler(async ({ data }): Promise<FinaliseDocumentResult> => {
    const { store } = await forDeal(data.dealId);
    const document = await documentOnDeal(store, data.dealId, data.documentId);

    // Finalising something already final would re-hash it and orphan every
    // signature already sent against it — all of them would start reporting
    // stale, against a document nobody actually edited. Only a draft finalises.
    if (document.status !== "draft") return { ok: false, reason: "not-a-draft" };

    const { finaliseDraft } = await import("@/server/documents/issue");
    const result = await finaliseDraft(store, { documentId: data.documentId, body: data.body });
    if (result.ok) return { ok: true };
    return result.reason === "unfilled-placeholders"
      ? { ok: false, reason: result.reason, placeholders: result.placeholders }
      : { ok: false, reason: result.reason };
  });

/* ── send ───────────────────────────────────────────────────────────────── */

export type SendForSignatureResult =
  /** `sent` is whether the MAIL went out. The signature request exists either
   *  way, so a false here means "resend that link", not "start again". */
  | { ok: true; sent: boolean }
  | { ok: false; reason: "not-configured" }
  | { ok: false; reason: "not-final" }
  | { ok: false; reason: "hash-mismatch" };

/**
 * Where the signing link points.
 *
 * There is no existing env var for the site origin, and deriving one from the
 * request would be wrong here: this mail is read days later, on another
 * machine, by someone who never made a request to this Worker. A relative URL
 * in it is not a degraded experience, it is a dead link inside a contract, so
 * an unset value REFUSES THE SEND rather than guessing an origin or shipping a
 * path. Declared in wrangler.jsonc's vars block, where plain vars have to live
 * or a deploy drops them.
 */
function siteBaseUrl(): string | null {
  const raw = process.env.SITE_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export const sendForSignature = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId, "Deal"),
    documentId: requireUuid(d?.documentId, "Document"),
    bodyHash: requireText(d?.bodyHash, "Document hash", 200),
    recipientName: requireText(d?.recipientName, "Recipient name", 200),
    recipientEmail: requireText(d?.recipientEmail, "Recipient email", 255),
  }))
  .handler(async ({ data }): Promise<SendForSignatureResult> => {
    // Asked before anything is written. A signature request whose email could
    // never carry a working link is worse than no request: it sits in the
    // record looking sent.
    const base = siteBaseUrl();
    if (!base) return { ok: false, reason: "not-configured" };

    const { session, store } = await forDeal(data.dealId);
    const document = await documentOnDeal(store, data.dealId, data.documentId);

    // A draft still has placeholders in it by design. Sending one would put
    // [CLIENT LEGAL NAME] in front of a client, which is the whole thing
    // finaliseDraft's guard exists to prevent, so it must not be reachable from
    // here either.
    if (document.status !== "final") return { ok: false, reason: "not-final" };

    // The hash copied onto the signature row must be the hash of the bytes the
    // signer will actually be shown. If the browser is holding an older one —
    // another tab finalised an edit, the page has been open a while — copying
    // it would record evidence against a version nobody signed. Refuse, and let
    // the operator reload and look at what they are actually sending.
    if (document.bodyHash !== data.bodyHash) return { ok: false, reason: "hash-mismatch" };

    const { requestSignature } = await import("@/server/documents/issue");
    const { signingToken } = await requestSignature(store, {
      documentId: data.documentId,
      bodyHash: document.bodyHash,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      sentBy: session.userId,
    });

    const { sendSignatureRequest } = await import("@/server/documents/mailer");
    const { sendMail } = await import("./intake");
    // sendMail is passed explicitly rather than imported by the mailer: the
    // routing decision — the transactional path, NOT the campaign mailer with
    // its cold-outbound allowlist — belongs at the call site, where it is
    // visible. See mailer.ts.
    const { sent } = await sendSignatureRequest(sendMail, {
      to: data.recipientEmail,
      recipientName: data.recipientName,
      documentTitle: document.title,
      signUrl: `${base}/sign/${encodeURIComponent(signingToken)}`,
      // Replies go to the operator who sent it, not a shared inbox nobody
      // watches. Someone answering a contract email must reach a person.
      replyTo: session.email,
    });

    return { ok: true, sent };
  });

/* ── read ───────────────────────────────────────────────────────────────── */

/**
 * One signature as the deal page shows it.
 *
 * Declared here rather than imported from src/server/documents/types.ts for
 * the same reason crm-data.ts declares its own DealDetail and CompanyRow: this
 * is the wire shape a client component consumes, and it must not drag a
 * server-only module into the client graph to describe itself.
 *
 * No signingToken. It is a bearer credential — whoever holds it can sign the
 * client's contract — and document_list_for_deal does not return one.
 */
export interface DealSignatureVM {
  id: string;
  recipientName: string;
  recipientEmail: string;
  status: string;
  sentAt: string | null;
  expiresAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  /**
   * True when the document has been edited since this request was sent, so
   * what the signer saw is not what the page now shows.
   *
   * Computed HERE, by src/server/documents/issue.ts's signatureIsStale, rather
   * than by comparing the two hashes in the component. One definition of
   * "stale" for the record and the screen; a second copy in JSX is the copy
   * that drifts, and the one that drifts is the one that stops warning.
   */
  stale: boolean;
}

export interface DealDocumentVM {
  id: string;
  docType: string;
  title: string;
  body: string;
  bodyHash: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  signatures: DealSignatureVM[];
}

export interface DealDocumentsVM {
  /**
   * False when the documents schema could not be reached at all.
   *
   * supabase/migrations/20260902120000_documents_esignature.sql is not applied
   * in every environment yet, and this loader runs on a deal page that is in
   * daily use. A missing RPC must therefore degrade to a notice on one card,
   * not a 500 on the whole record — the same posture crmDeal already takes with
   * its stage and event reads. It is a distinct field rather than an empty list
   * because "no documents" and "could not tell" are different answers, and an
   * operator has to be able to see which one they are looking at.
   */
  available: boolean;
  documents: DealDocumentVM[];
  /** Stage 4's gate. BLOCKS: advanceDealStage refuses Close without it. */
  signedSow: boolean;
  /** Stage 4's other condition. INFORMATIONAL ONLY — see crm-guards.ts. */
  depositPaid: boolean;
}

export const listDealDocuments = createServerFn({ method: "GET" })
  .validator((d: { dealId: string }) => ({ dealId: requireUuid(d?.dealId, "Deal") }))
  .handler(async ({ data }): Promise<DealDocumentsVM> => {
    const { store } = await forDeal(data.dealId);
    const { signatureIsStale } = await import("@/server/documents/issue");
    try {
      const [documents, signedSow, depositPaid] = await Promise.all([
        store.listDealDocuments(data.dealId),
        store.dealHasSignedSow(data.dealId),
        store.dealDepositPaid(data.dealId),
      ]);
      return {
        available: true,
        signedSow,
        depositPaid,
        documents: documents.map((document) => ({
          id: document.id,
          docType: document.docType,
          title: document.title,
          body: document.body,
          bodyHash: document.bodyHash,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          signatures: document.signatures.map((signature) => ({
            id: signature.id,
            recipientName: signature.recipientName,
            recipientEmail: signature.recipientEmail,
            status: signature.status,
            sentAt: signature.sentAt,
            expiresAt: signature.expiresAt,
            viewedAt: signature.viewedAt,
            signedAt: signature.signedAt,
            signedName: signature.signedName,
            stale: signatureIsStale(document, signature),
          })),
        })),
      };
    } catch {
      // Nothing is logged: these payloads carry contract bodies and client
      // names. The UI says the storage is unreachable, which is all an operator
      // can act on anyway.
      return { available: false, documents: [], signedSow: false, depositPaid: false };
    }
  });
