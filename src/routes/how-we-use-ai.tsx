import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, H3, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead } from "@/lib/seo";

/**
 * Public version of docs/contracts/ai-use-disclosure.md.
 *
 * Keep the two "things we'll tell you that others might not" sections. They are
 * the reason this page builds trust rather than just describing a method — a
 * competitor claiming AI delivery will not volunteer the copyright limitation or
 * the open-source provenance risk. Keep the two versions in sync: the document
 * goes out with proposals, this is the public copy.
 */

export const Route = createFileRoute("/how-we-use-ai")({
  head: () =>
    pageHead({
      path: "/how-we-use-ai",
      title: "How We Use AI to Build Your Software · GivenTake Devs",
      description:
        "Exactly how AI coding agents are used in our delivery, what a human reviews, what we warrant, and the two limitations most studios won't tell you about.",
    }),
  component: HowWeUseAiPage,
});

function HowWeUseAiPage() {
  return (
    <ProsePage
      eyebrow="How we work"
      title="How we use AI to build your software"
      lede="We build with AI coding agents, and a human reviews everything before it ships. This page explains exactly what that means for you — including the parts that are genuinely less certain than a traditional development shop would tell you."
      ctaTitle="Questions about any of this?"
      ctaBody="We'd rather answer an awkward question now than have it surface after you've signed."
    >
      <H2>The short version</H2>
      <P>
        AI coding agents write most of the code. A human decides what gets built, reviews every line
        before it ships, and is accountable for the result. That&rsquo;s how we deliver in weeks
        what traditionally takes months.
      </P>

      <H2>What the AI does</H2>
      <P>
        AI coding agents write the scaffolding, the boilerplate, the repetitive work, and the first
        draft of tests. This is the part of software development that is time-consuming without
        being difficult, and it is what used to make projects take months.
      </P>

      <H2>What a human does</H2>
      <P>Everything that determines whether the software actually works for your business:</P>
      <Bullets
        items={[
          <>
            <strong>Architecture and technical decisions</strong> &mdash; how the system is
            structured and what it&rsquo;s built on
          </>,
          <>
            <strong>Reviewing every line before it ships</strong> &mdash; AI-generated code is read,
            not skimmed
          </>,
          <>
            <strong>Line-by-line review of the risky parts</strong> &mdash; anything touching login,
            permissions, or payments gets manual scrutiny, because that&rsquo;s where automated
            output is most confidently wrong
          </>,
          <>
            <strong>Security review</strong>
          </>,
          <>
            <strong>Testing against the real requirements</strong>, not just whether the code runs
          </>,
          <>
            <strong>Deciding what ships</strong>
          </>,
          <>
            <strong>Talking to you</strong> &mdash; you deal with whoever is building your software,
            not an account manager
          </>,
        ]}
      />
      <Callout>
        <strong>Nothing is deployed without human approval.</strong> That&rsquo;s a commitment, not
        a slogan &mdash; it&rsquo;s written into our contracts and there&rsquo;s a completed review
        checklist in your project repository to prove it happened.
      </Callout>

      <H3>What we don&rsquo;t let the AI decide</H3>
      <Bullets
        items={[
          "Your architecture or technology stack",
          "Your user experience",
          "What's secure enough to ship",
          "What “done” means",
          "Anything we'd have to explain to you afterward",
        ]}
      />

      <H2>What this means for you</H2>
      <P>
        <strong>Speed.</strong> Weeks instead of months, because the slow mechanical part is
        automated.
      </P>
      <P>
        <strong>Cost.</strong> You&rsquo;re paying for judgment and review rather than for someone
        typing boilerplate.
      </P>
      <P>
        <strong>Quality.</strong> Automated tests on the paths that matter, plus human review.
        Faster does not mean less tested &mdash; if anything, AI makes comprehensive test coverage
        cheaper, so there tends to be more of it.
      </P>
      <P>
        <strong>Transparency.</strong> You always know how your software was built. It&rsquo;s in
        your contract.
      </P>

      <H2>Your data</H2>
      <Bullets
        items={[
          <>
            <strong>
              Business and enterprise AI tools configured so your material is not used to train
              models.
            </strong>{" "}
            We keep a register of every tool we use, its data-retention terms, and when we last
            verified them. Ask for it any time and we&rsquo;ll send it.
          </>,
          <>
            <strong>No secrets in AI tools.</strong> Passwords, API keys, and credentials are never
            pasted into an AI system.
          </>,
          <>
            <strong>No real customer data for testing.</strong> We use synthetic or anonymised data.
          </>,
          <>
            <strong>If you have restrictions, tell us before we start.</strong> Some businesses,
            particularly in regulated industries, have policies against third-party AI processing.
            That&rsquo;s a fine constraint to work within &mdash; but we need to know at the start,
            not at delivery.
          </>,
          <>
            <strong>If personal data is involved</strong>, we put a data processing agreement in
            place first.
          </>,
        ]}
      />

      <H2>Two things we&rsquo;ll tell you that others might not</H2>
      <P>We&rsquo;d rather you hear these from us than from your lawyer after signing.</P>

      <H3>1. Copyright in AI-generated code is legally unsettled</H3>
      <P>
        The U.S. Copyright Office&rsquo;s position is that material generated purely by AI
        isn&rsquo;t protected by copyright, because copyright requires human authorship. The law
        here is still developing.
      </P>
      <P>
        <strong>What this means practically:</strong> we assign you every right we hold in your
        software, and you get complete freedom to use, modify, sell, and build on it. What we
        won&rsquo;t do is promise that an exclusive copyright exists in the AI-generated portions,
        because that may not be legally true &mdash; and a promise we can&rsquo;t back is worth
        nothing to you.
      </P>
      <Callout title="Does this matter for your business?">
        For almost every business application, no. What you need is the right to use your software,
        change it, and stop anyone else from taking it &mdash; and you have all of that. It would
        matter if your business model depended on suing someone for copying your source code, which
        is unusual. We&rsquo;d rather flag it than have you discover it later.
      </Callout>

      <H3>2. AI tools can reproduce existing code</H3>
      <P>
        AI coding assistants learn from public code, and they can occasionally reproduce parts of it
        &mdash; including code under licences that would impose obligations on your business if it
        ended up in your product.
      </P>
      <P>
        <strong>What we do about it:</strong>
      </P>
      <Bullets
        items={[
          "Run automated licence and provenance scans before delivery",
          "Provide a software bill of materials listing every component and its licence",
          "Configure our tools to suppress suggestions matching public code where that setting exists",
          "Flag anything that needs your attention before delivery, not in a footnote after",
        ]}
      />
      <P>
        <strong>What we won&rsquo;t claim:</strong> that this is a perfect guarantee. No scan
        catches everything, and this risk exists in traditional development too &mdash; developers
        have always copied from Stack Overflow. AI makes it more likely and more invisible, which is
        why we scan rather than assume.
      </P>

      <H2>Questions clients ask</H2>

      <H3>&ldquo;If AI writes the code, why am I paying you?&rdquo;</H3>
      <P>
        Because the code is the easy part. Knowing what to build, structuring it so it still works
        in two years, catching what the AI got confidently wrong, and being accountable when
        something breaks &mdash; that&rsquo;s the work. The AI made the typing faster; it
        didn&rsquo;t make the judgment unnecessary.
      </P>

      <H3>&ldquo;Is AI-built software lower quality?&rdquo;</H3>
      <P>
        It&rsquo;s as good as the review. Unreviewed AI code is genuinely bad, and there are studios
        shipping exactly that. Reviewed AI code, with tests, is comparable to hand-written code and
        usually better tested, because writing tests got cheap. That&rsquo;s why our review process
        is in the contract rather than just on the website.
      </P>

      <H3>&ldquo;What if I don&rsquo;t want AI used on my project?&rdquo;</H3>
      <P>
        Tell us. We can discuss traditional development, though the timeline and cost would be
        closer to conventional agency rates &mdash; that difference is exactly what AI-assisted
        delivery buys you.
      </P>

      <H3>&ldquo;Who owns the software?&rdquo;</H3>
      <P>You do, on full payment. See the copyright note above for the one nuance.</P>

      <H3>&ldquo;What if you disappear?&rdquo;</H3>
      <P>
        You get the source code, the repository, documentation, and a deployment you control.
        Nothing is locked to us. That&rsquo;s true from the first delivery, not just at the end.
      </P>

      <Callout title="Related">
        <Link to="/process" className="font-semibold text-ink underline">
          Our process
        </Link>{" "}
        sets out the stages every project runs through, and where the human checkpoints sit.
      </Callout>
    </ProsePage>
  );
}
