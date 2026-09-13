/**
 * The one path that queues a demo site.
 *
 * Both the deal page and the approval executor reach demo_site_request through
 * here, and that is the point. Queuing a demo puts a public website on the
 * internet under a prospect's name, so the §10 kill switch and the duplicate
 * guard have to hold on every route in. Two copies of that gate block would be
 * two implementations that must agree forever; one function cannot disagree
 * with itself.
 *
 * Server-only. src/lib/demo-sites-data.ts reaches it by dynamic import().
 */
import { buildDemoSiteGates, isDemoSiteRequestable, type Gate } from "@/lib/crm-guards";
import { forDeal, outboundControl } from "@/server/demo-sites/access";

export type DemoSiteRequestOutcome =
  | { ok: true; demoSiteId: string }
  /** Refused. The gates travel with the refusal so a caller can say WHICH one
   *  said no, rather than reporting an undifferentiated failure. */
  | { ok: false; gates: Gate[] };

export async function requestDemoSiteForDeal(input: {
  dealId: string;
  businessName: string;
  address: string | null;
  vertical: string | null;
}): Promise<DemoSiteRequestOutcome> {
  const { session, read, deal, store } = await forDeal(input.dealId);

  // Read the facts the gate needs FROM THE DATABASE, now. A caller may have
  // computed gates minutes ago; the kill switch may have been thrown since, and
  // a stale pass must not be what authorises a deployment.
  const [existing, control] = await Promise.all([
    store.listForDeal(input.dealId),
    outboundControl(read),
  ]);

  const gates = buildDemoSiteGates({
    outboundEnabled: control.outboundEnabled,
    outboundReason: control.reason,
    hasTarget: true,
    businessName: input.businessName,
    existingStatuses: existing.map((d) => d.status),
  });

  // Nothing is written on refusal. A demo_sites row that exists but must never
  // be built is a trap for whoever finds it later.
  if (!isDemoSiteRequestable(gates)) return { ok: false, gates };

  const demoSiteId = await store.requestDemoSite({
    // Both ids are attached when the deal has a company, so the demo surfaces
    // on the company record too. The table requires at least one; a deal always
    // supplies one here.
    companyId: typeof deal.company_id === "string" ? deal.company_id : null,
    dealId: input.dealId,
    businessName: input.businessName,
    address: input.address,
    vertical: input.vertical,
    requestedBy: session.userId,
  });

  return { ok: true, demoSiteId };
}
