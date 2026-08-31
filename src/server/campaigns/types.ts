/** A single due step, as returned by campaign_claim_due. */
export interface DueSend {
  enrollmentId: string;
  campaignId: string;
  stepOrder: number;
  sop: string | null;
  email: string | null;
  name: string | null;
  template: { subject?: string; text?: string };
}

export interface SendOutcome {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  /** True when the provider rejected the address outright — retrying cannot help. */
  permanent?: boolean;
}

export interface Mailer {
  send(input: {
    to: string;
    subject: string;
    text: string;
    replyTo: string;
    headers?: Record<string, string>;
  }): Promise<SendOutcome>;
}

export interface CampaignStore {
  claimDue(limit: number, leaseSeconds: number): Promise<DueSend[]>;
  isSuppressed(address: string): Promise<boolean>;
  isApprovedRecipient(address: string, sop: string): Promise<boolean>;
  recordSend(
    enrollmentId: string,
    stepOrder: number,
    status: "sending" | "sent" | "failed",
    providerMessageId?: string,
    error?: string,
  ): Promise<boolean>;
  markStatus(
    enrollmentId: string,
    status: string,
    advance: boolean,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void>;
  attemptsFor(enrollmentId: string, stepOrder: number): Promise<number>;
}

export interface Clock {
  now(): Date;
}

export const MAX_ATTEMPTS = 3;
