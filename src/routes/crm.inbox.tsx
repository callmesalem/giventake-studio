import { createFileRoute } from "@tanstack/react-router";
import { listInbox, type InboxVM, type InboxThreadVM } from "@/lib/mail-data";
import { senderLabel, relativeTime, threadTitle } from "@/lib/mail-format";
import { PageHeader, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/inbox")({
  loader: async () => ({ inbox: await listInbox() }),
  component: Inbox,
});

function Inbox() {
  const { inbox } = Route.useLoaderData();
  return (
    <div>
      <PageHeader title="Inbox" />
      <Card title={inbox.accountEmail || "Mail"}>
        <InboxBody vm={inbox} />
      </Card>
    </div>
  );
}

/**
 * Five states, deliberately distinct. "The migration is not applied", "a
 * mailbox is connected but its token was rejected", "a mailbox is connected
 * but switched off", "no mailbox is connected" and "no mail yet" all look
 * identical as an empty list, and an operator has to be able to tell which
 * one they are looking at.
 *
 * `reauth_required` and `disabled` are both checked before `!vm.connected`:
 * a mailbox in either state has `connected: false` too, so those messages
 * would be unreachable if the order were swapped.
 */
function InboxBody({ vm }: { vm: InboxVM }) {
  if (!vm.available) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        Mail storage is not reachable from this environment, so threads cannot be listed. The mail
        migration may not be applied yet. Nothing has been lost.
      </p>
    );
  }
  if (vm.accountStatus === "reauth_required") {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        Mail is connected to {vm.accountEmail || "this mailbox"}, but the connection needs renewing.
        Nothing has synced since it lapsed. Reconnect on the VPS to resume.
      </p>
    );
  }
  if (vm.accountStatus === "disabled") {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        Mail for {vm.accountEmail || "this mailbox"} is switched off. Nothing is syncing. Turn it
        back on from the VPS to resume.
      </p>
    );
  }
  if (!vm.connected) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        No mailbox is connected yet. Connect one on the VPS to start syncing threads.
      </p>
    );
  }
  if (!vm.threads.length) {
    return (
      <p className="text-sm" style={{ color: "var(--gt-secondary)" }}>
        No threads synced yet. The poller writes them as it reads them.
      </p>
    );
  }
  return (
    <ul className="divide-y" style={{ borderColor: "var(--gt-surface)" }}>
      {vm.threads.map((t) => (
        <li key={t.id}>
          <ThreadRow thread={t} accountEmail={vm.accountEmail} />
        </li>
      ))}
    </ul>
  );
}

function ThreadRow({ thread, accountEmail }: { thread: InboxThreadVM; accountEmail: string }) {
  const record = thread.dealName ?? thread.companyName ?? thread.contactName;
  return (
    <div className="flex items-baseline gap-3 py-2">
      <span
        className="w-48 shrink-0 truncate text-sm"
        style={{
          color: "var(--gt-ink)",
          fontWeight: thread.unread ? 600 : 400,
        }}
      >
        {senderLabel(thread.participants, accountEmail)}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        <span style={{ color: "var(--gt-ink)", fontWeight: thread.unread ? 600 : 400 }}>
          {threadTitle(thread.subject)}
        </span>
        {thread.snippet && (
          <span style={{ color: "var(--gt-secondary)" }}> &middot; {thread.snippet}</span>
        )}
      </span>

      {/* The reason to read mail here rather than in Gmail. */}
      {record && (
        <span
          className="shrink-0 truncate rounded px-1.5 py-0.5 text-xs"
          style={{
            background: "var(--gt-surface)",
            color: "var(--gt-secondary)",
            maxWidth: "12rem",
          }}
        >
          {record}
        </span>
      )}

      <span
        className="gt-nums w-14 shrink-0 text-right text-xs"
        style={{ color: "var(--gt-secondary)" }}
      >
        {relativeTime(thread.lastMessageAt)}
      </span>
    </div>
  );
}
