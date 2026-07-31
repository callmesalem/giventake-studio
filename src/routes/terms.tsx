import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      path: "/terms",
      title: "Terms of Service · GivenTake Goods Devs",
      description:
        "The terms that govern your use of the GivenTake Goods Devs website and any services provided.",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">Legal</p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Terms of Service
        </h1>
        <p className="mt-3 text-[13px] text-muted-ink">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink">
          <Section title="1. Acceptance">
            <p>
              By using this website you agree to these terms. If you don't agree, please don't use
              the site. Custom engagements are governed by a separate signed statement of work,
              which controls in case of conflict.
            </p>
          </Section>

          <Section title="2. Use of the site">
            <p>
              You may browse and contact us through the site for lawful business purposes. You agree
              not to attempt to breach security, scrape at abusive rates, submit malicious content,
              or misrepresent your identity.
            </p>
          </Section>

          <Section title="3. Intellectual property">
            <p>
              All content on this site, including text, code samples, illustrations, and the
              "GivenTake" wordmark, is owned by GivenTake Goods Devs or licensed to us. You may not
              reuse it commercially without written permission.
            </p>
          </Section>

          <Section title="4. Contact form">
            <p>
              Submissions are informational and not a binding contract. No engagement begins until
              both parties countersign a written statement of work. Do not send confidential,
              regulated, or sensitive personal information through the form.
            </p>
          </Section>

          <Section title="5. Third-party links">
            <p>
              The site may link to third-party sites. We are not responsible for their content or
              practices. Review their terms before using them.
            </p>
          </Section>

          <Section title="6. Disclaimers">
            <p>
              The site is provided "as is" without warranties of any kind, express or implied,
              including merchantability, fitness for a particular purpose, and non-infringement. We
              do not guarantee uninterrupted or error-free operation.
            </p>
          </Section>

          <Section title="7. Limitation of liability">
            <p>
              To the fullest extent permitted by law, GivenTake Goods Devs is not liable for
              indirect, incidental, consequential, or punitive damages arising from your use of the
              site. Our total liability for direct damages is limited to USD 100, or the amount you
              have paid us in the past 12 months, whichever is greater.
            </p>
          </Section>

          <Section title="8. Governing law">
            <p>
              These terms are governed by the laws of the jurisdiction where GivenTake Goods Devs is
              registered, without regard to conflict-of-laws principles. Disputes will be resolved
              in the courts of that jurisdiction, unless mandatory local consumer-protection law
              requires otherwise.
            </p>
          </Section>

          <Section title="9. Changes">
            <p>
              We may revise these terms. The "last updated" date shows when. Continued use after a
              change means you accept the updated terms.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about these terms:{" "}
              <a href="mailto:legal@giventake.dev" className="underline">
                legal@giventake.dev
              </a>
              .
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
