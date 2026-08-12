import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { LeadDetailView } from "@/features/leads/lead-detail";
import { getLead } from "@/features/leads/leads.functions";

export const Route = createFileRoute("/_app/leads/$leadId")({
  loader: ({ params }) => getLead({ data: { leadId: params.leadId } }),
  component: LeadDetailRoute,
});

function LeadDetailRoute() {
  const router = useRouter();
  const { supportSession } = getRouteApi("/_app").useLoaderData();
  return (
    <LeadDetailRouteContent
      lead={Route.useLoaderData()}
      refresh={() => router.invalidate()}
      supportSession={supportSession}
    />
  );
}

export function LeadDetailRouteContent({
  lead,
  refresh,
  supportSession,
}: {
  lead: Parameters<typeof LeadDetailView>[0]["lead"];
  refresh: () => Promise<void>;
  supportSession: { expiresAt: string } | null;
}) {
  return <LeadDetailView lead={lead} readOnly={Boolean(supportSession)} refresh={refresh} />;
}
