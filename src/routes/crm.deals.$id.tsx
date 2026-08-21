import { createFileRoute } from "@tanstack/react-router";
import { crmDeal } from "@/lib/crm-data";
import { Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/deals/$id")({
  loader: ({ params }) => crmDeal({ data: { id: params.id } }),
  component: Deal,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Deal() {
  const deal = Route.useLoaderData();
  return (
    <div>
      <DetailHeader
        backTo="/crm/deals"
        backLabel="Deals"
        title={deal.name}
        subtitle={
          deal.company ? (
            <a href={`/crm/companies/${deal.company.id}`} className="underline underline-offset-2">
              {deal.company.name}
            </a>
          ) : null
        }
        badge={deal.stage ? <Badge value={deal.stage} /> : null}
      />
      <DetailLayout
        main={
          <>
            {/* The gate for this stage, surfaced on the record. A gate written
                in a document nobody opens is not a control. */}
            {deal.stageGate && (deal.stageGate.gate || deal.stageGate.artifact) && (
              <Card title="This stage">
                <FieldList>
                  <Field label="Artifact">{deal.stageGate.artifact}</Field>
                  <Field label="Gate to pass">{deal.stageGate.gate}</Field>
                </FieldList>
              </Card>
            )}
            <Card title="Activity">
              <Timeline events={deal.events} />
            </Card>
          </>
        }
        aside={
          <Card title="Details">
            <FieldList>
              <Field label="Value">{deal.value_usd != null ? usd.format(deal.value_usd) : null}</Field>
              <Field label="Stage">{deal.stage}</Field>
              <Field label="Source">{deal.source}</Field>
              <Field label="Originating lead">
                {deal.lead ? (
                  <a href={`/crm/leads/${deal.lead.id}`} className="underline underline-offset-2">
                    {deal.lead.name ?? deal.lead.email ?? "Lead"}
                  </a>
                ) : null}
              </Field>
              <Field label="Closed">
                {deal.closed_at ? new Date(deal.closed_at).toLocaleDateString() : null}
              </Field>
              <Field label="Lost reason">{deal.lost_reason}</Field>
              <Field label="Created">
                {deal.created_at ? new Date(deal.created_at).toLocaleDateString() : null}
              </Field>
            </FieldList>
          </Card>
        }
      />
    </div>
  );
}
