import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { crmDeals, crmCompanyOptions, crmStages, saveDeal } from "@/lib/crm-data";
import {
  PageHeader,
  LinkedTable,
  Badge,
  useListFilter,
  EntityForm,
  Disclosure,
  Card,
} from "@/components/crm/ui";
import { SALES_STAGES } from "@/lib/sales-playbook";

export const Route = createFileRoute("/crm/deals/")({
  loader: async () => ({
    rows: await crmDeals(),
    companies: await crmCompanyOptions(),
    stages: await crmStages(),
  }),
  component: Deals,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Deals() {
  const { rows, companies, stages } = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;
  const { filtered, control } = useListFilter(
    rows,
    (r) => [r.name, r.company, r.stage, r.source].filter(Boolean).join(" "),
    me,
  );
  const pipeline = rows.reduce((total, d) => total + (d.value_usd ?? 0), 0);
  const stageCounts = new Map<string, number>();
  for (const deal of rows) {
    const key = deal.stage?.toLowerCase() ?? "";
    stageCounts.set(key, (stageCounts.get(key) ?? 0) + 1);
  }
  const stageAliases: Record<string, number> = {
    new: 1,
    qualified: 1,
    discovery: 2,
    proposal: 3,
    scoped: 3,
    negotiation: 4,
    won: 5,
    kickoff: 5,
    building: 6,
    delivery: 7,
    acceptance: 8,
    handoff: 9,
    support: 10,
  };
  const activeGuides = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count, guide: SALES_STAGES[stageAliases[stage] ?? 1] }))
    .slice(0, 3);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        subtitle={`${rows.length} deals · ${usd.format(pipeline)} pipeline`}
        action={
          <Disclosure label="New deal" openLabel="New deal">
            <EntityForm
              fields={[
                { name: "name", label: "Deal name", required: true },
                {
                  name: "companyId",
                  label: "Company",
                  type: "select" as const,
                  options: companies.map((c) => ({ value: c.id, label: c.name })),
                },
                {
                  name: "stage",
                  label: "Stage",
                  type: "select" as const,
                  options: stages.map((st) => ({ value: st.name, label: st.name })),
                },
                { name: "valueUsd", label: "Value (USD)", type: "number" as const },
              ]}
              submitLabel="Create deal"
              columns={2}
              onSubmit={(data) => saveDeal({ data })}
            />
          </Disclosure>
        }
      />
      {control}
      <LinkedTable
        columns={["Deal", "Company", "Stage", "Value", "Source"]}
        rows={filtered.map((d) => ({
          href: `/crm/deals/${d.id}`,
          cells: [
            <span className="font-medium">{d.name}</span>,
            d.company ?? <span className="text-muted-foreground">—</span>,
            d.stage ? <Badge value={d.stage} /> : <span className="text-muted-foreground">—</span>,
            d.value_usd != null ? (
              usd.format(d.value_usd)
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            d.source ? (
              <Badge value={d.source} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          ],
        }))}
      />
      {activeGuides.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Suggested next moves</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {activeGuides.map(({ stage, count, guide }) => (
              <Card key={stage}>
                <div className="flex items-center justify-between gap-3">
                  <Badge value={stage || "unassigned"} />
                  <span className="text-xs text-muted-foreground">
                    {count} deal{count === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium">{guide.actions[0]}</p>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                  “{guide.prompt}”
                </p>
                <Link
                  to="/crm/playbook"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Open stage guide <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
