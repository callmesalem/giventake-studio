import { createFileRoute } from "@tanstack/react-router";
import { crmCompany } from "@/lib/crm-data";
import { Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, LinkedTable, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/companies/$id")({
  loader: ({ params }) => crmCompany({ data: { id: params.id } }),
  component: Company,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Company() {
  const company = Route.useLoaderData();
  return (
    <div>
      <DetailHeader
        backTo="/crm/companies"
        backLabel="Companies"
        title={company.name}
        subtitle={company.location}
        badge={company.source ? <Badge value={company.source} /> : null}
      />
      <DetailLayout
        main={
          <>
            {company.description && (
              <Card title="About">
                <p className="whitespace-pre-wrap text-sm text-foreground">{company.description}</p>
              </Card>
            )}
            <Card title={`Contacts (${company.contacts.length})`}>
              <LinkedTable
                columns={["Name", "Role", "Email"]}
                rows={company.contacts.map((c) => ({
                  href: `/crm/contacts/${c.id}`,
                  cells: [c.name, c.job_title ?? "—", c.email ?? "—"],
                }))}
              />
            </Card>
            <Card title={`Deals (${company.deals.length})`}>
              <LinkedTable
                columns={["Deal", "Stage", "Value"]}
                rows={company.deals.map((d) => ({
                  href: `/crm/deals/${d.id}`,
                  cells: [
                    d.name,
                    d.stage ?? "—",
                    d.value_usd != null ? usd.format(d.value_usd) : "—",
                  ],
                }))}
              />
            </Card>
            <Card title="Activity">
              <Timeline events={company.events} />
            </Card>
          </>
        }
        aside={
          <Card title="Details">
            <FieldList>
              <Field label="Domain">
                {company.domain ? (
                  <a
                    href={`https://${company.domain.replace(/^https?:\/\//, "")}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-2"
                  >
                    {company.domain}
                  </a>
                ) : null}
              </Field>
              <Field label="Location">{company.location}</Field>
              <Field label="Size">{company.employee_range}</Field>
              <Field label="Source">{company.source}</Field>
              <Field label="Added">
                {company.created_at ? new Date(company.created_at).toLocaleDateString() : null}
              </Field>
            </FieldList>
          </Card>
        }
      />
    </div>
  );
}
