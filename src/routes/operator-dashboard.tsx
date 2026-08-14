import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  approveLocalSyntheticDraft,
  getLocalOperatorDashboardSnapshot,
  rejectLocalSyntheticDraft,
} from "@/lib/operator-dashboard";

export const Route = createFileRoute("/operator-dashboard")({
  loader: () => getLocalOperatorDashboardSnapshot(),
  component: OperatorDashboard,
});

type JsonRecord = Record<string, unknown>;
function PendingApproval({ approval, enabled }: { approval: JsonRecord; enabled: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = String(approval.id ?? "");
  const hash = String(approval.payload_hash ?? "");
  const payload = approval.payload as JsonRecord | undefined;
  const draft = payload?.draft;
  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const input = { approvalId: id, expectedPayloadHash: hash, reason };
      if (decision === "approve") await approveLocalSyntheticDraft({ data: input });
      else await rejectLocalSyntheticDraft({ data: input });
      await router.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision failed closed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded border p-4">
      <h3 className="font-semibold">Pending synthetic CRO draft</h3>
      <p className="mt-2 rounded bg-amber-100 p-2 font-semibold text-amber-950">
        Approval only marks this draft reviewed and acceptable for later manual handling. It does
        not send, schedule, authorize outbound, deploy, sign, refund, or change price, scope, or a
        deadline.
      </p>
      <p className="mt-3 break-all font-mono text-xs">
        <strong>Payload hash:</strong> {hash}
      </p>
      <pre className="mt-3 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">
        {JSON.stringify(draft, null, 2)}
      </pre>
      {enabled && (
        <div className="mt-3 grid gap-2">
          <label className="text-sm font-medium" htmlFor={`reason-${id}`}>
            Human decision reason
          </label>
          <textarea
            id={`reason-${id}`}
            className="min-h-20 rounded border p-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
            required
          />
          <div className="flex gap-2">
            <button
              className="rounded bg-green-700 px-3 py-2 text-white"
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void decide("approve")}
            >
              Approve draft only
            </button>
            <button
              className="rounded bg-red-700 px-3 py-2 text-white"
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void decide("reject")}
            >
              Reject draft
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function OperatorDashboard() {
  const { mutationsEnabled, syntheticRunsEnabled, snapshot } = Route.useLoaderData();
  const sections = [
    ["Global state", snapshot.system ? [snapshot.system] : []],
    ["Operators", snapshot.operators],
    ["Synthetic runs", snapshot.runs],
    ["Audit events", snapshot.audit],
  ] as const;
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Synthetic operator control</h1>
      <p className="mt-2">
        Local-only, synthetic-only, no sends or external side effects.{" "}
        {mutationsEnabled
          ? "synthetic draft review mutations explicitly enabled"
          : syntheticRunsEnabled
            ? "read-only (dashboard mutation flag disabled)"
            : "read-only (synthetic runs disabled)"}
        .
      </p>
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Pending approvals ({snapshot.approvals.length})</h2>
        {snapshot.approvals.map((approval) => (
          <PendingApproval
            key={String(approval.id)}
            approval={approval}
            enabled={mutationsEnabled}
          />
        ))}
      </section>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {sections.map(([title, records]) => (
          <section className="rounded border p-4" key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm">{records.length} record(s)</p>
            <pre className="mt-3 max-h-72 overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(records, null, 2)}
            </pre>
          </section>
        ))}
      </div>
    </main>
  );
}
