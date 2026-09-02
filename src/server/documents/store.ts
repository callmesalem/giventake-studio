import { createClient } from "@supabase/supabase-js";
import type { SignatureRow } from "./types.ts";

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
  markSigned(input: {
    id: string;
    signedName: string;
    consentText: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void>;
  dealHasSignedSow(dealId: string): Promise<boolean>;
}

export function createSupabaseDocumentStore(config: {
  url: string;
  serviceRoleKey: string;
}): DocumentStore {
  const db = createClient(config.url, config.serviceRoleKey);

  return {
    async createDocument(input) {
      const { data, error } = await db
        .from("documents")
        .insert({
          deal_id: input.dealId,
          project_id: input.projectId,
          stage_number: input.stageNumber,
          doc_type: input.docType,
          title: input.title,
          body: input.body,
          body_hash: input.bodyHash,
          template_id: input.templateId,
          owner_id: input.ownerId,
        })
        .select("id")
        .single();
      if (error) throw new Error(`createDocument failed: ${error.message}`);
      return data.id as string;
    },

    async updateDocumentBody(input) {
      const { error } = await db
        .from("documents")
        .update({
          body: input.body,
          body_hash: input.bodyHash,
          status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(`updateDocumentBody failed: ${error.message}`);
    },

    async createSignatureRequest(input) {
      const { data, error } = await db
        .from("document_signatures")
        .insert({
          document_id: input.documentId,
          recipient_name: input.recipientName,
          recipient_email: input.recipientEmail,
          document_hash: input.documentHash,
          sent_by: input.sentBy,
        })
        .select("id, signing_token")
        .single();
      if (error) throw new Error(`createSignatureRequest failed: ${error.message}`);
      return { id: data.id as string, signingToken: data.signing_token as string };
    },

    async findByToken(token) {
      const { data, error } = await db
        .from("document_signatures")
        .select(
          "id, document_id, recipient_name, recipient_email, signing_token, status, expires_at, signed_at, signed_name, document_hash, documents(title, body)",
        )
        .eq("signing_token", token)
        .maybeSingle();
      if (error || !data) return null;
      const doc = data.documents as unknown as { title: string; body: string };
      return {
        id: data.id as string,
        documentId: data.document_id as string,
        recipientName: data.recipient_name as string,
        recipientEmail: data.recipient_email as string,
        signingToken: data.signing_token as string,
        status: data.status as SignatureRow["status"],
        expiresAt: data.expires_at as string,
        signedAt: data.signed_at as string | null,
        signedName: data.signed_name as string | null,
        documentHash: data.document_hash as string,
        title: doc.title,
        body: doc.body,
      };
    },

    async markViewed(id) {
      await db
        .from("document_signatures")
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("id", id)
        .eq("status", "pending");
    },

    async markSigned(input) {
      const { error } = await db
        .from("document_signatures")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signed_name: input.signedName,
          consent_text: input.consentText,
          signature_ip: input.ip,
          signature_user_agent: input.userAgent,
        })
        .eq("id", input.id)
        .in("status", ["pending", "viewed"]);
      if (error) throw new Error(`markSigned failed: ${error.message}`);
    },

    async dealHasSignedSow(dealId) {
      const { data, error } = await db.rpc("deal_has_signed_sow", { p_deal_id: dealId });
      if (error) return false;
      return data === true;
    },
  };
}
