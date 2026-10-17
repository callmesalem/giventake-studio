import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ProposalDocument } from "@/components/proposal-document";
import { viewProposal, decideProposal } from "@/lib/proposal-public";
import {
  formatUsd,
  paymentOptions,
  proposalTotals,
  type PaymentOptionKey,
  type ProposalLine,
} from "@/lib/proposals";

export const Route = createFileRoute("/proposal/$code")({
  head: () => ({
    meta: [
      { title: "Your proposal · GivenTake Devs" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ params }) => viewProposal({ data: { code: params.code } }),
  component: ProposalPage,
});

const MESSAGES = {
  accepted: "Thank you, this proposal is accepted. We'll send the Statement of Work to sign next.",
  declined: "This proposal was declined. If anything changes, we'd be glad to talk again.",
  expired: "This proposal has expired. Ask us for an updated one.",
  superseded: "An updated proposal was sent to you. Please use the newest link in your email.",
} as const;

type State = keyof typeof MESSAGES | "open";

export function ProposalPage() {
  const p = Route.useLoaderData();
  const { code } = Route.useParams();
  const [state, setState] = useState<State | null>(null);
  const [option, setOption] = useState<PaymentOptionKey | "">("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p) {
    return (
      <Shell>
        <p className="mx-auto max-w-xl px-6 py-24 text-center">
          This proposal link isn&rsquo;t valid. Please use the link from your email, or contact us.
        </p>
      </Shell>
    );
  }
  const current: State = state ?? p.state;
  const options = paymentOptions(proposalTotals(p.lines as ProposalLine[]));

  async function submit(decision: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const r = await decideProposal({ data: { code, decision, option, name, reason, consent } });
      setState(r.status as State);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That didn't go through. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <ProposalDocument
        title={p.title}
        client={p.client}
        summary={p.summary}
        timeline={p.timeline}
        validUntil={p.valid_until}
        lines={p.lines}
      >
        {current === "open" ? (
          <>
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Choose how to pay</h2>
              <div
                className="mt-3 grid gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Payment option"
              >
                {options.map((o) => (
                  <label
                    key={o.key}
                    className={
                      "cursor-pointer rounded-lg border p-4 text-sm " +
                      (option === o.key ? "border-ink ring-1 ring-ink" : "border-hairline")
                    }
                  >
                    <input
                      type="radio"
                      name="option"
                      value={o.key}
                      checked={option === o.key}
                      onChange={() => setOption(o.key)}
                      className="sr-only"
                    />
                    <p className="font-semibold">{o.label}</p>
                    <ul className="mt-2 space-y-1 text-muted-ink">
                      {o.schedule.map((s) => (
                        <li key={s.label}>
                          {formatUsd(s.amountCents)} · {s.due}
                        </li>
                      ))}
                    </ul>
                  </label>
                ))}
              </div>
            </section>
            <section className="mt-8">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <ol className="mt-2 list-decimal pl-5 text-sm text-muted-ink">
                <li>We send the Statement of Work for you to sign.</li>
                <li>The first payment, or the own-it plan&rsquo;s first month.</li>
                <li>Kickoff.</li>
              </ol>
            </section>
            <section className="no-print mt-8 rounded-lg border border-hairline p-5">
              {!declining ? (
                <>
                  <label className="block text-sm font-medium">
                    Type your full name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-hairline px-3 py-2"
                    />
                  </label>
                  <label className="mt-3 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1"
                    />
                    I accept this proposal. The work will be governed by the Statement of Work
                    GivenTake Devs sends next.
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || !option || name.trim().length < 2 || !consent}
                      onClick={() => submit("accept")}
                      className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Accept proposal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-full border border-hairline px-5 py-2.5 text-sm"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclining(true)}
                      className="text-sm text-muted-ink underline"
                    >
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium">
                    Anything you&rsquo;d like to tell us? (optional)
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-hairline px-3 py-2"
                    />
                  </label>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submit("decline")}
                      className="rounded-full border border-ink px-5 py-2.5 text-sm"
                    >
                      Decline proposal
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclining(false)}
                      className="text-sm underline"
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
            </section>
          </>
        ) : (
          <p role="status" className="mt-10 rounded-lg bg-secondary/60 p-5 text-[15px]">
            {MESSAGES[current]}{" "}
            {current === "expired" && (
              <a href="/#contact" className="underline">
                Contact us
              </a>
            )}
          </p>
        )}
      </ProposalDocument>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
