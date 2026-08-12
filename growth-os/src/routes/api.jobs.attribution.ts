import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleAttributionJobsRequest } from "@/features/attribution/attribution.worker.server";

export const Route = createFileRoute("/api/jobs/attribution")({
  server: {
    handlers: {
      POST: ({ request }) => handleAttributionJobsRequest(request),
    },
  },
});
