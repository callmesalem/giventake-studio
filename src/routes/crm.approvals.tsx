import { createFileRoute } from "@tanstack/react-router";
import { crmApprovals } from "@/lib/crm-data";
import { PageHeader, DataTable, Badge, EmptyState } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/approvals")({
  loader: () => crmApprovals(),
  component: Approvals,
});

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function Approvals() {
  const rows = Route.useLoaderData();
  return (
    <div>
      <PageHeader
        title="Pending approvals"
        subtitle="Agent-drafted actions waiting for a human decision."
      />
      <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        This is a read-only queue. Approving or rejecting an item does not send, deploy, or take any
        external action on its own; it only records the human decision.
      </p>
      {rows.length === 0 ? (
        <EmptyState>No pending approvals. Nothing is waiting on you.</EmptyState>
      ) : (
        <DataTable
          columns={["Agent", "Action", "Summary", "Risk", "Requested"]}
          rows={rows.map((a) => [
            a.agent_name ?? <span className="text-muted-foreground">—</span>,
            a.action_type ?? <span className="text-muted-foreground">—</span>,
            <span className="block max-w-md truncate">{a.summary ?? "—"}</span>,
            a.risk_level ? (
              <Badge value={a.risk_level} kind="risk" />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            <span className="whitespace-nowrap text-muted-foreground">{when(a.requested_at)}</span>,
          ])}
        />
      )}
    </div>
  );
}
