import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  crmCampaign,
  crmLeads,
  saveCampaignStep,
  removeCampaignStep,
  enrollLeadInCampaign,
} from "@/lib/crm-data";
import { MERGE_FIELDS } from "@/lib/campaign-template";
import { PageHeader, Card, EmptyState, Badge, EntityForm, Disclosure } from "@/components/crm/ui";

/**
 * One campaign: its sequence of steps and who is enrolled.
 *
 * Before this route the engine could send but nothing could feed it: the
 * marketing page created campaign rows and stopped. Saving a step and
 * enrolling a lead are the two writes that turn a draft into a sequence the
 * cron will run once the campaign's status is "active".
 */
export const Route = createFileRoute("/crm/campaigns/$id")({
  loader: async ({ params }) => {
    const [detail, leads] = await Promise.all([
      crmCampaign({ data: { id: params.id } }),
      crmLeads(),
    ]);
    return { detail, leads };
  },
  component: CampaignDetail,
});

function CampaignDetail() {
  const { detail, leads } = Route.useLoaderData();
  const router = useRouter();
  const campaign = detail.campaign;

  if (!campaign) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campaign" subtitle="Not found." />
        <Link to="/crm/marketing" className="text-sm text-muted-foreground hover:underline">
          Back to marketing
        </Link>
      </div>
    );
  }

  const campaignId = campaign.id;
  const enrolled = new Set(detail.enrollments.map((e) => e.leadId));
  const candidates = leads.filter((l) => l.email && !enrolled.has(l.id));
  const nextStep = detail.steps.length ? Math.max(...detail.steps.map((s) => s.stepOrder)) + 1 : 0;
  const mergeHint = MERGE_FIELDS.map((f) => `{{${f}}}`).join(", ");

  async function remove(stepOrder: number) {
    try {
      await removeCampaignStep({ data: { campaignId, stepOrder } });
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not remove the step");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={campaign.name} subtitle={campaign.goal ?? "Campaign sequence"} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/crm/marketing" className="hover:underline">
          Marketing
        </Link>
        <span aria-hidden="true">/</span>
        <span>{campaign.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {campaign.channel && <Badge value={campaign.channel} />}
          {campaign.status && <Badge value={campaign.status} />}
        </span>
      </div>

      <Card title="Steps">
        <p className="mb-4 text-xs text-muted-foreground">
          Step 0 sends when a lead is enrolled, after its delay. Each later step waits its delay
          after the previous send. Merge fields: {mergeHint}. The sequence stops on a reply, an
          unsubscribe, or a conversion.
        </p>
        <div className="mb-4">
          <Disclosure label="Add step" openLabel="Add a step">
            <EntityForm
              fields={[
                { name: "stepOrder", label: "Step", type: "number" as const, required: true },
                {
                  name: "delayHours",
                  label: "Delay (hours)",
                  type: "number" as const,
                  required: true,
                  placeholder: "0 sends on enrollment, 72 waits three days",
                },
                {
                  name: "subject",
                  label: "Subject",
                  required: true,
                  placeholder: "Quick question about {{company}}",
                },
                {
                  name: "text",
                  label: "Body",
                  type: "textarea" as const,
                  rows: 8,
                  required: true,
                  placeholder: "Hi {{firstName}},\n\n...",
                },
              ]}
              values={{ stepOrder: nextStep, delayHours: 0 }}
              submitLabel="Save step"
              columns={2}
              onSubmit={(data) => saveCampaignStep({ data: { ...data, campaignId } })}
            />
          </Disclosure>
        </div>
        {detail.steps.length === 0 ? (
          <EmptyState>No steps yet. Nothing sends until the campaign has at least one.</EmptyState>
        ) : (
          <ol className="divide-y divide-border">
            {detail.steps.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      #{s.stepOrder}
                    </span>
                    {s.subject}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>after {s.delayHours}h</span>
                    <button
                      type="button"
                      onClick={() => remove(s.stepOrder)}
                      className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                  {s.text}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Enrolled leads">
        <div className="mb-4">
          <Disclosure label="Enroll lead" openLabel="Enroll a lead">
            <p className="mb-3 text-xs text-muted-foreground">
              An address on do_not_contact is enrolled as suppressed and never mailed. Every send is
              still gated by the approved-recipients list for this campaign&rsquo;s SOP.
            </p>
            {candidates.length === 0 ? (
              <EmptyState>Every lead with an email address is already enrolled.</EmptyState>
            ) : (
              <EntityForm
                fields={[
                  {
                    name: "leadId",
                    label: "Lead",
                    type: "select" as const,
                    required: true,
                    options: candidates.map((l) => ({
                      value: l.id,
                      label: `${l.name ?? "(no name)"} <${l.email}>${l.company ? ` · ${l.company}` : ""}`,
                    })),
                  },
                ]}
                submitLabel="Enroll"
                onSubmit={(data) => enrollLeadInCampaign({ data: { ...data, campaignId } })}
              />
            )}
          </Disclosure>
        </div>
        {detail.enrollments.length === 0 ? (
          <EmptyState>No one is enrolled.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {detail.enrollments.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{e.name ?? "(no name)"}</p>
                  <p className="text-xs text-muted-foreground">{e.email}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>step {e.currentStep}</span>
                  {e.status && <Badge value={e.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
