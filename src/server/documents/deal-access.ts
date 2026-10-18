/**
 * Server-only access helpers for the deal document actions.
 *
 * These live here under src/server/ rather than beside the server functions in
 * src/lib/documents-data.ts, and that is the whole point. documents-data.ts is
 * client-reachable (a server function's declaration is imported by the
 * component that calls it — that is how the RPC bridge is wired), so a plain
 * helper defined there that reaches src/server/* is part of the client module
 * graph and the import-protection plugin denies it, even when the reach is
 * written as a dynamic import(). Defined here and reached only by dynamic
 * import() from the stripped server-function handlers, these stay off the
 * client graph entirely.
 */
import type { PaymentOptionKey, ProposalLine } from "@/lib/proposals";
import { requireCrmSession } from "@/lib/crm-auth.server";
import { CrmRead } from "@/server/crm/read";
import { createSupabaseDocumentStore } from "@/server/documents/store";

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

/**
 * Session + a document store, plus proof that this operator may see this deal.
 *
 * The deal lookup is not decoration. crm-data.ts's reader() scopes reads to the
 * signed-in user — an admin sees everything, a member sees only what they own
 * or are assigned — and a member asking for someone else's deal gets a 404
 * before any document is touched. Without this, a document id would be a way
 * around that scoping, because the documents RPCs are keyed by document id and
 * know nothing about who is asking.
 */
export async function forDeal(dealId: string) {
  const session = await requireCrmSession();

  const read = new CrmRead({
    ...config(),
    actor: { id: session.userId, isAdmin: session.role === "admin" },
  });
  // The projection is part of the check, not decoration. CrmRead scopes a
  // member to rows where owner_id or assigned_to is them, and it applies that
  // filter to the ROW IT WAS GIVEN. Selecting only "id,name" left both columns
  // undefined, so the predicate was false for every row and a member 404d on a
  // deal they own — taking all four document server functions with it. Any
  // column the scope filter reads must be in the select.
  const deal = await read.getById<Record<string, unknown>>(
    "deals",
    dealId,
    "id,name,owner_id,assigned_to",
  );
  if (!deal) throw new Response("Not found", { status: 404 });

  return { session, store: createSupabaseDocumentStore(config()) };
}

export type DocumentStoreFor = Awaited<ReturnType<typeof forDeal>>["store"];

/**
 * Resolve one document on a deal the caller may see, or refuse.
 *
 * Reading the whole list to find one document is a round trip a `document_get`
 * RPC would save, and it is the right trade anyway: the write paths need the
 * document's CURRENT status and body_hash to decide whether the action is even
 * legal, and reading them here means those decisions are made against the
 * database rather than against whatever the browser believed when the page was
 * rendered.
 */
export async function documentOnDeal(store: DocumentStoreFor, dealId: string, documentId: string) {
  const documents = await store.listDealDocuments(dealId);
  const document = documents.find((d) => d.id === documentId);
  if (!document) throw new Response("Not found", { status: 404 });
  return document;
}

/** The deal's accepted proposal and its lines, or null. Call only after forDeal(dealId). */
export async function acceptedProposalForDeal(
  dealId: string,
  proposalId: string,
): Promise<{
  summary: string;
  timeline: string;
  option: PaymentOptionKey;
  lines: ProposalLine[];
} | null> {
  // forDeal has already authorised the caller for this deal, so the admin actor is safe.
  const read = new CrmRead({ ...config(), actor: { id: null, isAdmin: true } });
  const p = await read.getProposal<Record<string, unknown>>(proposalId);
  if (!p || String(p.deal_id) !== dealId || p.status !== "accepted" || !p.accepted_option) {
    return null;
  }
  const rows = await read.listProposalLines<Record<string, unknown>>(proposalId);
  const lines: ProposalLine[] = rows.map((r) => ({
    item_key: r.item_key == null ? null : String(r.item_key),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    quantity: Number(r.quantity) || 0,
    unit: String(r.unit ?? "each") as ProposalLine["unit"],
    unit_price_cents: Number(r.unit_price_cents) || 0,
    recurring: Boolean(r.recurring),
    price_is_from: Boolean(r.price_is_from),
    includes: Array.isArray(r.includes) ? r.includes.map(String) : [],
    excludes: Array.isArray(r.excludes) ? r.excludes.map(String) : [],
    internal_hours: r.internal_hours == null ? null : Number(r.internal_hours),
    needs_discovery: Boolean(r.needs_discovery),
    discount_reason: r.discount_reason == null ? null : String(r.discount_reason),
  }));
  return {
    summary: String(p.summary ?? ""),
    timeline: String(p.timeline ?? ""),
    option: String(p.accepted_option) as PaymentOptionKey,
    lines,
  };
}
