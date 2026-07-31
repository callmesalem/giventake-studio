import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useConsent } from "@/lib/consent";

export const Route = createFileRoute("/cookies")({
  head: () => pageHead({
    path: "/cookies",
    title: "Cookie Policy · GivenTake Goods Devs",
    description:
      "Every cookie and tracker used by GivenTake Goods Devs, its purpose, its lifetime, and how to opt out.",
  }),
  component: CookiesPage,
});

const ROWS = [
  {
    category: "Necessary",
    name: "gt.consent.v1",
    provider: "GivenTake Goods Devs",
    purpose: "Remembers your cookie consent choices.",
    duration: "6 months",
  },
  {
    category: "Analytics",
    name: "_ga, _ga_*",
    provider: "Google Analytics 4",
    purpose: "Aggregated site usage with IP anonymization.",
    duration: "Up to 14 months",
  },
  {
    category: "Marketing",
    name: "_fbp, fr",
    provider: "Meta Pixel",
    purpose: "Ad measurement and retargeting on Facebook and Instagram.",
    duration: "Up to 90 days",
  },
  {
    category: "Marketing",
    name: "_ttp",
    provider: "TikTok Pixel",
    purpose: "Ad measurement on TikTok.",
    duration: "Up to 13 months",
  },
  {
    category: "Marketing",
    name: "li_sugr, bcookie, lidc",
    provider: "LinkedIn Insight",
    purpose: "Ad measurement on LinkedIn.",
    duration: "Up to 12 months",
  },
];

function CookiesPage() {
  const { openPreferences } = useConsent();
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">Legal</p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Cookie Policy
        </h1>
        <p className="mt-3 text-[13px] text-muted-ink">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <p className="mt-8 text-[15px] leading-relaxed text-muted-ink">
          We use a small number of cookies and similar technologies (local storage, pixel tags) to
          run the site and, with your consent, to measure how it's used. Below is every category and
          every technology in use.
        </p>

        <div className="mt-6">
          <button
            type="button"
            data-consent-trigger="cookies-page"
            onClick={openPreferences}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Change my cookie choices
          </button>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-hairline bg-white">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-paper text-[11px] font-semibold uppercase tracking-wider text-muted-ink">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-ink">
              {ROWS.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">{r.name}</td>
                  <td className="px-4 py-3">{r.provider}</td>
                  <td className="px-4 py-3 text-muted-ink">{r.purpose}</td>
                  <td className="px-4 py-3 text-muted-ink">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-ink">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">Your controls</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-ink">
              <li>Use the "Cookie settings" button above at any time.</li>
              <li>Block cookies in your browser (may break parts of the site).</li>
              <li>
                Enable Global Privacy Control (GPC) — we treat it as an opt-out of analytics and
                marketing.
              </li>
              <li>
                Opt out at the provider directly:{" "}
                <a href="https://tools.google.com/dlpage/gaoptout" className="underline">
                  Google
                </a>
                ,{" "}
                <a href="https://www.facebook.com/adpreferences" className="underline">
                  Meta
                </a>
                ,{" "}
                <a href="https://www.tiktok.com/legal/page/global/privacy-policy/en" className="underline">
                  TikTok
                </a>
                ,{" "}
                <a href="https://www.linkedin.com/psettings/guest-controls" className="underline">
                  LinkedIn
                </a>
                .
              </li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
