import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { loginCrm } from "@/lib/crm-auth";

export const Route = createFileRoute("/crm/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; reason?: "oauth" | "domain" } => {
    const redirect = typeof search.redirect === "string" ? search.redirect : undefined;
    const reason =
      search.reason === "oauth" || search.reason === "domain" ? search.reason : undefined;
    // Only allow same-app relative redirects back into the CRM.
    return {
      redirect: redirect && redirect.startsWith("/crm") ? redirect : undefined,
      reason,
    };
  },
  component: CrmLogin,
});

const REASON_MESSAGE: Record<string, string> = {
  oauth: "Google sign-in did not complete. Please try again.",
  domain: "That account is not a GivenTake (giventakedevs.com) account.",
};

function CrmLogin() {
  const router = useRouter();
  const { redirect, reason } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(reason ? REASON_MESSAGE[reason] : "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await loginCrm({ data: { email, password } });
      await router.invalidate();
      await router.navigate({ to: redirect ?? "/crm" });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message ? caught.message : "Invalid email or password";
      setError(message.replace(/^Error:\s*/, ""));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">GivenTake CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your team workspace</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <a
            href="/crm/auth/google"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Sign in with Google
          </a>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form
          onSubmit={submit}
          className="mt-4 space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is limited to GivenTake team members.
        </p>
      </div>
    </div>
  );
}
