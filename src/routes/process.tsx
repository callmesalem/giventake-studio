import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead } from "@/lib/seo";

/**
 * Public version of docs/business/09-client-process.md.
 *
 * The five steps here are the same five on the homepage (components/sections/how.tsx)
 * — Call, Plan, Build, Launch, Report. Keep both in sync.
 *
 * Deliberately omits the internal half: the red-flags / when-to-decline list,
 * effective-hourly-rate and utilization tracking, and the internal side of the
 * retrospective. Those are operating guidance, not buyer-facing material.
 *
 * Everything published here is a commitment a client can hold us to, so keep it
 * in sync with the source document — do not add a step or a checkpoint here that
 * we don't actually run.
 */

type Step = {
  n: string;
  title: string;
  duration: string;
  body: string;
  /** The gate nested inside this step. Call and Report don't have one. */
  checkpoint?: string;
  yours: string;
};

const steps: Step[] = [
  {
    n: "01",
    title: "Call",
    duration: "30 minutes, free",
    body: "One conversation, not a series of them. We ask what you're trying to build, what happens if you do nothing, roughly what budget you're working with, and what's driving the timeline. Then we go deeper on the same call: walk us through the last time the problem actually happened, step by step. The general description is always tidier than the reality, so we put numbers on it while you're there. How often, how long, who does it, and what it costs when it goes wrong.",
    yours:
      "An honest answer about fit, and a written summary within 24 hours asking “did we get this right?” Any misunderstanding surfaces before it's priced in. If we're not the right people, we'll say so and point you somewhere better.",
  },
  {
    n: "02",
    title: "Plan",
    duration: "Within a week",
    body: "We turn the call into a written quote and proposal: the problem in your words, what we'll build, what we won't, objective acceptance criteria, a timeline, and the price. Scoping is part of quoting, so you are not charged for it. We send our AI use disclosure alongside it, unprompted. If anything is still fuzzy, we map that part of the process with you before pricing it rather than guessing.",
    checkpoint:
      "A written quote and proposal: scope, price, timeline, exclusions, and what done means. Nothing is built until you approve it.",
    yours:
      "A fixed price against a fixed scope, in writing, that you can read without a lawyer and compare against anyone else's.",
  },
  {
    n: "03",
    title: "Build",
    duration: "2 to 4 weeks for a marketing site",
    body: "We collect access, confirm who decides, put a weekly demo in the calendar, and record the starting numbers so the result can be measured later rather than asserted. Then every week you get something you can click, plus a short written update: what shipped, what's next, what we need from you, and anything at risk. Anything outside the agreed scope goes through a written change order with a price before the work happens, never a chat message.",
    checkpoint:
      "Before any release ships, a checklist is run against it: every AI-generated file read by a human, authentication, authorization, and payment paths reviewed line by line, tests passing on the critical paths, a licence and provenance scan, no secrets in the repository, dependency vulnerabilities checked. The completed checklist is committed to your repository.",
    yours:
      "A working demo every week, so the gap between what you pictured and what exists is never more than seven days wide.",
  },
  {
    n: "04",
    title: "Launch",
    duration: "Week of launch",
    body: "We handle the domain, the security certificate, and your analytics setup, then test on real phones before anything goes live. Then everything transfers: source code and repository ownership, a deployment you control, written documentation, a recorded walkthrough you can replay, a software bill of materials, and credentials moved across securely. Our access is removed or reduced, and we confirm that in writing.",
    checkpoint:
      "We test against the acceptance criteria from the Plan, not a new set invented at the end. You have 10 business days to accept or report a defect in writing, and anything failing those criteria is fixed at no charge.",
    yours:
      "Everything needed to run, change, or hand the site to someone else. Nothing locked to us, and a standard for “done” that was set before the work started.",
  },
  {
    n: "05",
    title: "Report",
    duration: "Monthly, optional",
    body: "The build includes 30 days of post-launch support for bug fixes. After that, the $99/mo care plan is the ongoing mechanism: hosting, security, backups, uptime monitoring, small content edits within two business days, and a report every month. Leads you got, where they came from, what we changed, what worked, and the one fix we'd make next. Plain English, month to month, cancel any time. New pages, new features, and redesigns are separate project work, quoted in writing like the first build.",
    yours:
      "A monthly report telling you what the site is actually doing for your business, and no obligation to keep paying for it.",
  },
];

export const Route = createFileRoute("/process")({
  head: () =>
    pageHead({
      path: "/process",
      title: "Our Process · The Five Steps Every Project Runs · GivenTake Devs",
      description:
        "The five steps every project runs through, from a free 30-minute call to a monthly report: a written quote before any code, weekly working demos, a review checklist you keep, and a full handoff package.",
    }),
  component: ProcessPage,
});

