/**
 * Server-only access helpers for the mail surface.
 *
 * These live under src/server/ rather than beside the server functions in
 * src/lib/mail-data.ts for the reason src/server/documents/deal-access.ts
 * records: mail-data.ts is client-reachable, so a plain helper defined there
 * that reaches src/server/* joins the client module graph and the
 * import-protection plugin denies it, even when the reach is a dynamic
 * import(). Reached only by dynamic import() from the stripped handlers, these
 * stay off the client graph entirely.
 */
import { requireCrmSession } from "@/lib/crm-auth.server";
import { createSupabaseMailStore } from "@/server/mail/store";

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

/**
 * Session plus a mail store.
 *
 * Phase 1 shows one shared mailbox, so there is no per-record scoping to apply
 * here yet: every signed-in operator sees the same inbox. When the mailbox
 * model becomes per-user, this is the function that gains the scoping, which is
 * why the route goes through it rather than constructing a store itself.
 */
export async function forInbox() {
  const session = await requireCrmSession();
  return { session, store: createSupabaseMailStore(config()) };
}

/** The connected mailbox address, for the sender column. Read from the
 *  environment rather than the database because the list view needs it on
 *  every render and it does not change. */
export function accountEmail(): string {
  return process.env.MAIL_ACCOUNT_EMAIL ?? "";
}
