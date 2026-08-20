import { createFileRoute, redirect } from "@tanstack/react-router";
import { startGoogleLogin } from "@/lib/crm-auth";

/**
 * Kicks off Google sign-in: the server fn stores a PKCE verifier cookie and
 * returns the GoTrue authorize URL, which we redirect the browser to.
 */
export const Route = createFileRoute("/crm/auth/google")({
  beforeLoad: async () => {
    const url = await startGoogleLogin();
    throw redirect({ href: url });
  },
  component: () => null,
});
