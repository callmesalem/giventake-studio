import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { crmApprovals, decideCrmApproval, type ApprovalRow } from "@/lib/crm-data";
import { PageHeader, Badge, EmptyState } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/approvals")({
  loader: () => crmApprovals(),
  component: Approvals,
});

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function ApprovalCard({ approval }: { approval: ApprovalRow }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError("");
    try {
      await decideCrmApproval({ data: { id: approval.id, decision, reason } });
      await router.invalidate();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message.replace(/^Error:\s*/, "") : "Decision failed",
      );
      setBusy(null);
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{approval.action_type ?? "Action"}</p>
          <p className="text-xs text-muted-foreground">
            {approval.agent_name ?? "unknown agent"} · requested {when(approval.requested_at)}
          </p>
        </div>
        {approval.risk_level && <Badge value={approval.risk_level} kind="risk" />}
      </div>
      {approval.summary && <p className="mt-3 text-sm text-foreground">{approval.summary}</p>}

      <div className="mt-4 grid gap-2">
        <label
          htmlFor={`reason-${approval.id}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Decision reason (required)
        </label>
        <textarea
          id={`reason-${approval.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy !== null}
          className="min-h-16 rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null || reason.trim().length < 3}
            onClick={() => void decide("approved")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "approved" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy !== null || reason.trim().length < 3}
            onClick={() => void decide("rejected")}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {busy === "rejected" ? "Rejecting…" : "Reject"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </article>
  );
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
        Recording a decision marks it reviewed. It does not send, deploy, or take any external
        action on its own; execution stays a separate, deliberate step.
      </p>
      {rows.length === 0 ? (
        <EmptyState>No pending approvals. Nothing is waiting on you.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {rows.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
    </div>
  );
}
