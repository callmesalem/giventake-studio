import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { requestMagicLink } from "@/features/auth/auth.functions";

type LoginFormProps = {
  requestLink?: (input: { email: string }) => Promise<{ accepted: true }>;
};

export function LoginForm({
  requestLink = (input) => requestMagicLink({ data: input }),
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "accepted" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    try {
      await requestLink({ email });
      setState("accepted");
    } catch {
      setState("error");
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-800" htmlFor="email">
          Work email
        </label>
        <input
          autoComplete="email"
          className="h-11 rounded border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <button
        className="h-11 rounded bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-400"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "Sending..." : "Send sign-in link"}
      </button>
      {state === "accepted" ? (
        <p className="m-0 text-sm leading-6 text-slate-700" role="status">
          If the address is eligible, a sign-in link is on its way.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="m-0 text-sm leading-6 text-red-700" role="alert">
          The request could not be completed. Please try again.
        </p>
      ) : null}
    </form>
  );
}

function LoginRoute() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <section className="mx-auto w-full max-w-sm border-t border-slate-300 pt-8">
        <p className="mb-2 text-sm font-bold uppercase text-teal-700">GivenTake</p>
        <h1 className="mb-3 text-3xl font-bold text-slate-950">Growth OS</h1>
        <p className="mb-8 text-sm leading-6 text-slate-600">Sign in to your workspace.</p>
        <LoginForm />
      </section>
    </main>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});
