import type { Approval, AuditEvent, ControlState, OperatorStore } from "./types.ts";

type Fetch = typeof globalThis.fetch;
export interface SupabaseStoreOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

export type OperatorJson =
  | null
  | string
  | number
  | boolean
  | OperatorJson[]
  | { [key: string]: OperatorJson };

export interface SyntheticRunRecord {
  runId: string;
  leadId: string;
  duplicate: boolean;
  status: string;
}
export interface SyntheticApprovalRecord {
  runId: string;
  approvalId: string;
  payload: { [key: string]: OperatorJson };
  payloadHash: string;
  status: "pending";
}

export interface OperatorDashboardSnapshot {
  system: { [key: string]: OperatorJson } | null;
  operators: { [key: string]: OperatorJson }[];
  runs: { [key: string]: OperatorJson }[];
  approvals: { [key: string]: OperatorJson }[];
  audit: { [key: string]: OperatorJson }[];
}

/** Server-only PostgREST/RPC adapter. Never import this module from a client route. */
export class SupabaseOperatorStore implements OperatorStore {
  readonly #url: string;
  readonly #key: string;
  readonly #fetch: Fetch;
  constructor(options: SupabaseStoreOptions) {
    if (!options.url || !options.serviceRoleKey)
      throw new Error("operator database configuration missing");
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }
  async #rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.#fetch(`${this.#url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        authorization: `Bearer ${this.#key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`operator database RPC failed: ${name}`);
    return response.json() as Promise<T>;
  }
  async getControls(operator: string): Promise<ControlState | null> {
    return this.#rpc("operator_get_controls", { p_operator_key: operator });
  }
  async getApproval(id: string): Promise<Approval | null> {
    return this.#rpc("operator_get_approval", { p_id: id });
  }
  async consumeApproval(id: string, expectedHash: string, at: string): Promise<boolean> {
    return this.#rpc("operator_consume_approval", {
      p_id: id,
      p_expected_hash: expectedHash,
      p_at: at,
    });
  }
  async appendAudit(event: AuditEvent): Promise<void> {
    await this.#rpc("append_operator_audit_event", {
      p_run_id: event.runId ?? null,
      p_operator_key: event.operator,
      p_event_type: event.type,
      p_details: event.details,
    });
  }
  async claimIdempotency(key: string): Promise<boolean> {
    return this.#rpc("operator_claim_idempotency", { p_key: key });
  }
  async isSuppressed(address: string): Promise<boolean> {
    return this.#rpc("operator_is_suppressed", { p_address: address });
  }
  async clientAllowsAi(clientId: string): Promise<boolean> {
    return this.#rpc("operator_client_allows_ai", { p_client_id: clientId });
  }
  async createSyntheticLeadRun(
    idempotencyKey: string,
    lead: Record<string, unknown>,
  ): Promise<SyntheticRunRecord> {
    return this.#rpc("operator_create_synthetic_lead_run", {
      p_idempotency_key: idempotencyKey,
      p_lead: lead,
    });
  }
  async recordSyntheticCfo(runId: string, result: Record<string, unknown>) {
    return this.#rpc<Record<string, unknown>>("operator_record_synthetic_cfo", {
      p_run_id: runId,
      p_result: result,
    });
  }
  async recordSyntheticDraftApproval(
    runId: string,
    draft: Record<string, unknown>,
    expiresAt: string,
  ): Promise<SyntheticApprovalRecord> {
    return this.#rpc("operator_record_synthetic_draft_approval", {
      p_run_id: runId,
      p_draft: draft,
      p_expires_at: expiresAt,
    });
  }
  async getDashboardSnapshot(): Promise<OperatorDashboardSnapshot> {
    return this.#rpc("operator_dashboard_snapshot", {});
  }
  /**
   * Persist a real inbound website lead. Writes a lead + touchpoint + agent_log
   * row via the `capture_website_lead` definer RPC. It never sends and never
   * starts an operator run — recording an inbound enquiry is "track", not
   * outbound.
   */
  async captureWebsiteLead(
    payload: Record<string, unknown>,
  ): Promise<{ leadId: string; touchpointId: string; duplicate: boolean; suppressed: boolean }> {
    return this.#rpc("capture_website_lead", { p_payload: payload });
  }
  async approveSyntheticDraft(
    approvalId: string,
    expectedHash: string,
    actor: string,
    reason: string,
  ): Promise<boolean> {
    return this.#rpc("operator_approve_synthetic_draft", {
      p_id: approvalId,
      p_expected_hash: expectedHash,
      p_actor: actor,
      p_reason: reason,
    });
  }
  async rejectSyntheticDraft(
    approvalId: string,
    expectedHash: string,
    actor: string,
    reason: string,
  ): Promise<boolean> {
    return this.#rpc("operator_reject_synthetic_draft", {
      p_id: approvalId,
      p_expected_hash: expectedHash,
      p_actor: actor,
      p_reason: reason,
    });
  }
}
