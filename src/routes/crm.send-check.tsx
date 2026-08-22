import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { sendPreflight, DISCLOSURE_FOOTER, type PreflightVM } from "@/lib/crm-data";
import { PageHeader, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/send-check")({
  component: SendCheck,
});

function SendCheck() {
  const [result, setResult] = useState<PreflightVM | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    setBusy(true);
    setError(null);
    try {
      setResult(await sendPreflight({ data }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run the check.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send check"
        subtitle="What would happen if this message were sent right now."
      />

      <Card>
        <form onSubmit={run} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="to" className="block text-xs font-medium">Recipient</label>
              <input
                id="to" name="to" type="email" required
                placeholder="someone@example.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sop" className="block text-xs font-medium">SOP</label>
              <input
                id="sop" name="sop" required defaultValue="02-sales-pipeline"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="body" className="block text-xs font-medium">Message</label>
            <textarea
              id="body" name="body" required rows={8}
              defaultValue={`Hello,\n\n\n\n${DISCLOSURE_FOOTER}`}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Checking…" : "Run check"}
          </button>
        </form>
      </Card>

      {result && (
        <Card title={result.sendable ? "Would send" : "Would not send"}>
          <ul className="space-y-3">
            {result.gates.map((gate) => (
              <li key={gate.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={
                    "mt-1 h-2.5 w-2.5 flex-none rounded-full " +
                    (gate.pass ? "bg-emerald-500" : "bg-red-500")
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {gate.label}{" "}
                    <span className={gate.pass ? "text-emerald-700" : "text-red-700"}>
                      {gate.pass ? "pass" : "blocked"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{gate.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
