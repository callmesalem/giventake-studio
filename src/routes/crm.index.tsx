import { createFileRoute } from "@tanstack/react-router";
import { crmDashboard } from "@/lib/crm-data";
import { PageHeader, StatCard, Card, EmptyState, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/")({
  loader: () => crmDashboard(),
  component: Overview,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Overview() {
  const d = Route.useLoaderData();
  const { openTasks, pendingApprovals, staleDeals } = d.needsYou;
  const quiet = openTasks.length === 0 && pendingApprovals === 0 && staleDeals.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />

      {/* What needs a decision comes first. Counts are context; this is the
          part of a dashboard that should change behaviour. */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Needs you
        </h2>
        {quiet ? (
          <EmptyState>Nothing is waiting on you.</EmptyState>
        ) : (
          <div className="space-y-3">
            {pendingApprovals > 0 && (
              <Card>
                <a
                  href="/crm/approvals"
                  className="text-sm font-medium underline-offset-2 hover:underline"
                >
                  {pendingApprovals} approval{pendingApprovals === 1 ? "" : "s"} waiting
                </a>
              </Card>
            )}

            {openTasks.map((task) => {
              const overdue = task.deadline_at ? new Date(task.deadline_at) < new Date() : false;
              return (
                <Card key={task.id}>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {task.content.length > 320 ? task.content.slice(0, 320) + "…" : task.content}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.source && <Badge value={task.source} />}
                    {task.deadline_at && (
                      <span className={overdue ? "font-semibold text-red-600" : ""}>
                        Due {new Date(task.deadline_at).toLocaleDateString()}
                        {overdue ? " · overdue" : ""}
                      </span>
                    )}
                    <a href="/crm/tasks" className="underline underline-offset-2">
                      Open tasks
                    </a>
                  </div>
                </Card>
              );
            })}

            {staleDeals.length > 0 && (
              <Card title={`Gone quiet (${staleDeals.length})`}>
                <ul className="space-y-1.5">
                  {staleDeals.map((deal) => (
                    <li key={deal.id} className="flex items-center justify-between gap-3 text-sm">
                      <a
                        href={`/crm/deals/${deal.id}`}
                        className="min-w-0 truncate underline-offset-2 hover:underline"
                      >
                        {deal.name}
                      </a>
                      <span className="flex-none tabular-nums text-muted-foreground">
                        {deal.days}d
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pipeline"
          value={usd.format(d.totals.pipelineUsd)}
          hint={`${d.totals.deals} deals`}
        />
        <StatCard label="Companies" value={d.totals.companies} />
        <StatCard label="Leads" value={d.totals.leads} />
        <StatCard label="Approvals" value={pendingApprovals} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Pipeline by stage">
          {d.pipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals in any stage yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.pipeline.map((stage) => (
                <li key={stage.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">{stage.name}</span>
                  <span className="flex-none tabular-nums text-foreground">
                    {stage.count} · {usd.format(stage.total_usd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Which channel produced paying clients. The question the referral
            loop and the sourcing agent both exist to answer. */}
        <Card title="Where clients come from">
          {d.attribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No leads recorded yet, so there is nothing to attribute.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[340px] text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 text-left font-medium">Source</th>
                    <th className="py-1 text-right font-medium">Leads</th>
                    <th className="py-1 text-right font-medium">Deals</th>
                    <th className="py-1 text-right font-medium">Clients</th>
                    <th className="py-1 text-right font-medium">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {d.attribution.map((row) => (
                    <tr key={row.source} className="border-t border-border">
                      <td className="py-1.5">{row.source}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.leads}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.deals}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.clients}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {usd.format(row.valueWonUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
