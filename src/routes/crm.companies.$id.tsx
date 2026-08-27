import { createFileRoute, useRouter } from "@tanstack/react-router";
import { crmCompany, addNote, saveCompany, saveContact, saveDeal, assignRecord } from "@/lib/crm-data";
import { listAssignableMembers } from "@/lib/crm-auth";
import {
  Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, LinkedTable, Badge,
  EntityForm, Disclosure, OwnerPicker,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/companies/$id")({
  loader: async ({ params }) => ({
    company: await crmCompany({ data: { id: params.id } }),
    members: (await listAssignableMembers()).members,
  }),
  component: Company,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const COMPANY_FIELDS = [
  { name: "name", label: "Name", required: true },
  { name: "domain", label: "Domain", placeholder: "example.com" },
  { name: "location", label: "Location" },
  { name: "employeeRange", label: "Size", placeholder: "1-10" },
  { name: "description", label: "Description", type: "textarea" as const, rows: 3 },
];

function Company() {
  const { company, members } = Route.useLoaderData();
  const router = useRouter();
  return (
    <div>
      <DetailHeader
        backTo="/crm/companies"
        backLabel="Companies"
        title={company.name}
        subtitle={company.location}
        badge={company.source ? <Badge value={company.source} /> : null}
        action={
          <Disclosure label="Edit" openLabel={`Edit ${company.name}`}>
            <EntityForm
              fields={COMPANY_FIELDS}
              values={company as unknown as Record<string, unknown>}
              submitLabel="Save changes"
              columns={2}
              onSubmit={(data) => saveCompany({ data: { ...data, id: company.id } })}
            />
          </Disclosure>
        }
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
              <div className="mb-4">
                <Disclosure label="Add contact" openLabel="New contact">
                  <EntityForm
                    fields={[
                      { name: "name", label: "Name", required: true },
                      { name: "jobTitle", label: "Role" },
                      { name: "email", label: "Email", type: "email" },
                      { name: "phone", label: "Phone", type: "tel" },
                    ]}
                    submitLabel="Add contact"
                    columns={2}
                    onSubmit={(data) => saveContact({ data: { ...data, companyId: company.id } })}
                  />
                </Disclosure>
              </div>
              <LinkedTable
                columns={["Name", "Role", "Email"]}
                rows={company.contacts.map((c) => ({
                  href: `/crm/contacts/${c.id}`,
                  cells: [c.name, c.job_title ?? "—", c.email ?? "—"],
                }))}
              />
            </Card>
            <Card title={`Deals (${company.deals.length})`}>
              <div className="mb-4">
                <Disclosure label="Add deal" openLabel="New deal">
                  <EntityForm
                    fields={[
                      { name: "name", label: "Deal name", required: true },
                      { name: "valueUsd", label: "Value (USD)", type: "number" },
                    ]}
                    submitLabel="Add deal"
                    columns={2}
                    onSubmit={(data) => saveDeal({ data: { ...data, companyId: company.id } })}
                  />
                </Disclosure>
              </div>
              <LinkedTable
                columns={["Deal", "Stage", "Value"]}
                rows={company.deals.map((d) => ({
                  href: `/crm/deals/${d.id}`,
                  cells: [d.name, d.stage ?? "—", d.value_usd != null ? usd.format(d.value_usd) : "—"],
                }))}
              />
            </Card>

            <Card title="Activity">
              <div className="mb-4">
                <Disclosure label="Add note" openLabel="Add a note">
                  <EntityForm
                    fields={[
                      { name: "title", label: "Title", placeholder: "Optional" },
                      { name: "content", label: "Note", type: "textarea", required: true, rows: 4 },
                    ]}
                    submitLabel="Save note"
                    onSubmit={(data) => addNote({ data: { ...data, companyId: company.id } })}
                  />
                </Disclosure>
              </div>
              <Timeline events={company.events} />
            </Card>
          </>
        }
        aside={
          <>
          <Card title="Assignment">
            <OwnerPicker
              members={members}
              value={company.owner_id}
              onChange={(userId) =>
                assignRecord({
                  data: { table: "companies", column: "owner_id", id: company.id, userId: userId ?? "" },
                }).then(() => router.invalidate())
              }
            />
          </Card>
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
          </>
        }
      />
    </div>
  );
}
