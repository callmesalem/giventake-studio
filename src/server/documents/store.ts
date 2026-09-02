import type { DealDocumentView, DealSignatureView, SignatureRow } from "./types.ts";

export interface DocumentStore {
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

  /** Replace an edited draft's body and re-hash it. The re-hash is what leaves a
   *  sent signature's copied hash behind, which is how a stale signature stays
   *  detectable rather than silent. */
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

  findByToken(token: string): Promise<(SignatureRow & { body: string; title: string }) | null>;
  markViewed(id: string): Promise<void>;

  /** Resolves to whether the signature was actually written. False means the row
   *  had already left 'pending'/'viewed' - a replay - and the caller must answer
   *  "already signed" rather than report a signature it did not record. */
  markSigned(input: {
    id: string;
    signedName: string;
    consentText: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<boolean>;

  /** One deal's documents with every signature raised against them, for the
   *  operator UI. Never carries a signing token - see document_list_for_deal. */
  listDealDocuments(dealId: string): Promise<DealDocumentView[]>;

  dealHasSignedSow(dealId: string): Promise<boolean>;

  /** Stage 4's OTHER condition, and INFORMATIONAL ONLY. Nothing may refuse an
   *  advance on it: invoices.paid_at depends on Stripe reconciliation, and a
   *  webhook that arrives late would block work that is genuinely signed and
   *  genuinely paid. Unlike dealHasSignedSow below, this does NOT catch - it is
   *  not a gate, so a failed read must not quietly become "unpaid". */
  dealDepositPaid(dealId: string): Promise<boolean>;
}

/** The shapes document_list_for_deal builds, snake-cased for the same reason. */
interface DealSignatureJson {
  id: string;
  recipient_name: string;
  recipient_email: string;
  status: SignatureRow["status"];
  sent_at: string | null;
  expires_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  document_hash: string;
}

interface DealDocumentJson {
  id: string;
  doc_type: string;
  title: string;
  body: string;
  body_hash: string;
  status: DealDocumentView["status"];
  created_at: string | null;
  updated_at: string | null;
  signatures: DealSignatureJson[] | null;
}

/** The shape document_find_by_token builds. Snake-cased because it comes
 *  straight out of jsonb_build_object. */
interface SignatureJson {
  id: string;
  document_id: string;
  recipient_name: string;
  recipient_email: string;
  signing_token: string;
  status: SignatureRow["status"];
  expires_at: string;
  signed_at: string | null;
  signed_name: string | null;
  document_hash: string;
  title: string;
  body: string;
}

/**
 * PostgREST adapter. Every call is a narrow SECURITY DEFINER RPC granted only
 * to service_role — the same posture as src/server/campaigns/supabase-store.ts
 * and src/server/crm/read.ts. The key stays server-side and never reaches the
 * browser.
 *
 * There is deliberately no @supabase/supabase-js here. It is not a dependency
 * of this repo, and src/server/crm/auth.ts records why: keeping the auth SDK
 * out keeps the browser bundle free of any key and any auth SDK. Both tables
 * have RLS on with no policies, so there is no direct table access to fall back
 * to even if the SDK were present — the RPCs below are the whole surface.
 *
 * Nothing here catches, with one exception marked at dealHasSignedSow. A failed
 * call must reach the caller; a swallowed error would report a document stored
 * or a signature recorded when neither happened.
 */
export function createSupabaseDocumentStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): DocumentStore {
  const base = config.url.replace(/\/$/, "");
  const doFetch = config.fetch ?? ((i, n) => fetch(i, n));

  async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await doFetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`document rpc ${name} failed: ${response.status}`);
    // A `returns void` RPC answers 204 with an empty payload, which is not JSON.
    // Two of the functions below are void, so parsing unconditionally would turn
    // their successful writes into exceptions.
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    createDocument: (input) =>
      rpc<string>("document_create", {
        p_deal_id: input.dealId,
        p_project_id: input.projectId,
        p_stage_number: input.stageNumber,
        p_doc_type: input.docType,
        p_title: input.title,
        p_body: input.body,
        p_body_hash: input.bodyHash,
        p_template_id: input.templateId,
        p_owner_id: input.ownerId,
      }),

