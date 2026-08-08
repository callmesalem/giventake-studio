import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { pageHead, SITE_NAME, LEGAL_ENTITY } from "@/lib/seo";

export const Route = createFileRoute("/compliance")({
  head: () =>
    pageHead({
      path: "/compliance",
      title: "Compliance and Tracking Notice · GivenTake Devs",
      description:
        "Plain-language notices about advertising claims, AI-assisted delivery, regulated work, privacy controls, and consent-gated tracking.",
    }),
  component: CompliancePage,
});

function CompliancePage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
          Legal notice
        </p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Compliance and tracking notice
        </h1>
        <p className="mt-3 text-[13px] text-muted-ink">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="prose-content mt-10 space-y-8 text-[15px] leading-relaxed text-ink">
          <Section title="Plain-language compliance note">
            <p>
              {SITE_NAME} is operated by {LEGAL_ENTITY}. This page explains how we try to keep the
              website honest, privacy-forward, and clear about tracking. This is not a guarantee
              that every law or regulation applies the same way to every visitor, client, industry,
              or project. A signed services agreement and statement of work control paid
              engagements.
            </p>
          </Section>

          <Section title="Not legal, tax, financial, securities, investment, or regulatory compliance advice">
            <p>
              The website and any discovery conversation are informational only. We build software
              and automation; we do not provide legal, tax, accounting, privacy, cybersecurity,
              securities, investment, broker-dealer, investment-adviser, or regulator-facing advice.
              If your project touches SEC, FTC, financial, health, employment, consumer-credit,
              children&apos;s data, biometrics, or another regulated area, you are responsible for
              getting qualified counsel or compliance review before launch.
            </p>
          </Section>

          <Section title="Advertising, pricing, and substantiation">
            <p>
              We write advertising claims to be specific, supportable, and clear and conspicuous.
              Public examples are illustrative unless they are expressly identified as client work.
              We do not present fictional endorsements as real testimonials, and we do not use
              popularity claims like "most picked" unless there is real evidence behind them.
            </p>
            <p className="mt-3">
              Prices shown on the site are entry points, not automatic approvals. Final pricing,
              scope, timeline, deliverables, exclusions, and assumptions are put in writing before
              work starts.
            </p>
          </Section>

          <Section title="Tracking and consent controls">
            <p>
              The site is built for modern measurement while keeping advertising and analytics
              optional. Google Consent Mode v2 is initialized with ad and analytics storage denied
              by default. Analytics and marketing tools do not load until the matching consent
              category is accepted.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-ink">
              <li>Analytics: Google Analytics 4, only after analytics consent.</li>
              <li>
                Advertising measurement and retargeting: Google Ads, Meta Pixel, TikTok Pixel,
                LinkedIn Insight, and Microsoft Advertising, only after marketing consent and only
                when the relevant account IDs are configured.
              </li>
              <li>
                Global Privacy Control is honored as an opt-out from analytics and marketing on the
                browser that sends it.
              </li>
            </ul>
            <p className="mt-3">
              You can change choices on the{" "}
              <Link to="/cookies" className="font-medium text-ink underline">
                Cookie Policy
              </Link>{" "}
              page or use{" "}
              <Link to="/do-not-sell" className="font-medium text-ink underline">
                Do Not Sell or Share My Personal Information
              </Link>{" "}
              for the California opt-out flow.
            </p>
          </Section>

          <Section title="Sensitive and regulated data">
            <p>
              Do not submit credentials, payment card numbers, government identifiers, protected
              health information, children&apos;s data, consumer reports, trade secrets, or other
              regulated material through the website form. If a project needs that kind of data, we
              scope the handling requirements in writing first.
            </p>
          </Section>

          <Section title="Security and privacy posture">
            <p>
              We use HTTPS, least-necessary collection, consent controls, provider review, and
              written project handoff practices. No website or software system can be made
              risk-free; the goal is to document assumptions, avoid unnecessary data, and make the
              remaining risks explicit before anything ships.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-medium tracking-tight text-ink">{title}</h2>
      <div className="mt-3 text-muted-ink">{children}</div>
    </section>
  );
}
