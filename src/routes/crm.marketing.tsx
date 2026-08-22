import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  crmMarketing, saveReview, setReviewStatus, saveCampaign,
  REVIEW_STATUSES, CAMPAIGN_STATUSES,
} from "@/lib/crm-data";
import {
  PageHeader, Card, EmptyState, StatCard, Badge, EntityForm, Disclosure,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/marketing")({
  loader: () => crmMarketing(),
  component: Marketing,
});

function Marketing() {
  const { campaigns, subscribers, reviews } = Route.useLoaderData();
  const router = useRouter();
  // A quote you may not publish is not a proof asset, so this is the number
  // worth showing rather than the raw review count.
  const publishable = reviews.filter((r) => r.permission_obtained === true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        subtitle="Campaigns, newsletter and reputation."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns" value={campaigns.length} />
        <StatCard
          label="Subscribers"
          value={subscribers.total}
          hint={
            Object.entries(subscribers.byStatus)
              .map(([k, v]) => `${v} ${k}`)
              .join(" · ") || undefined
          }
        />
        <StatCard
          label="Usable reviews"
          value={publishable.length}
          hint={`${reviews.length} recorded`}
        />
      </div>

      <Card title="Campaigns">
        <div className="mb-4">
          <Disclosure label="New campaign" openLabel="New campaign">
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "channel", label: "Channel", placeholder: "email, social" },
                {
                  name: "status",
                  label: "Status",
                  type: "select" as const,
                  options: CAMPAIGN_STATUSES.map((v) => ({ value: v, label: v })),
                },
                { name: "goal", label: "Goal", type: "textarea" as const, rows: 2 },
              ]}
              submitLabel="Create campaign"
              columns={2}
              onSubmit={(data) => saveCampaign({ data })}
            />
          </Disclosure>
        </div>
        {campaigns.length === 0 ? (
          <EmptyState>
            No campaigns. Nothing sends from the CRM today - drafts stop at
            approval, and Salem sends.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  {c.goal && <p className="text-xs text-muted-foreground">{c.goal}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {c.channel && <Badge value={c.channel} />}
                  {c.status && <Badge value={c.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Newsletter">
        {subscribers.total === 0 ? (
          <EmptyState>
            No subscribers. Every subscriber carries consent_source and
            consent_at, so the list can prove how each address arrived.
          </EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {Object.entries(subscribers.byStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{status}</span>
                <span className="tabular-nums text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Reviews">
        <div className="mb-4">
          <Disclosure label="Record review" openLabel="Record a review">
            <p className="mb-3 text-xs text-muted-foreground">
              Permission is what decides whether a quote can ever be published.
              The database refuses to publish a review without it, so this is not
              a formality.
            </p>
            <EntityForm
              fields={[
                { name: "authorName", label: "Author", required: true },
                { name: "source", label: "Source", required: true, placeholder: "email, call, Google" },
                { name: "subject", label: "Subject" },
                { name: "rating", label: "Rating (1-5)", type: "number" as const },
                { name: "quote", label: "Quote", type: "textarea" as const, rows: 3 },
                {
                  name: "permissionObtained",
                  label: "Permission to publish",
                  type: "checkbox" as const,
                  help: "Only tick this if they have actually agreed.",
                },
              ]}
              submitLabel="Save review"
              columns={2}
              onSubmit={(data) => saveReview({ data })}
            />
          </Disclosure>
        </div>
        {reviews.length === 0 ? (
          <EmptyState>
            None yet. The site refuses to display proof it does not have, so this
            is the table that unblocks case studies.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {r.author_name ?? "Anonymous"}
                    {r.rating != null && (
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {r.rating}/5
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {r.source && <Badge value={r.source} />}
                    {/* Permission is the gate on using a quote publicly, so it
                        reads as a warning when absent rather than a quiet null. */}
                    <select
                      defaultValue={r.status ?? "draft"}
                      aria-label={`Status for ${r.author_name ?? "review"}`}
                      onChange={async (event) => {
                        try {
                          await setReviewStatus({ data: { id: r.id, status: event.target.value } });
                          await router.invalidate();
                        } catch (cause) {
                          // The database refuses to publish without permission.
                          // Show its words rather than a generic failure.
                          toast.error(
                            cause instanceof Error ? cause.message : "Could not change status",
                          );
                          await router.invalidate();
                        }
                      }}
                      className="rounded border border-border bg-background px-2 py-0.5 text-[11px]"
                    >
                      {REVIEW_STATUSES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    {r.permission_obtained === true ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        cleared to publish
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                        no permission on file
                      </span>
                    )}
                  </div>
                </div>
                {r.quote && (
                  <p className="mt-2 text-sm italic text-muted-foreground">&ldquo;{r.quote}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
