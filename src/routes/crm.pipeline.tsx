import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { crmPipeline, advanceStage } from "@/lib/crm-data";
import { PageHeader, EmptyState } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/pipeline")({
  loader: () => crmPipeline(),
  component: Pipeline,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface Dragging {
  id: string;
  name: string;
  from: string;
}

function Pipeline() {
  const columns = Route.useLoaderData();
  const router = useRouter();
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // A drop does not move the deal on its own. Crossing a gate requires a stated
  // reason, so the drop opens a note prompt and the move happens on submit.
  const [pending, setPending] = useState<{ deal: Dragging; to: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalValue = columns.reduce((sum, c) => sum + c.total_usd, 0);
  const totalDeals = columns.reduce((sum, c) => sum + c.deals.length, 0);

  async function confirmMove(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await advanceStage({
        data: { dealId: pending.deal.id, toStage: pending.to, note: note.trim() },
      });
      setPending(null);
      setNote("");
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not move that deal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle={`${totalDeals} deals · ${usd.format(totalValue)} total`}
      />

      {pending && (
        <form
          onSubmit={confirmMove}
          className="mb-5 rounded-lg border border-border bg-card p-4"
        >
          <p className="text-sm font-medium text-foreground">
            Move &ldquo;{pending.deal.name}&rdquo; to {pending.to}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {columns.find((c) => c.name === pending.to)?.gate
              ? `Gate: ${columns.find((c) => c.name === pending.to)?.gate}`
              : "This stage has no gate."}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            rows={2}
            placeholder="What satisfied the gate?"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {error && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy || !note.trim()}
              className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Moving…" : "Move deal"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setNote("");
                setError(null);
              }}
              className="rounded-md border border-border px-3.5 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {columns.length === 0 ? (
        <EmptyState>No stages are configured.</EmptyState>
      ) : (
        /* Horizontal scroll with snap: the standard mobile kanban. Columns keep
           a usable width on a phone rather than being crushed to fit. */
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {columns.map((col) => (
            <section
              key={col.name}
              onDragOver={(e) => {
                if (!dragging || dragging.from === col.name) return;
                e.preventDefault();
                setOver(col.name);
              }}
              onDragLeave={() => setOver((c) => (c === col.name ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (!dragging || dragging.from === col.name) return;
                setPending({ deal: dragging, to: col.name });
                setDragging(null);
              }}
              className={
                "w-[264px] flex-none snap-start rounded-lg border bg-card p-3 " +
                (over === col.name ? "border-primary ring-1 ring-primary" : "border-border")
              }
            >
              <header className="mb-3">
                <h2 className="text-sm font-semibold text-foreground">{col.name}</h2>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {col.deals.length} · {usd.format(col.total_usd)}
                </p>
                {col.gate && (
                  <p className="mt-1.5 border-l-2 border-border pl-2 text-[11px] leading-snug text-muted-foreground">
                    {col.gate}
                  </p>
                )}
              </header>

              <div className="space-y-2">
                {col.deals.map((deal) => (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={() =>
                      setDragging({ id: deal.id, name: deal.name, from: col.name })
                    }
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className="cursor-grab rounded-md border border-border bg-background p-2.5 active:cursor-grabbing"
                  >
                    <a
                      href={`/crm/deals/${deal.id}`}
                      className="block text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {deal.name}
                    </a>
                    {deal.company && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.company}</p>
                    )}
                    {deal.value_usd != null && (
                      <p className="mt-1 text-xs font-medium tabular-nums text-foreground">
                        {usd.format(deal.value_usd)}
                      </p>
                    )}
                  </article>
                ))}
                {col.deals.length === 0 && (
                  <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted-foreground">
                    Empty
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