    updateDocumentBody: (input) =>
      rpc<void>("document_update_body", {
        p_id: input.id,
        p_body: input.body,
        p_body_hash: input.bodyHash,
        p_status: input.status,
      }),

    async createSignatureRequest(input) {
      const row = await rpc<{ id: string; signing_token: string }>("document_request_signature", {
        p_document_id: input.documentId,
        p_recipient_name: input.recipientName,
        p_recipient_email: input.recipientEmail,
        p_document_hash: input.documentHash,
        p_sent_by: input.sentBy,
      });
      return { id: row.id, signingToken: row.signing_token };
    },

    async findByToken(token) {
      const row = await rpc<SignatureJson | null>("document_find_by_token", { p_token: token });
      // Null is "no such token" — a stale or mistyped link, an ordinary outcome.
      // A failed call is not that, and has already thrown above rather than
      // arriving here disguised as a missing row.
      if (!row) return null;
      return {
        id: row.id,
        documentId: row.document_id,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        signingToken: row.signing_token,
        status: row.status,
        expiresAt: row.expires_at,
        signedAt: row.signed_at,
        signedName: row.signed_name,
        documentHash: row.document_hash,
        title: row.title,
        body: row.body,
      };
    },

    markViewed: (id) => rpc<void>("document_mark_viewed", { p_id: id }),

    markSigned: (input) =>
      rpc<boolean>("document_mark_signed", {
        p_id: input.id,
        p_signed_name: input.signedName,
        p_consent_text: input.consentText,
        p_ip: input.ip,
        p_user_agent: input.userAgent,
      }),

    async listDealDocuments(dealId) {
      // coalesce in the RPC means '[]' rather than null for a deal with no
      // documents, so there is nothing to distinguish here. A failed call has
      // already thrown out of rpc().
      const rows = await rpc<DealDocumentJson[]>("document_list_for_deal", {
        p_deal_id: dealId,
      });
      return rows.map((row) => ({
        id: row.id,
        docType: row.doc_type,
        title: row.title,
        body: row.body,
        bodyHash: row.body_hash,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        signatures: (row.signatures ?? []).map(
          (signature): DealSignatureView => ({
            id: signature.id,
            recipientName: signature.recipient_name,
            recipientEmail: signature.recipient_email,
            status: signature.status,
            sentAt: signature.sent_at,
            expiresAt: signature.expires_at,
            viewedAt: signature.viewed_at,
            signedAt: signature.signed_at,
            signedName: signature.signed_name,
            documentHash: signature.document_hash,
          }),
        ),
      }));
    },

    async dealHasSignedSow(dealId) {
      // The one method that catches, and the divergence is the point.
      //
      // This is stage 4's gate — "Signed and paid before any code". Every other
      // method here lets a failure through so the caller can retry or surface
      // it. A gate is the opposite: if it cannot verify that a signed SOW
      // exists, the honest answer is "no". Rethrowing would be defensible, but
      // only if every caller remembered to treat the throw as a refusal, and a
      // gate that opens when its check errors is the failure mode worth
      // designing out.
      //
      // Note the `=== true`: a null — what this would return if the function
      // ever stopped answering with a boolean — must not read as a pass either.
      try {
        return (await rpc<boolean | null>("deal_has_signed_sow", { p_deal_id: dealId })) === true;
      } catch {
        return false;
      }
    },

    // Does NOT catch, and the divergence from dealHasSignedSow above is
    // deliberate in the other direction. That one is a gate, so an unanswerable
    // check has to read as "no". This one is a status line a human reads: an
    // unanswerable check that silently rendered "deposit not paid" would be the
    // system asserting a financial fact it never established. Let it throw and
    // let the caller say it could not tell.
    async dealDepositPaid(dealId) {
      return (await rpc<boolean | null>("deal_deposit_paid", { p_deal_id: dealId })) === true;
    },
  };
}
