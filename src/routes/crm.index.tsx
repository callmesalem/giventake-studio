import { createFileRoute } from "@tanstack/react-router";
import { crmOverview } from "@/lib/crm-data";
import { PageHeader, StatCard, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/")({
  loader: () => crmOverview(),
  component: Overview,
});

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + (Number(b) || 0), 0);
}

function Breakdown({ record }: { record: Record<string, number> }) {
  const entries = Object.entries(record).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No records yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {entries.map(([label, value]) => (
        <li key={label} className="flex items-center justify-between text-sm">
          <span className="capitalize text-muted-foreground">{label.replace(/_/g, " ")}</span>
          <span className="font-medium text-foreground">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  const o = Route.useLoaderData();
  return (
    <div>
      <PageHeader title="Overview" subtitle="Live snapshot of the GivenTake CRM." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies" value={o.companies} />
        <StatCard label="Contacts" value={o.contacts} />
        <StatCard label="Deals" value={o.deals} />
        <StatCard
          label="Pending approvals"
          value={o.pendingApprovals}
          hint={o.pendingApprovals > 0 ? "Needs review" : "All clear"}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={o.openTasks} hint={`${o.tasks} total`} />
        <StatCard label="Notes" value={o.notes} />
        <StatCard
          label="Campaign enrollments"
          value={sum(o.enrollmentsByStatus)}
          hint={`${o.campaignsCount} campaigns`}
        />
        <StatCard
          label="Newsletter subscribers"
          value={sum(o.subscribersByStatus)}
          hint={`${o.issuesCount} issues`}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Campaign enrollments">
          <Breakdown record={o.enrollmentsByStatus} />
        </Card>
        <Card title="Newsletter subscribers">
          <Breakdown record={o.subscribersByStatus} />
        </Card>
        <Card title="Referrals">
          <Breakdown record={o.referralsByStatus} />
        </Card>
        <Card title="Reviews">
          <Breakdown record={o.reviewsByStatus} />
        </Card>
        <Card title="Review requests">
          <Breakdown record={o.requestsByStatus} />
        </Card>
        <Card title="Referral partners">
          <p className="text-2xl font-semibold text-foreground">{o.partnersCount}</p>
          <p className="text-sm text-muted-foreground">active partners</p>
        </Card>
      </div>
    </div>
  );
}
