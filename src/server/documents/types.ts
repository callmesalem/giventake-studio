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
