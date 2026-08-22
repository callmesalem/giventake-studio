import { FormEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Sparkles } from "lucide-react";

import { requestStudioMagicLink } from "@/lib/studio/auth-actions";

export const Route = createFileRoute("/studio/sign-in")({ component: StudioSignInPage });

function StudioSignInPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestStudioMagicLink({ data: { email } });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-10 text-zinc-950">
      <section className="w-full max-w-md border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-cyan-800">
          <Sparkles className="size-4" /> GivenTake Devs
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Video Agent Studio</h1>
        <p className="mt-2 text-sm text-zinc-600">Use your invited work email to continue.</p>
        {sent ? (
          <p className="mt-5 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Check your inbox for a secure sign-in link.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-zinc-800">
              Email address
              <input
                autoComplete="email"
                className="mt-1.5 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <button
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Send sign-in link
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
