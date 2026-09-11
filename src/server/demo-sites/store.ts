import type { DemoSiteRow, DemoSiteStatus } from "./types.ts";

export interface DemoSiteStore {
  /** Queue a demo build. Returns the new row's id.
   *
   *  This does NOT build anything and must never be described to an operator as
   *  though it had. It writes a 'requested' row; the VPS agent picks it up on
   *  its next poll. The gap between the two is why the card reports status
   *  rather than success. */
  requestDemoSite(input: {
    companyId: string | null;
    dealId: string | null;
    businessName: string;
    address: string | null;
    vertical: string | null;
    requestedBy: string | null;
  }): Promise<string>;

  listForDeal(dealId: string): Promise<DemoSiteRow[]>;
  listForCompany(companyId: string): Promise<DemoSiteRow[]>;
}

/** The demo_sites row shape as PostgREST returns it — snake-cased, because
 *  demo_sites_for_deal/_for_company are `returns setof public.demo_sites` and
 *  hand back the table's own columns rather than a jsonb projection. */
interface DemoSiteJson {
  id: string;
  company_id: string | null;
  deal_id: string | null;
  business_name: string;
  address: string | null;
  vertical: string | null;
  status: DemoSiteStatus;
  url: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

function toRow(row: DemoSiteJson): DemoSiteRow {
  return {
    id: row.id,
    companyId: row.company_id,
    dealId: row.deal_id,
    businessName: row.business_name,
    address: row.address,
    vertical: row.vertical,
    status: row.status,
    url: row.url,
    error: row.error,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * PostgREST adapter, same posture as src/server/documents/store.ts: every call
 * is a narrow SECURITY DEFINER RPC granted only to service_role, and the key
 * stays server-side. demo_sites has RLS on with no policies, so the RPCs below
 * are the whole surface — there is no direct table access to fall back to.
 *
 * Deliberately absent: demo_requests_pending and demo_site_set_result. Those
 * two are the VPS agent's half of the contract, granted to crm_agent, and the
 * app has no business calling either. The app queues work and reads results;
 * claiming a build started, or writing a url the app did not deploy, are the
 * two lies this omission makes impossible to tell from here.
 *
 * No @supabase/supabase-js, for the reason src/server/crm/auth.ts records:
 * keeping the auth SDK out keeps the browser bundle free of any key.
 *
 * Nothing here catches. A failed call must reach the caller — a swallowed
 * error would report a demo queued when nothing was written.
 */
export function createSupabaseDemoSiteStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): DemoSiteStore {
  const base = config.url.replace(/\/$/, "");
  const doFetch = config.fetch ?? ((i: RequestInfo | URL, n?: RequestInit) => fetch(i, n));

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
    if (!response.ok) throw new Error(`demo site rpc ${name} failed: ${response.status}`);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    requestDemoSite: (input) =>
      rpc<string>("demo_site_request", {
        p_company_id: input.companyId,
        p_deal_id: input.dealId,
        p_business_name: input.businessName,
        p_address: input.address,
        p_vertical: input.vertical,
        p_requested_by: input.requestedBy,
      }),

    async listForDeal(dealId) {
      const rows = await rpc<DemoSiteJson[]>("demo_sites_for_deal", { p_deal_id: dealId });
      return (rows ?? []).map(toRow);
    },

    async listForCompany(companyId) {
      const rows = await rpc<DemoSiteJson[]>("demo_sites_for_company", {
        p_company_id: companyId,
      });
      return (rows ?? []).map(toRow);
    },
  };
}
