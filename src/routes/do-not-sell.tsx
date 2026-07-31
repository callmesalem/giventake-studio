import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useConsent } from "@/lib/consent";

export const Route = createFileRoute("/do-not-sell")({
  head: () =>
    pageHead({
      path: "/do-not-sell",
      title: "Do Not Sell or Share My Personal Information · GivenTake Goods Devs",
      description:
        "Exercise your CCPA and CPRA right to opt out of the sale or sharing of your personal information by GivenTake Goods Devs.",
    }),
  component: DoNotSellPage,
});

function DoNotSellPage() {
  const { state, save } = useConsent();
  const optedOut = !state.marketing && !state.analytics;
  const [confirmed, setConfirmed] = useState(false);

  function handleOptOut() {
    save({ analytics: false, marketing: false, preferences: state.preferences });
    setConfirmed(true);
  }

  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
          Your California privacy rights
        </p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Do Not Sell or Share My Personal Information
        </h1>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink">
          <p>
            Under the California Consumer Privacy Act (CCPA) as amended by the California Privacy
            Rights Act (CPRA), California residents have the right to opt out of the "sale" or
            "sharing" of their personal information, including sharing for cross-context behavioral
            advertising.
          </p>
          <p>
            GivenTake Goods Devs does not sell personal information for money. However, when you
            allow marketing cookies, information about your visit (device, IP address, pages viewed)
            is shared with advertising partners (Meta, TikTok, LinkedIn, Google) so we can measure
            ad performance and reach similar audiences. Under CPRA, that qualifies as "sharing" and
            you have the right to turn it off.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-hairline bg-white p-6 shadow-soft">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Opt out with one click
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">
            This turns off analytics and marketing cookies for this browser and this device. Your
            choice is remembered for 6 months. If you use another browser or clear your cookies,
            you'll need to opt out again there.
          </p>

          {confirmed || optedOut ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-paper p-4">
              <div className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none">
                  <path
                    d="M4 10l4 4 8-9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-ink">
                  You're opted out of sale and sharing on this browser.
                </p>
                <p className="mt-1 text-[13px] text-muted-ink">
                  Analytics and marketing cookies are disabled. No further sharing with advertising
                  partners will occur from this device.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleOptOut}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90"
            >
              Opt me out of sale and sharing
            </button>
          )}
        </div>

        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-ink">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Global Privacy Control
            </h2>
            <p className="mt-2 text-muted-ink">
              If your browser sends the Global Privacy Control (GPC) signal, we treat it as a valid
              opt-out request automatically, and no additional action is required on this page.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">Authorized agents</h2>
            <p className="mt-2 text-muted-ink">
              You may designate an authorized agent to submit an opt-out request on your behalf. We
              may require reasonable proof that the agent is authorized to act for you. Send agent
              requests to{" "}
              <a href="mailto:privacy@giventake.dev" className="underline">
                privacy@giventake.dev
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">Non-discrimination</h2>
            <p className="mt-2 text-muted-ink">
              Exercising your privacy rights will not result in any denial of service, different
              pricing, or reduced quality of the goods or services we offer.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Other privacy requests
            </h2>
            <p className="mt-2 text-muted-ink">
              To access, correct, delete, or export your data, or to limit the use of sensitive
              personal information, email{" "}
              <a href="mailto:privacy@giventake.dev" className="underline">
                privacy@giventake.dev
              </a>
              . We respond within 45 days as required by CCPA.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
