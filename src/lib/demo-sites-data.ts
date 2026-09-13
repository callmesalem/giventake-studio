/**
 * The deal page's demo-site actions — TanStack Start server functions.
 *
 * This lives in src/lib/ beside documents-data.ts, and NOT in
 * src/server/demo-sites/ where the rest of the feature lives, because it has
 * to: the build denies any import of src/server/* from the client environment
 * (@tanstack/start-plugin-core's import-protection plugin), and a server
 * function's declaration is imported by the component that calls it. The
 * server-only modules are reached below by dynamic import(), exactly the way
 * documents-data.ts reaches deal-access.
 *
 * WHAT THIS FEATURE DOES NOT DO: build or deploy anything. The generator is a
 * Python + headless pipeline on the VPS holding the Google Maps and Vercel
 * keys; a Cloudflare Worker can run none of it. These functions write a
 * 'requested' row and read results back. Every word the UI shows has to respect
 * that gap — "queued", never "built".
 *
 * Requesting is gated, and the gate is the point. Queuing a demo puts a public
 * website on the internet under a prospect's name, which is an external action
 * in the charter's sense, so it goes through the §10 kill switch the same way
 * sending does. The gates are rebuilt at submit time from facts read then, in
 * src/server/demo-sites/request.ts; whatever the browser believed when it
 * rendered the card is advisory only.
 */
import { createServerFn } from "@tanstack/react-start";
import { buildDemoSiteGates, isDemoSiteRequestable, type Gate } from "@/lib/crm-guards";

/** A deal or company id is a uuid; anything else is a client bug or a probe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID.test(id)) throw new Response(`${field} is not valid`, { status: 400 });
  return id;
}

function requireText(value: unknown, field: string, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new Response(`${field} is required`, { status: 400 });
  if (s.length > max) throw new Response(`${field} is too long`, { status: 400 });
  return s;
}

/** Absent and empty collapse to null: the column is nullable and a row storing
 *  "" would make "no address given" and "address is blank" indistinguishable
 *  to the builder. */
function optionalText(value: unknown, field: string, max: number): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  if (s.length > max) throw new Response(`${field} is too long`, { status: 400 });
  return s;
}

export interface DemoSiteVM {
  id: string;
  businessName: string;
  address: string | null;
  vertical: string | null;
  status: string;
  url: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoSitesVM {
  /**
   * False when the demo_sites schema could not be reached at all.
   *
   * supabase/migrations/20260911223000_demo_sites.sql is not applied in every
   * environment, and this loader runs on a deal page in daily use. A missing
   * RPC degrades to a notice on one card, not a 500 on the whole record — the
   * same posture listDealDocuments takes. It is a distinct field rather than an
   * empty list because "no demos" and "could not tell" are different answers.
   */
  available: boolean;
  demoSites: DemoSiteVM[];
  /**
   * The gates as they stand right now, with `suggestedName` as the business
   * name. ADVISORY: they are what the card renders so an operator can see why
   * the button is disabled before pressing it. The authoritative evaluation
   * happens inside requestDealDemoSite against the name actually submitted.
   */
  gates: Gate[];
  requestable: boolean;
  /** The company name, which is what the builder should search Google Places
   *  for — not the deal name, which is an internal label like "Acme — rebuild".
   *  Falls back to the deal name only when the deal has no company. */
  suggestedName: string;
}

export const listDealDemoSites = createServerFn({ method: "GET" })
  .validator((d: { dealId: string }) => ({ dealId: requireUuid(d?.dealId, "Deal") }))
  .handler(async ({ data }): Promise<DemoSitesVM> => {
    const { forDeal, outboundControl } = await import("@/server/demo-sites/access");
    const { read, deal, store } = await forDeal(data.dealId);

    try {
      const companyId = typeof deal.company_id === "string" ? deal.company_id : null;
      const [demoSites, control, company] = await Promise.all([
        store.listForDeal(data.dealId),
        outboundControl(read),
        companyId
          ? read.getById<Record<string, unknown>>("companies", companyId, "id,name")
          : Promise.resolve(null),
      ]);

      const suggestedName =
        (typeof company?.name === "string" && company.name.trim()) ||
        (typeof deal.name === "string" && deal.name.trim()) ||
        "";

      const gates = buildDemoSiteGates({
        outboundEnabled: control.outboundEnabled,
        outboundReason: control.reason,
        hasTarget: true,
        businessName: suggestedName,
        existingStatuses: demoSites.map((d) => d.status),
      });

      return {
        available: true,
        suggestedName,
        gates,
        requestable: isDemoSiteRequestable(gates),
        demoSites: demoSites.map((d) => ({
          id: d.id,
          businessName: d.businessName,
          address: d.address,
          vertical: d.vertical,
          status: d.status,
          url: d.url,
          error: d.error,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      };
    } catch {
      // Nothing is logged: an unreachable schema is all an operator can act on,
      // and these payloads carry prospect names and addresses.
      //
      // requestable is false, not merely absent. If the card cannot tell what
      // the kill switch says, it must not offer to publish a website.
      return {
        available: false,
        demoSites: [],
        gates: [],
        requestable: false,
        suggestedName: "",
      };
    }
  });

export type RequestDemoSiteResult =
  | { ok: true; demoSiteId: string }
  /** Refused by the gates. They are returned so the card can say which one and
   *  why, rather than showing a dead button with no account of itself. */
  | { ok: false; reason: "refused"; gates: Gate[] };

export const requestDealDemoSite = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId, "Deal"),
    businessName: requireText(d?.businessName, "Business name", 200),
    address: optionalText(d?.address, "Address", 300),
    vertical: optionalText(d?.vertical, "Vertical", 80),
  }))
  .handler(async ({ data }): Promise<RequestDemoSiteResult> => {
    const { requestDemoSiteForDeal } = await import("@/server/demo-sites/request");
    const outcome = await requestDemoSiteForDeal({
      dealId: data.dealId,
      businessName: data.businessName,
      address: data.address,
      vertical: data.vertical,
    });
    if (!outcome.ok) return { ok: false, reason: "refused", gates: outcome.gates };
    return { ok: true, demoSiteId: outcome.demoSiteId };
  });
