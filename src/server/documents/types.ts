export type DocType =
  | "sow"
  | "msa"
  | "discovery_notes"
  | "weekly_update"
  | "delivery_review"
  | "handoff"
  | "acceptance";

export type DocumentStatus = "draft" | "final" | "superseded";

export type SignatureStatus = "pending" | "viewed" | "signed" | "declined" | "expired";

export interface DocumentRow {
  id: string;
  dealId: string | null;
  projectId: string | null;
  stageNumber: number | null;
  docType: DocType;
  title: string;
  body: string;
  bodyHash: string;
  templateId: string | null;
  status: DocumentStatus;
}

export interface SignatureRow {
  id: string;
  documentId: string;
  recipientName: string;
  recipientEmail: string;
  signingToken: string;
  status: SignatureStatus;
  expiresAt: string;
  signedAt: string | null;
  signedName: string | null;
  documentHash: string;
}

/** What the public sign page needs. Deliberately excludes the token. */
export interface SigningView {
  title: string;
  body: string;
  recipientName: string;
  status: SignatureStatus;
  expired: boolean;
}

/**
 * One signature as the OPERATOR sees it, on the deal page.
 *
 * Deliberately excludes signingToken, for the same reason SigningView does:
 * the token is a bearer credential and document_find_by_token is the only
 * place it is ever read. An operator listing has no use for it.
 *
 * documentHash IS included, and it is the point. It is the hash frozen when
 * this request was sent; compare it with the document's current bodyHash
 * (issue.ts's signatureIsStale) to see whether the document has been edited
 * since. Without both halves on screen the mismatch is recorded and never read.
 */
export interface DealSignatureView {
  id: string;
  recipientName: string;
  recipientEmail: string;
  status: SignatureStatus;
  sentAt: string | null;
  expiresAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  documentHash: string;
}

/** One document on a deal, with every signature raised against it. */
export interface DealDocumentView {
  id: string;
  docType: string;
  title: string;
  body: string;
  bodyHash: string;
  status: DocumentStatus;
  createdAt: string | null;
  updatedAt: string | null;
  signatures: DealSignatureView[];
}
