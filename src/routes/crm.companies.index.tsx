import { createFileRoute } from "@tanstack/react-router";
import { crmCompanies, saveCompany } from "@/lib/crm-data";
import {
  PageHeader,
  LinkedTable,
  Badge,
  EntityForm,
  Disclosure,
  useListFilter,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/companies/")({
  loader: () => crmCompanies(),
  component: Companies,
});

function Companies() {
  const rows = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;
  const { filtered, control } = useListFilter(
    rows,
    (r) => [r.name, r.domain, r.location, r.source].filter(Boolean).join(" "),
    me,
  );
  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle={`${rows.length} companies`}
        action={
          <Disclosure label="New company" openLabel="New company">
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "domain", label: "Domain", placeholder: "example.com" },
                { name: "location", label: "Location" },
                { name: "employeeRange", label: "Size", placeholder: "1-10" },
              ]}
              submitLabel="Create company"
              columns={2}
              onSubmit={(data) => saveCompany({ data })}
            />
          </Disclosure>
        }
      />
      {control}
      <LinkedTable
        columns={["Name", "Domain", "Location", "Size", "Source"]}
        rows={filtered.map((c) => ({
          href: `/crm/companies/${c.id}`,
          cells: [
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
            c.source ? (
              <Badge value={c.source} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          ],
        }))}
      />
    </div>
  );
}
