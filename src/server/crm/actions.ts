/**
 * Server-only CRM write actions for the dashboard.
 *
 * Separate from the read layer on purpose: this is the only module that mutates
 * CRM state from the dashboard, and it does so through security-definer RPCs with
 * the service-role key (server-side only). Currently limited to recording human
 * decisions on the approval queue — which marks a decision only and never sends,
 * deploys, or executes anything on its own.
 */

type Fetch = typeof globalThis.fetch;

export interface CrmActionsOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

export class CrmActions {
  readonly #url: string;
  readonly #key: string;
  readonly #fetch: Fetch;

  constructor(options: CrmActionsOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error("CrmActions requires url and serviceRoleKey");
    }
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async #rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.#fetch(`${this.#url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      // Surface the RPC's own message (e.g. "approval already decided") so the
      // dashboard can show a useful reason.
      let message = `CRM action ${name} failed: ${response.status}`;
      try {
        const err = (await response.json()) as { message?: string; hint?: string };
        if (err.message) message = err.message;
      } catch {
        // keep default
      }
      throw new Error(message);
    }
    return (await response.json()) as T;
  }

  /** Record a human decision on a pending approval. Marks the decision only. */
  decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason: string,
  ): Promise<boolean> {
    return this.#rpc<boolean>("approval_decide", {
      p_id: id,
      p_decision: decision,
      p_decided_by: decidedBy,
      p_reason: reason,
    });
  }
}
