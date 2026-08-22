import { createFileRoute, useRouter } from "@tanstack/react-router";
import { crmLead, assignRecord, convertLead, crmStages } from "@/lib/crm-data";
import { listAssignableMembers } from "@/lib/crm-auth";
import {
  Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, Badge, OwnerPicker,
  EntityForm, Disclosure,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/leads/$id")({
  loader: async ({ params }) => ({
    lead: await crmLead({ data: { id: params.id } }),
    members: (await listAssignableMembers()).members,
    stages: await crmStages(),
  }),
  component: Lead,
});

function Lead() {
  const { lead, members, stages } = Route.useLoaderData();
  const router = useRouter();
  return (
    <div>
      <DetailHeader
        backTo="/crm/leads"
        backLabel="Leads"
        title={lead.name ?? lead.email ?? "Lead"}
        subtitle={lead.company}
        badge={lead.status ? <Badge value={lead.status} /> : null}
        action={
          lead.status === "converted" ? null : (
            <Disclosure label="Convert to deal" openLabel="Convert this lead">
              <p className="mb-3 text-xs text-muted-foreground">
                Creates a company and contact from this lead, opens a deal, and
                links the deal back to the lead so attribution can follow it
                through to revenue.
              </p>
              <EntityForm
                fields={[
                  {
                    name: "dealName",
                    label: "Deal name",
                    required: true,
                  },
                  {
                    name: "stage",
                    label: "Stage",
                    type: "select" as const,
                    options: stages.map((st) => ({ value: st.name, label: st.name })),
                  },
                  { name: "valueUsd", label: "Value (USD)", type: "number" as const },
                ]}
                values={{
                  dealName: lead.company
                    ? `${lead.company} — ${lead.budget ?? "project"}`
                    : (lead.name ?? "New deal"),
                }}
                submitLabel="Convert"
                columns={2}
                onSubmit={(data) => convertLead({ data: { ...data, leadId: lead.id } })}
              />
            </Disclosure>
          )
        }
      />
      <DetailLayout
        main={
          <>
            <Card title="Enquiry">
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {lead.description ?? <span className="text-muted-foreground">No description given.</span>}
              </p>
            </Card>
            <Card title="Activity">
              <Timeline events={lead.events} />
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Assignment">
              <OwnerPicker
                members={members}
                value={lead.owner_id}
                onChange={(userId) =>
                  assignRecord({
                    data: { table: "leads", column: "owner_id", id: lead.id, userId: userId ?? "" },
                  }).then(() => router.invalidate())
                }
              />
            </Card>
            <Card title="Details">
              <FieldList>
                <Field label="Email">{lead.email}</Field>
                <Field label="Budget">{lead.budget}</Field>
                <Field label="Timeline">{lead.timeline}</Field>
                <Field label="Source">{lead.source}</Field>
                <Field label="Source detail">{lead.source_detail}</Field>
                <Field label="First seen">
                  {lead.created_at ? new Date(lead.created_at).toLocaleString() : null}
                </Field>
                <Field label="Last touch">
                  {lead.last_touch_at ? new Date(lead.last_touch_at).toLocaleString() : null}
                </Field>
              </FieldList>
            </Card>

            {/* Consent is shown as evidence, not a checkbox: what they agreed
                to and when, in the words they were shown. */}
            <Card title="Consent">
              <FieldList>
                <Field label="Given">
                  {lead.consent_given === null ? (
                    <span className="text-muted-foreground">
                      Not recorded &mdash; captured before consent was stored
                    </span>
                  ) : lead.consent_given ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </Field>
                <Field label="When">
                  {lead.consent_at ? new Date(lead.consent_at).toLocaleString() : null}
                </Field>
                <Field label="Wording shown">{lead.consent_text}</Field>
              </FieldList>
            </Card>
          </>
        }
      />
    </div>
  );
}
