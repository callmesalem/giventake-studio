import { createFileRoute } from "@tanstack/react-router";
import { crmDeals } from "@/lib/crm-data";
import { PageHeader, LinkedTable, Badge, useListFilter } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/deals")({
  loader: () => crmDeals(),
  component: Deals,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Deals() {
  const rows = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;
  const { filtered, control } = useListFilter(
    rows,
    (r) => [r.name, r.company, r.stage, r.source].filter(Boolean).join(" "),
    me,
  );
  const pipeline = rows.reduce((total, d) => total + (d.value_usd ?? 0), 0);
  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle={`${rows.length} deals · ${usd.format(pipeline)} pipeline`}
      />
      {control}
      <LinkedTable
        columns={["Deal", "Company", "Stage", "Value", "Source"]}
        rows={filtered.map((d) => ({ href: `/crm/deals/${d.id}`, cells: [
          <span className="font-medium">{d.name}</span>,
          d.company ?? <span className="text-muted-foreground">—</span>,
          d.stage ? <Badge value={d.stage} /> : <span className="text-muted-foreground">—</span>,
          d.value_usd != null ? (
            usd.format(d.value_usd)
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
          d.source ? <Badge value={d.source} /> : <span className="text-muted-foreground">—</span>,
        ] }))}
      />
    </div>
  );
}
