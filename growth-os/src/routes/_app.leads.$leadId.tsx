import { createFileRoute } from "@tanstack/react-router";
import { LeadDetailView } from "@/features/leads/lead-detail";
import { getLead } from "@/features/leads/leads.functions";

export const Route = createFileRoute("/_app/leads/$leadId")({
  loader: ({ params }) => getLead({ data: { leadId: params.leadId } }),
  component: LeadDetailRoute,
});

function LeadDetailRoute() {
  return <LeadDetailView lead={Route.useLoaderData()} />;
}
