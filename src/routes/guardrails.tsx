import { createFileRoute, redirect } from "@tanstack/react-router";

// /guardrails consolidated into /how-we-use-ai — same topic (how we keep AI
// reliable), one canonical page. Kept as a redirect so existing links and search
// results still resolve instead of 404ing.
export const Route = createFileRoute("/guardrails")({
  beforeLoad: () => {
    throw redirect({ to: "/how-we-use-ai" });
  },
});
