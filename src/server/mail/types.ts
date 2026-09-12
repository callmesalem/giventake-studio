/**
 * Gmail thread and message HEADERS as the CRM stores them.
 *
 * There is no body type here and there should not be one. Bodies are fetched
 * from Gmail on demand in phase 2 and are never persisted; a body type in this
 * module would be the first step toward a cache nobody decided to build.
 */

/** One inbox row, already joined to whatever CRM record it belongs to. */
export interface InboxThread {
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
  /** Denormalised for the list view, so rendering one screen is one round trip
   *  rather than one plus the number of rows. */
  contactName: string | null;
  dealName: string | null;
  companyName: string | null;
}

/** A raw mail_threads row, as the per-record readers return it. */
export interface MailThreadRow {
  id: string;
  accountId: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string | null;
  unread: boolean;
  labels: string[];
  contactId: string | null;
  dealId: string | null;
  companyId: string | null;
}
