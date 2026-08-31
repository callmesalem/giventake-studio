import type { CampaignStore, DueSend, StepClaim } from "./types.ts";

/**
 * PostgREST adapter. Every call is a narrow SECURITY DEFINER RPC granted only
 * to service_role — the same posture as src/server/crm/read.ts. The key stays
 * server-side and never reaches the browser.
 *
 * Nothing here catches. A failed call must reach the runner, which skips that
 * enrollment; a swallowed error would either send unclaimed mail or wedge a
 * step with no trace.
 */
export function createSupabaseCampaignStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): CampaignStore {
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
    if (!response.ok) throw new Error(`campaign rpc ${name} failed: ${response.status}`);
    return (await response.json()) as T;
  }

  return {
    async claimDue(limit, leaseSeconds) {
      const rows = await rpc<DueSend[]>("campaign_claim_due", {
        p_limit: limit, p_lease_seconds: leaseSeconds,
      });
      return Array.isArray(rows) ? rows : [];
    },
    isSuppressed: (address) => rpc<boolean>("operator_is_suppressed", { p_address: address }),
    isApprovedRecipient: (address, sop) =>
      rpc<boolean>("is_approved_recipient", { p_address: address, p_sop: sop }),
    claimStep: (enrollmentId, stepOrder) =>
      rpc<StepClaim>("campaign_claim_step", {
        p_enrollment_id: enrollmentId, p_step_order: stepOrder,
      }),
    recordResult: (enrollmentId, stepOrder, status, providerMessageId, error) =>
      rpc<void>("campaign_record_result", {
        p_enrollment_id: enrollmentId, p_step_order: stepOrder, p_status: status,
        p_provider_message_id: providerMessageId ?? null, p_error: error ?? null,
      }),
    markStatus: (enrollmentId, status, advance, eventType, details) =>
      rpc<void>("campaign_mark_status", {
        p_enrollment_id: enrollmentId, p_status: status, p_advance: advance,
        p_event_type: eventType, p_details: details,
      }),
    markStatusByMessageId: (providerMessageId, status, eventType, details) =>
      rpc<void>("campaign_mark_by_message", {
        p_provider_message_id: providerMessageId, p_status: status,
        p_event_type: eventType, p_details: details,
      }),
  };
}
