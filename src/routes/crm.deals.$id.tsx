import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  crmDeal, crmStages, advanceStage, saveDeal, assignRecord, addNote, convertDealToClient,
} from "@/lib/crm-data";
import { listAssignableMembers } from "@/lib/crm-auth";
import {
  Card, DetailHeader, DetailLayout, Field, FieldList, Timeline, Badge,
  EntityForm, Disclosure, OwnerPicker,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/deals/$id")({
  loader: async ({ params }) => ({
    deal: await crmDeal({ data: { id: params.id } }),
    stages: await crmStages(),
    members: (await listAssignableMembers()).members,
  }),
  component: Deal,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Deal() {
  const { deal, stages, members } = Route.useLoaderData();
  const router = useRouter();
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
        action={
          <Disclosure label="Edit" openLabel={`Edit ${deal.name}`}>
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "valueUsd", label: "Value (USD)", type: "number" },
              ]}
              values={{ name: deal.name, valueUsd: deal.value_usd ?? "" }}
              submitLabel="Save changes"
              columns={2}
              onSubmit={(data) => saveDeal({ data: { ...data, id: deal.id } })}
            />
          </Disclosure>
        }
      />
      <DetailLayout
        main={
          <>
            {/* The gate for the current stage, on the record itself. A gate
                written in a document nobody opens is not a control. */}
            {deal.stageGate && (deal.stageGate.gate || deal.stageGate.artifact) && (
              <Card title="This stage">
                <FieldList>
                  <Field label="Artifact">{deal.stageGate.artifact}</Field>
                  <Field label="Gate to pass">{deal.stageGate.gate}</Field>
                </FieldList>
              </Card>
            )}

            <Card title="Becomes a client">
              <Disclosure label="Create client" openLabel="Create a client from this deal">
                <p className="mb-3 text-xs text-muted-foreground">
                  Stage 4 of the process: signed and paid. This carries the deal's
                  originating lead through, so revenue can be traced back to the
                  channel that produced it.
                </p>
                <EntityForm
                  fields={[
                    { name: "name", label: "Client name", required: true },
                    { name: "projectName", label: "First project", placeholder: "Optional" },
                  ]}
                  values={{ name: deal.company?.name ?? deal.name }}
                  submitLabel="Create client"
                  columns={2}
                  onSubmit={(data) => convertDealToClient({ data: { ...data, dealId: deal.id } })}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  AI processing stays off for a new client. Turn it on only when
                  the client has agreed to it.
                </p>
              </Disclosure>
            </Card>

            <Card title="Move stage">
              <Disclosure label="Advance stage" openLabel="Advance this deal">
                <p className="mb-3 text-xs text-muted-foreground">
                  The note is required. It is the evidence that the gate was met,
                  and it is recorded against your name.
                </p>
                <EntityForm
                  fields={[
                    {
                      name: "toStage",
                      label: "Move to",
                      type: "select",
                      required: true,
                      options: stages.map((s) => ({ value: s.name, label: s.name })),
                    },
                    {
                      name: "note",
                      label: "What satisfied the gate?",
                      type: "textarea",
                      required: true,
                      rows: 3,
                    },
                  ]}
                  submitLabel="Advance"
                  onSubmit={(data) => advanceStage({ data: { ...data, dealId: deal.id } })}
                />
              </Disclosure>
            </Card>

            <Card title="Activity">
              {/* Notes hang off the company, which is where the schema puts
                  them - so a note added here is visible on the company too,
                  and on every other deal with that company. That is the
                  correct behaviour for an account note, and it is worth
                  knowing rather than discovering. */}
              {deal.company && (
                <div className="mb-4">
                  <Disclosure label="Add note" openLabel={`Note on ${deal.company.name}`}>
                    <EntityForm
                      fields={[
                        { name: "title", label: "Title", placeholder: "Optional" },
                        { name: "content", label: "Note", type: "textarea", required: true, rows: 4 },
                      ]}
                      submitLabel="Save note"
                      onSubmit={(data) =>
                        addNote({ data: { ...data, companyId: deal.company!.id } })
                      }
                    />
                  </Disclosure>
                </div>
              )}
              <Timeline events={deal.events} />
            </Card>
          </>
        }
        aside={
          <>
          <Card title="Assignment">
            <OwnerPicker
              members={members}
              value={deal.owner_id}
              onChange={(userId) =>
                assignRecord({
                  data: { table: "deals", column: "owner_id", id: deal.id, userId: userId ?? "" },
                }).then(() => router.invalidate())
              }
            />
          </Card>
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
          </>
        }
      />
    </div>
  );
}
