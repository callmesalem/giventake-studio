import { createFileRoute } from "@tanstack/react-router";
import { crmClients } from "@/lib/crm-data";
import { PageHeader, Card, EmptyState, StatCard, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/clients")({
  loader: () => crmClients(),
  component: Clients,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => usd.format(cents / 100);

function Clients() {
  const { clients, invoicedCents, paidCents } = Route.useLoaderData();
  const outstanding = invoicedCents - paidCents;

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" subtitle="Stages 5-11: kickoff through retro." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Clients" value={clients.length} />
        <StatCard label="Invoiced" value={money(invoicedCents)} />
        <StatCard label="Outstanding" value={money(outstanding)} hint={`${money(paidCents)} paid`} />
      </div>

      {clients.length === 0 ? (
        <EmptyState>
          No clients yet. A deal becomes a client at stage 4, when it is signed and paid.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <Card key={client.id} title={client.name}>
              {client.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {client.projects.map((p) => (
                    <li key={p.id} className="text-foreground">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
              {client.invoices.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                  {client.invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {i.status && <Badge value={i.status} />}
                        {i.paid_at && (
                          <span className="text-xs text-muted-foreground">
                            paid {new Date(i.paid_at).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {i.amount_cents != null ? money(i.amount_cents) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
