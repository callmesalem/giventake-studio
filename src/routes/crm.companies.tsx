import { createFileRoute } from "@tanstack/react-router";
import { crmCompanies } from "@/lib/crm-data";
import { PageHeader, DataTable, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/companies")({
  loader: () => crmCompanies(),
  component: Companies,
});

function Companies() {
  const rows = Route.useLoaderData();
  return (
    <div>
      <PageHeader title="Companies" subtitle={`${rows.length} companies`} />
      <DataTable
        columns={["Name", "Domain", "Location", "Size", "Source"]}
        rows={rows.map((c) => [
          <span className="font-medium">{c.name}</span>,
          c.domain ? (
            <a
              href={`https://${c.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {c.domain}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
          c.location ?? <span className="text-muted-foreground">—</span>,
          c.employee_range ?? <span className="text-muted-foreground">—</span>,
          c.source ? <Badge value={c.source} /> : <span className="text-muted-foreground">—</span>,
        ])}
      />
    </div>
  );
}
