import { pageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead({
    path: "/privacy",
    title: "Privacy Policy · GivenTake Goods Devs",
    description:
      "How GivenTake Goods Devs collects, uses, and protects your data. GDPR, CCPA, and ePrivacy compliant.",
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
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="prose-content mt-10 space-y-8 text-[15px] leading-relaxed text-ink">
          <Section title="1. Who we are">
            <p>
              GivenTake Goods Devs ("we", "us") is a small development studio operating this website.
              We are the data controller for any personal information you submit through this site.
              You can reach us at{" "}
              <a href="mailto:hello@giventake.dev" className="underline">
                hello@giventake.dev
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
                <strong>Technical data:</strong> IP address, browser type, device type, referrer, and
                pages visited. Collected only if you accept analytics or marketing cookies.
              </li>
              <li>
                <strong>Approximate location:</strong> derived from your IP address (country / region
                level). We do not collect precise GPS location.
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
              We do not sell your personal information. We do not use your data to train AI models.
            </p>
          </Section>

          <Section title="4. Legal basis (GDPR)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Consent</strong> — analytics, marketing, and preference cookies.
              </li>
              <li>
                <strong>Legitimate interest</strong> — responding to a contact-form submission you
                initiated.
              </li>
              <li>
                <strong>Contract</strong> — delivering work you have engaged us for.
              </li>
              <li>
                <strong>Legal obligation</strong> — accounting and tax records.
              </li>
            </ul>
          </Section>

          <Section title="5. Sharing and processors">
            <p>We share limited data with vetted service providers acting on our instructions:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Email delivery (transactional mail from our own inbox).</li>
              <li>Google Analytics 4 (aggregate site analytics, IP anonymized).</li>
              <li>Meta, TikTok, and LinkedIn pixels (ad measurement, marketing cookies only).</li>
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
              <a href="mailto:privacy@giventake.dev" className="underline">
                privacy@giventake.dev
              </a>
              . We respond within 30 days. You can also lodge a complaint with your local data
              protection authority.
            </p>
          </Section>

          <Section title="8. Do Not Track and Global Privacy Control">
            <p>
              We honor the Global Privacy Control (GPC) signal. If your browser sends GPC, we treat
              it as an opt-out of analytics and marketing cookies.
            </p>
          </Section>

          <Section title="9. Security">
            <p>
              We use TLS in transit, restrict access to submitted data, and review our providers
              annually. No system is perfectly secure; we will notify you and the relevant authority
              of any breach affecting your data within 72 hours as required by law.
            </p>
          </Section>

          <Section title="10. Changes">
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
