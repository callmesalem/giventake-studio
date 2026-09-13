/**
 * Server-only access helpers for the demo-site actions.
 *
 * These live under src/server/ rather than beside the server functions in
 * src/lib/demo-sites-data.ts for the reason src/server/documents/deal-access.ts
 * records at length: demo-sites-data.ts is client-reachable (a server
 * function's declaration is imported by the component that calls it), so a
 * plain helper defined there that reaches src/server/* joins the client module
 * graph and the import-protection plugin denies it — even when the reach is
 * written as a dynamic import(). Reached only by dynamic import() from the
 * stripped handlers, these stay off the client graph entirely.
 */
import { requireCrmSession } from "@/lib/crm-auth.server";
import { CrmRead } from "@/server/crm/read";
import { createSupabaseDemoSiteStore } from "@/server/demo-sites/store";

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

function reader(session: { userId: string; role: string }) {
  return new CrmRead({
    ...config(),
    actor: { id: session.userId, isAdmin: session.role === "admin" },
  });
}

/**
 * Session, a store, and a reader, plus proof that this operator may see this
 * deal.
 *
 * The deal lookup is not decoration. CrmRead scopes a member to rows they own
 * or are assigned, and a member asking for someone else's deal gets a 404
 * before any demo is queued. Without it, a deal id would be a way around that
 * scoping, because the demo_sites RPCs are keyed by deal id and know nothing
 * about who is asking.
 *
 * The projection matters: #scope reads owner_id and assigned_to OFF THE ROW IT
 * IS GIVEN, so leaving either out of the select makes the predicate false for
 * every row and 404s a member on a deal they own. deals is an "owned" table.
 */
export async function forDeal(dealId: string) {
  const session = await requireCrmSession();
  const read = reader(session);

  const deal = await read.getById<Record<string, unknown>>(
    "deals",
    dealId,
    "id,name,company_id,owner_id,assigned_to",
  );
  if (!deal) throw new Response("Not found", { status: 404 });

  return { session, read, deal, store: createSupabaseDemoSiteStore(config()) };
}

/**
 * The same, for a company.
 *
 * companies is a "shared" table in MEMBER_TABLE_POLICY — every member may see
 * every company — so the projection here carries no owner columns, because
 * #scope never filters this table. The lookup is still made rather than
 * skipped: a company id that does not exist must 404 rather than queue a demo
 * against nothing.
 */
export async function forCompany(companyId: string) {
  const session = await requireCrmSession();
  const read = reader(session);

  const company = await read.getById<Record<string, unknown>>("companies", companyId, "id,name");
  if (!company) throw new Response("Not found", { status: 404 });

  return { session, read, company, store: createSupabaseDemoSiteStore(config()) };
}

/**
 * The §10 kill switch, read for the demo gate.
 *
 * A failure reads as OFF, never as "unknown, proceed" — the same posture
 * sendPreflight takes. Queuing a public deployment because the control was
 * unreadable is the failure mode this whole gate exists to prevent.
 */
export async function outboundControl(read: CrmRead) {
  return read
    .systemControl<{ outboundEnabled?: boolean; reason?: string }>()
    .catch(() => ({ outboundEnabled: false, reason: "control unreadable" }));
}
