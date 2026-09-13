import type { InboxThread, MailThreadRow } from "./types.ts";

export interface MailStore {
  listInbox(limit: number, offset: number): Promise<InboxThread[]>;
  threadsForDeal(dealId: string): Promise<MailThreadRow[]>;
  threadsForContact(contactId: string): Promise<MailThreadRow[]>;
  /** The connected mailbox's identity and health, or null when none is
   *  connected. Deliberately returns no token: this is the app's half. */
  accountStatus(): Promise<{ email: string; status: string } | null>;
}

interface InboxJson {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[] | null;
  message_count: number;
  last_message_at: string | null;
  unread: boolean;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_name: string | null;
  deal_name: string | null;
  company_name: string | null;
}

interface ThreadJson {
  id: string;
  account_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: string[] | null;
  message_count: number;
  last_message_at: string | null;
  unread: boolean;
  labels: string[] | null;
  contact_id: string | null;
  deal_id: string | null;
  company_id: string | null;
}

/**
 * PostgREST adapter. Same posture as src/server/documents/store.ts: every call
 * is a narrow SECURITY DEFINER RPC granted only to service_role, and the key
 * stays server-side.
 *
 * Deliberately absent: every function in the agent half of the contract
 * (mail_account_for_sync, mail_sync_upsert_*, mail_account_set_history_id).
 * The app writes no mail and reads no token, and this omission is what makes
 * that impossible to do by accident from here.
 *
 * Nothing catches. A failed call must reach the caller; a swallowed error would
 * render an empty inbox that looks like "no mail" rather than "could not tell".
 */
export function createSupabaseMailStore(config: {
  url: string;
  serviceRoleKey: string;
  fetch?: typeof globalThis.fetch;
}): MailStore {
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
    if (!response.ok) throw new Error(`mail rpc ${name} failed: ${response.status}`);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  function toThread(row: ThreadJson): MailThreadRow {
    return {
      id: row.id,
      accountId: row.account_id,
      gmailThreadId: row.gmail_thread_id,
      subject: row.subject,
      snippet: row.snippet,
      participants: row.participants ?? [],
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at,
      unread: row.unread,
      labels: row.labels ?? [],
      contactId: row.contact_id,
      dealId: row.deal_id,
      companyId: row.company_id,
    };
  }

  return {
    async listInbox(limit, offset) {
      const rows = await rpc<InboxJson[]>("mail_inbox_list", {
        p_limit: limit,
        p_offset: offset,
      });
      return (rows ?? []).map((row) => ({
        id: row.id,
        gmailThreadId: row.gmail_thread_id,
        subject: row.subject,
        snippet: row.snippet,
        participants: row.participants ?? [],
        messageCount: row.message_count,
        lastMessageAt: row.last_message_at,
        unread: row.unread,
        contactId: row.contact_id,
        dealId: row.deal_id,
        companyId: row.company_id,
        contactName: row.contact_name,
        dealName: row.deal_name,
        companyName: row.company_name,
      }));
    },

    async threadsForDeal(dealId) {
      const rows = await rpc<ThreadJson[]>("mail_threads_for_deal", { p_deal_id: dealId });
      return (rows ?? []).map(toThread);
    },

    async threadsForContact(contactId) {
      const rows = await rpc<ThreadJson[]>("mail_threads_for_contact", {
        p_contact_id: contactId,
      });
      return (rows ?? []).map(toThread);
    },

    async accountStatus() {
      const rows = await rpc<{ email: string; status: string }[]>("mail_account_status");
      return rows?.[0] ?? null;
    },
  };
}
