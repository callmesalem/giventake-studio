import { createFileRoute, redirect } from "@tanstack/react-router";
import { completeGoogleLogin } from "@/lib/crm-auth";

/**
 * OAuth callback: GoTrue redirects here with `?code=...` after Google. We
 * exchange it for a session (enforcing the Workspace domain) and send the user
 * into the CRM, or back to the login page with a reason on failure.
 */
export const Route = createFileRoute("/crm/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (search.error || !search.code) {
      throw redirect({ to: "/crm/login", search: { reason: "oauth" } });
    }
    try {
      await completeGoogleLogin({ data: { code: search.code } });
    } catch (caught) {
      const reason =
        caught instanceof Error && caught.message === "domain_not_allowed" ? "domain" : "oauth";
      throw redirect({ to: "/crm/login", search: { reason } });
    }
    throw redirect({ to: "/crm" });
  },
  component: () => null,
});
