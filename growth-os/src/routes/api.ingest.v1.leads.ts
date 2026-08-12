import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleIngestRequest } from "@/features/intake/ingest.server";

export const Route = createFileRoute("/api/ingest/v1/leads")({
  server: {
    handlers: {
      POST: ({ request }) => handleIngestRequest(request),
    },
  },
});
