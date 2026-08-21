import { createFileRoute } from "@tanstack/react-router";
import { crmLead } from "@/lib/crm-data";
import { Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/leads/$id")({
  loader: ({ params }) => crmLead({ data: { id: params.id } }),
  component: Lead,
});

function Lead() {
  const lead = Route.useLoaderData();
  return (
    <div>
      <DetailHeader
        backTo="/crm/leads"
        backLabel="Leads"
        title={lead.name ?? lead.email ?? "Lead"}
        subtitle={lead.company}
        badge={lead.status ? <Badge value={lead.status} /> : null}
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
