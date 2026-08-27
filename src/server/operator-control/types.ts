export type OperatorMode = "synthetic" | "shadow";
export type OperatorAction =
  | "draft"
  | "queue_approval"
  | "send"
  | "deploy"
  | "set_price"
  | "change_scope"
  | "sign"
  | "refund";
export interface ControlState {
  globalEnabled: boolean;
  enabled: boolean;
  allowedModes: OperatorMode[];
}
export interface Approval {
  id: string;
  action: OperatorAction;
  payloadHash: string;
  expiresAt: string;
  revokedAt?: string | null;
  consumedAt?: string | null;
}
export interface OperatorStore {
  getControls(operator: string): Promise<ControlState | null>;
  getApproval(id: string): Promise<Approval | null>;
  consumeApproval(id: string, expectedHash: string, at: string): Promise<boolean>;
  appendAudit(event: AuditEvent): Promise<void>;
  claimIdempotency(key: string): Promise<boolean>;
  isSuppressed(address: string): Promise<boolean>;
  clientAllowsAi(clientId: string): Promise<boolean>;
}
export interface AuditEvent {
  type: string;
  operator: string;
  runId?: string;
  details: Record<string, unknown>;
  at: string;
}
export interface SyntheticInput {
  operator: string;
  runId: string;
  idempotencyKey: string;
  lead: { email: string; name?: string };
  clientId?: string;
  draft: string;
}
