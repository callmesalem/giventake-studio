import { createFileRoute } from "@tanstack/react-router";
import { crmMarketing } from "@/lib/crm-data";
import { PageHeader, Card, EmptyState, StatCard, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/marketing")({
  loader: () => crmMarketing(),
  component: Marketing,
});

function Marketing() {
  const { campaigns, subscribers, reviews } = Route.useLoaderData();
  // A quote you may not publish is not a proof asset, so this is the number
  // worth showing rather than the raw review count.
  const publishable = reviews.filter((r) => r.permission_obtained === true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        subtitle="Campaigns, newsletter and reputation."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns" value={campaigns.length} />
        <StatCard
          label="Subscribers"
          value={subscribers.total}
          hint={
            Object.entries(subscribers.byStatus)
              .map(([k, v]) => `${v} ${k}`)
              .join(" · ") || undefined
          }
        />
        <StatCard
          label="Usable reviews"
          value={publishable.length}
          hint={`${reviews.length} recorded`}
        />
      </div>

      <Card title="Campaigns">
        {campaigns.length === 0 ? (
          <EmptyState>
            No campaigns. Nothing sends from the CRM today - drafts stop at
            approval, and Salem sends.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  {c.goal && <p className="text-xs text-muted-foreground">{c.goal}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {c.channel && <Badge value={c.channel} />}
                  {c.status && <Badge value={c.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Newsletter">
        {subscribers.total === 0 ? (
          <EmptyState>
            No subscribers. Every subscriber carries consent_source and
            consent_at, so the list can prove how each address arrived.
          </EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {Object.entries(subscribers.byStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{status}</span>
                <span className="tabular-nums text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Reviews">
        {reviews.length === 0 ? (
          <EmptyState>
            None yet. The site refuses to display proof it does not have, so this
            is the table that unblocks case studies.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {r.author_name ?? "Anonymous"}
                    {r.rating != null && (
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {r.rating}/5
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {r.source && <Badge value={r.source} />}
                    {/* Permission is the gate on using a quote publicly, so it
                        reads as a warning when absent rather than a quiet null. */}
                    {r.permission_obtained === true ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        cleared to publish
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                        no permission on file
                      </span>
                    )}
                  </div>
                </div>
                {r.quote && (
                  <p className="mt-2 text-sm italic text-muted-foreground">&ldquo;{r.quote}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
