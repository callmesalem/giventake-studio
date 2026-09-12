/**
 * The inbox's server functions.
 *
 * This lives in src/lib/ beside documents-data.ts, and NOT in src/server/mail/
 * where the rest of the feature lives, because it has to: the build denies any
 * import of src/server/* from the client environment, and a server function's
 * declaration is imported by the component that calls it. The server-only
 * modules are reached below by dynamic import().
 *
 * Phase 1 is READ ONLY. There is no compose, no send, and no Gmail call from
 * the Worker at all: these rows come from Postgres, written there by the VPS
 * poller. The Worker cannot decrypt a refresh token and therefore cannot reach
 * Gmail even if a future edit tried to.
 */
import { createServerFn } from "@tanstack/react-start";

export interface InboxThreadVM {
  id: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string | null;
  unread: boolean;
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
  contactName: string | null;
  dealName: string | null;
  companyName: string | null;
}

export interface InboxVM {
  /**
   * False when the mail schema could not be reached at all. Distinct from
   * `connected` and from an empty list, because "the migration is not applied",
   * "no mailbox is connected" and "no mail yet" are three different answers and
   * an operator has to be able to tell which one they are looking at.
   */
  available: boolean;
  /** False when the schema is reachable but no mailbox has been connected. */
  connected: boolean;
  /** The connected mailbox's status, or null when none is connected.
   *  'reauth_required' means a mailbox exists but its token was rejected,
   *  which is not the same as having no mailbox. */
  accountStatus: string | null;
  accountEmail: string;
  threads: InboxThreadVM[];
}

export const listInbox = createServerFn({ method: "GET" }).handler(async (): Promise<InboxVM> => {
  const { forInbox } = await import("@/server/mail/access");
  const { store } = await forInbox();

  try {
    const [account, threads] = await Promise.all([
      store.accountStatus(),
      store.listInbox(50, 0),
    ]);

    return {
      available: true,
      // From the database, not the environment. An env var can say "connected"
      // while mail_accounts holds no row, or holds one whose token was rejected.
      connected: account?.status === "connected",
      accountStatus: account?.status ?? null,
      accountEmail: account?.email ?? "",
      threads,
    };
  } catch {
    // Nothing is logged: these rows carry client names and subject lines.
    // The UI says the mail store is unreachable, which is all an operator can
    // act on anyway.
    return { available: false, connected: false, accountStatus: null, accountEmail: "", threads: [] };
  }
});
