import { pageHead, SITE_NAME, LEGAL_ENTITY, LEGAL_ENTITY_LONG, BUSINESS_ADDRESS } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      path: "/privacy",
      title: "Privacy Policy · GivenTake Devs",
      description:
        "How GivenTake Devs collects, uses, and protects your data with GDPR, CCPA/CPRA, and ePrivacy-oriented controls.",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">Legal</p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Privacy Policy
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
          <Section title="1. Who we are">
            <p>
              {LEGAL_ENTITY_LONG}. {SITE_NAME} ("we", "us") is a small development studio operating
              this website, and {LEGAL_ENTITY} is the data controller for any personal information
              you submit through this site.
            </p>
            <p className="mt-3">
              This policy describes GDPR, CCPA/CPRA, and ePrivacy-oriented practices for this
              website. It is not legal advice and does not replace project-specific compliance
              review for regulated work.
            </p>
            <p className="mt-3">
              Registered address: {BUSINESS_ADDRESS}. General contact:{" "}
              <a href="mailto:hello@giventakedevs.com" className="underline">
                hello@giventakedevs.com
              </a>
              . Privacy contact:{" "}
              <a href="mailto:privacy@giventakedevs.com" className="underline">
                privacy@giventakedevs.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Contact form data:</strong> name, email address, company (optional), project
                description, budget range, and timeline. You provide this voluntarily.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser type, device type, referrer,
                and pages visited. Collected only if you accept analytics or marketing cookies.
              </li>
              <li>
                <strong>Approximate location:</strong> derived from your IP address (country /
                region level). We do not collect precise GPS location.
              </li>
              <li>
                <strong>Cookies and similar technologies:</strong> see our{" "}
                <Link to="/cookies" className="underline">
                  Cookie Policy
                </Link>{" "}
                for the full list.
              </li>
            </ul>
            <p className="mt-3">
              We do not knowingly collect data from children under 16. We do not process special
              categories of personal data (health, biometrics, political views, etc.).
            </p>
          </Section>

          <Section title="3. How we use it">
            <ul className="list-disc space-y-2 pl-5">
              <li>To reply to your inquiry and prepare a proposal.</li>
              <li>To improve the site (aggregated analytics only).</li>
              <li>To measure ad performance on Meta, TikTok, LinkedIn, and Google.</li>
              <li>To meet legal obligations (tax records, contract records).</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information, and we do not submit it to AI systems for
              model training. See section 9 for how AI tools are used in our delivery work.
            </p>
          </Section>

          <Section title="4. Legal basis (GDPR)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Consent</strong>: analytics, marketing, and preference cookies.
              </li>
              <li>
                <strong>Legitimate interest</strong>: responding to a contact-form submission you
                initiated.
              </li>
              <li>
                <strong>Contract</strong>: delivering work you have engaged us for.
              </li>
              <li>
                <strong>Legal obligation</strong>: accounting and tax records.
              </li>
            </ul>
          </Section>

          <Section title="5. Sharing and processors">
            <p>We share limited data with vetted service providers acting on our instructions:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Email delivery provider: form submissions are sent to us by email through a
                transactional mail service. It transmits the message; it is not used to build
                marketing lists.
              </li>
              <li>Google Analytics 4 (aggregate site analytics, IP anonymized).</li>
              <li>
                Google Ads, Meta, TikTok, LinkedIn, and Microsoft Advertising pixels (ad
                measurement, marketing cookies only, and only when configured).
              </li>
              <li>Cloudflare (hosting, security, DDoS protection).</li>
            </ul>
            <p className="mt-3">
              Some of these providers are based in the United States. Transfers rely on Standard
              Contractual Clauses and, where applicable, the EU-US Data Privacy Framework.
            </p>
          </Section>

          <Section title="6. Retention">
            <ul className="list-disc space-y-2 pl-5">
              <li>Contact-form submissions: up to 24 months, then deleted.</li>
              <li>Cookie consent record: 6 months (then we ask again).</li>
              <li>Analytics data: 14 months at most, aggregated afterwards.</li>
              <li>Client project records: 7 years, for tax and legal compliance.</li>
            </ul>
          </Section>

          <Section title="7. Your rights">
            <p>
              Under GDPR, UK GDPR, and CCPA/CPRA, you have the right to access, correct, delete, or
              export your data, to object to or restrict processing, and to withdraw consent at any
              time. California residents additionally have the right to opt out of "sharing" for
              cross-context behavioral advertising. To exercise any of these, email{" "}
              <a href="mailto:privacy@giventakedevs.com" className="underline">
                privacy@giventakedevs.com
              </a>
              . We respond within the legally required period, generally 30 days for GDPR/UK GDPR
              requests and 45 days for CCPA/CPRA requests. You can also lodge a complaint with your
              local data protection authority.
            </p>
          </Section>

          <Section title="8. Do Not Track and Global Privacy Control">
            <p>
              We honor the Global Privacy Control (GPC) signal. If your browser sends GPC, we treat
              it as an opt-out of analytics and marketing cookies.
            </p>
          </Section>

          <Section title="9. AI tools and your data">
            <p>
              We build software using AI coding agents. That is a delivery method, not a use of your
              personal data: information you submit through this website is not entered into AI
              tools and is not used to train any model.
            </p>
            <p className="mt-3">
              For paid engagements, AI tools may process material a client gives us to do the work.
              Where that happens we use business or enterprise tiers configured so that inputs are
              not retained for training, we obtain the client's written consent to AI-assisted
              delivery before starting, and we put a data processing agreement in place where the
              material includes personal data. Clients can request the current list of AI tools we
              use and their data-handling terms at any time.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use TLS in transit, restrict access to submitted data, and review our providers
              annually. No system is perfectly secure; where required by law, we will notify you and
              the relevant authority of a breach affecting your data.
            </p>
          </Section>

          <Section title="11. Changes">
            <p>
              We may update this policy. Material changes are announced on this page and the "last
              updated" date is revised. Continued use of the site after changes means acceptance of
              the updated policy.
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
