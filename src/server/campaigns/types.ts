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

/** The four states campaign_claim_step can resolve a (enrollment, step) to. */
export type StepClaim = "claimed" | "already_sent" | "in_flight" | "exhausted";

export interface SendOutcome {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  /** True when the provider rejected the address outright — retrying cannot help. */
  permanent?: boolean;
  /** No response was received, so the send MAY have happened. Never retry. */
  ambiguous?: boolean;
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
  claimStep(enrollmentId: string, stepOrder: number): Promise<StepClaim>;
  recordResult(
    enrollmentId: string,
    stepOrder: number,
    status: "sent" | "failed",
    providerMessageId?: string,
    error?: string,
  ): Promise<void>;
  markStatus(
    enrollmentId: string,
    status: string,
    advance: boolean,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void>;
  /**
   * The inbound paths know a provider message id, never an enrollment id: a
   * Resend delivery event carries data.email_id, and a reply carries the
   * threading headers. Both resolve to the enrollment through campaign_sends.
   *
   * There is no advance flag on purpose. Everything that arrives this way -
   * a bounce, a complaint, a reply - is terminal for the enrollment, so
   * advancing to the next step would be exactly the wrong move.
   */
  markStatusByMessageId(
    providerMessageId: string,
    status: string,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Passed to campaign_claim_step as p_max_attempts. Attempt COUNTING lives in
 * SQL and only in SQL — the runner never counts, it reads the claim state — so
 * this is a knob for the store adapter, not a second tally.
 */
export const MAX_ATTEMPTS = 3;