function ProcessPage() {
  return (
    <ProsePage
      eyebrow="Our process"
      title="The same five steps, every project."
      lede="Most web projects go wrong in predictable ways: scope that was never written down, “done” that was never defined, and a change agreed in a chat message that nobody priced. This is the process we run to prevent those. It's published in full so you can hold us to it."
    >
      <Callout title="Why this is public">
        Anyone can say they use AI coding agents; you can&rsquo;t verify it and it won&rsquo;t be a
        differentiator for long. A written process you can read before you hire us is something you
        can actually check, and something you can hold against whoever else you&rsquo;re
        considering.
      </Callout>

      <H2>The five steps</H2>
      <P>
        Each step has a condition for starting, something it produces, and a checkpoint it has to
        pass before the next one begins. We don&rsquo;t wave a checkpoint through to move faster,
        because each one exists to prevent something that costs more later.
      </P>

      <div className="mt-10 space-y-4">
        {steps.map((s) => (
          <article
            key={s.n}
            className="rounded-2xl border border-hairline bg-white p-6 shadow-soft md:p-7"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-[22px] font-medium tracking-tight text-violet">
                {s.n}
              </span>
              <h3 className="text-[19px] font-semibold tracking-tight text-ink">{s.title}</h3>
              <span className="rounded-full border border-hairline bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-ink">
                {s.duration}
              </span>
            </div>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink/85">{s.body}</p>
            {s.checkpoint && (
              <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-[14.5px] leading-relaxed text-ink/85">
                <span className="font-semibold text-violet">Checkpoint:</span> {s.checkpoint}
              </p>
            )}
            <p className="mt-4 border-t border-hairline pt-3.5 text-[14.5px] leading-relaxed text-muted-ink">
              <span className="font-semibold text-ink">What you get:</span> {s.yours}
            </p>
          </article>
        ))}
      </div>

      <H2>What it costs to run this</H2>
      <P>
        Custom websites start at $499. The final number depends on scope and you get it in writing
        as a quote and proposal before any work starts. Payment plans and financing are available.
        You own the site outright once the build is paid for: the design, the code, the content, the
        domain, and your customer data.
      </P>
      <P>
        Step five is the only recurring cost, and it is optional. The care plan is $99 a month,
        month to month, cancel any time. Full detail is on the{" "}
        <Link to="/pricing" className="font-semibold text-ink underline">
          pricing page
        </Link>
        .
      </P>

      <H2>The four rules behind it</H2>
      <P>
        If you remember nothing else from this page, these are the commitments that matter most.
        They&rsquo;re the ones worth asking any developer about, not just us.
      </P>
      <Bullets
        items={[
          <>
            <strong>Nothing is built before the written quote is approved.</strong> Not a prototype,
            not a head start. A fixed price on an undefined scope is how both sides end up unhappy.
          </>,
          <>
            <strong>A working demo every week.</strong> Not a status email. If what we&rsquo;re
            building has drifted from what you pictured, you find out in seven days, not seven
            weeks.
          </>,
          <>
            <strong>Scope changes go in writing, with a price, before the work happens.</strong> We
            will not build something agreed verbally and invoice you for it afterwards.
          </>,
          <>
            <strong>Nothing ships without human review.</strong> There&rsquo;s a completed checklist
            in your repository for every release.
          </>,
        ]}
      />

      <H2>What we need from you</H2>
      <P>
        The timelines above assume a couple of things, and it&rsquo;s fairer to say so up front than
        to explain it later:
      </P>
      <Bullets
        items={[
          "One person with authority to approve scope and sign off deliverables",
          "Responses to questions and feedback within about five business days",
          "Availability for a weekly demo, usually 30 minutes",
          "Access to the systems we're integrating with, at the start of the build rather than mid-build",
        ]}
      />
      <P>
        Where those slip, timelines move day for day. That isn&rsquo;t a penalty. It&rsquo;s the
        only way a fixed date can be honest when half the inputs are outside our control.
      </P>

      <Callout title="Related">
        <Link to="/how-we-use-ai" className="font-semibold text-ink underline">
          How we use AI
        </Link>{" "}
        explains what the coding agents do, what a human does, and the two limitations most studios
        won&rsquo;t mention.{" "}
        <Link to="/services" className="font-semibold text-ink underline">
          Services and pricing
        </Link>{" "}
        shows what this process produces, and what it costs.
      </Callout>
    </ProsePage>
  );
}
