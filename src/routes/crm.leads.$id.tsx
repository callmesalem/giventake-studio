import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 1: the standalone lead detail page is gone — leads live in Contacts now.
// Old lead ids don't map to contact ids, so send bookmarks to the Leads stage view.
export const Route = createFileRoute("/crm/leads/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/crm/contacts", search: { stage: "lead" } });
  },
});
