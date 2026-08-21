import { createFileRoute } from "@tanstack/react-router";
import { crmLeads } from "@/lib/crm-data";
import { PageHeader, LinkedTable, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/leads")({
  loader: () => crmLeads(),
  component: Leads,
});

function dash(value: string | null) {
  return value ?? <span className="text-muted-foreground">—</span>;
}

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function Leads() {
  const rows = Route.useLoaderData();
  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${rows.length} leads from the website and inbound sources`}
      />
      <LinkedTable
        columns={["Name", "Company", "Email", "Status", "Source", "Budget", "Score", "Captured"]}
        rows={rows.map((l) => ({ href: `/crm/leads/${l.id}`, cells: [
          <span className="font-medium">{l.name ?? "(no name)"}</span>,
          dash(l.company),
          l.email ? (
            <a href={`mailto:${l.email}`} className="text-primary hover:underline">
              {l.email}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
          l.status ? <Badge value={l.status} /> : <span className="text-muted-foreground">—</span>,
          dash(l.source),
          dash(l.budget),
          l.score ? <Badge value={l.score} /> : <span className="text-muted-foreground">—</span>,
          <span className="whitespace-nowrap text-muted-foreground">{when(l.created_at)}</span>,
        ] }))}
      />
    </div>
  );
}
