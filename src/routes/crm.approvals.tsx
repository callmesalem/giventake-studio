import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { crmApprovals, decideCrmApproval, type ApprovalRow } from "@/lib/crm-data";
import { PageHeader, Badge, EmptyState } from "@/components/crm/ui";
import { isExecutableAction } from "@/lib/approval-actions";

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
  const [outcome, setOutcome] = useState<string>("");

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError("");
    setOutcome("");
    try {
      const result = await decideCrmApproval({ data: { id: approval.id, decision, reason } });
      // A refusal after approval is not an error and must not be silent: an
      // operator who clicked Approve and saw nothing would assume it worked.
      if (result.execution && !result.execution.ok) {
        setOutcome(
          "detail" in result.execution
            ? result.execution.detail
            : "Approved, but the CRM did not carry it out.",
        );
        setBusy(null);
        return;
      }
      // recorded: false means the action really happened but the record of it
      // failed to write. The approval will never appear in this queue again,
      // so silence here would leave the operator thinking it is still pending.
      if (result.execution && result.execution.ok && result.execution.recorded === false) {
        setOutcome(
          "The deal was advanced, but recording the approval failed. It will not appear in this queue again.",
        );
        setBusy(null);
        return;
      }
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
      <ProposalDetail approval={approval} />

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
        {outcome && (
          <p role="alert" className="mt-3 text-sm text-amber-800">
            {outcome}
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

/**
 * What is actually being approved.
 *
 * Before this, the card showed a summary only, so an operator approved a
 * description rather than the artifact. For a deal_close that means seeing
 * which deal and the note that will be recorded as evidence the gate was met.
 */
function ProposalDetail({ approval }: { approval: ApprovalRow }) {
  const payload =
    approval.proposed_payload && typeof approval.proposed_payload === "object"
      ? (approval.proposed_payload as Record<string, unknown>)
      : null;

  if (!isExecutableAction(approval.action_type)) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          The CRM cannot carry this out. Approving records your decision; someone still has to do
          the work.
        </p>
        {payload && (
          <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
            {JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (approval.action_type === "deal_close") {
    const note = typeof payload?.note === "string" ? payload.note : "";
    return (
      <div className="mt-3 rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground">Advances this deal to Close</p>
        <p className="mt-1 break-words font-mono text-xs">
          {approval.target_id ?? "no deal named"}
        </p>
        {note && <p className="mt-2 break-words text-sm text-foreground">{note}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Close still requires a signed SOW. Approving does not skip that check.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Recognised, but the CRM cannot carry this out yet. Approving records your decision; someone
        still has to do the work.
      </p>
      {payload && (
        <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
