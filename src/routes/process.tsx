import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead } from "@/lib/seo";

/**
 * Public version of docs/business/09-client-process.md.
 *
 * Deliberately omits the internal half: the red-flags / when-to-decline list,
 * effective-hourly-rate and utilization tracking, and the internal side of the
 * retrospective. Those are operating guidance, not buyer-facing material.
 *
 * Everything published here is a commitment a client can hold us to, so keep it
 * in sync with the source document — do not add a stage or a gate here that we
 * don't actually run.
 */

const stages = [
  {
    n: "01",
    title: "Qualifying call",
    duration: "10 minutes",
    body: "A short call to work out whether this is worth either of our time. What you're trying to build, what happens if you do nothing, roughly what budget you're working with, and what's driving the timeline.",
    yours:
      "An honest answer about fit. If we're not the right people, we'll say so and point you somewhere better.",
  },
  {
    n: "02",
    title: "Discovery",
    duration: "45–60 minutes",
    body: "A structured conversation, not a chat. We'll ask you to walk us through the last time the problem actually happened, step by step — because the general description is always tidier than the reality. Then we quantify it: how often, how long, who does it, what it costs when it goes wrong.",
    yours:
      "A written summary within 24 hours asking “did we get this right?” — so any misunderstanding surfaces before it's priced in.",
  },
  {
    n: "03",
    title: "Scope",
    duration: "A few days, or a paid sprint",
    body: "For a clear project, we go straight to a proposal. For anything complex or still fuzzy, we'll suggest a paid discovery sprint that maps the process properly and produces a fixed quote — the fee comes off the build if you proceed.",
    yours:
      "A proposal with the problem in your words, what we'll build, what we won't, objective acceptance criteria, a timeline, and a fixed price.",
  },
  {
    n: "04",
    title: "Agreement",
    duration: "Same week",
    body: "A master services agreement covering the terms that don't change, and a statement of work covering scope, price, dates, and what “done” means. We send our AI use disclosure alongside it, unprompted.",
    yours: "A fixed price and a fixed scope in writing. Nothing starts until both are signed.",
  },
  {
    n: "05",
    title: "Kickoff",
    duration: "Week 1",
    body: "We confirm who decides, collect access, put a weekly demo in the calendar, and agree how we'll communicate. Then we measure the baseline: how long the current process takes, how often it happens, what the current error or no-show rate is.",
    yours:
      "Recorded starting numbers — so at the end, the improvement is measured rather than asserted.",
  },
  {
    n: "06",
    title: "Build",
    duration: "Weekly cycles",
    body: "Every week you get something you can click, plus a short written update: what shipped, what's next, what we need from you, and anything at risk. Anything outside the agreed scope goes through a written change order before the work happens, never a chat message.",
    yours:
      "A working demo every week. The gap between what you pictured and what exists is never more than seven days wide.",
  },
  {
    n: "07",
    title: "Review gate",
    duration: "Before anything ships",
    body: "A checklist run against every release: every AI-generated file read by a human, authentication and authorization and payment paths reviewed line by line, tests passing on the critical paths, a licence and provenance scan, no secrets in the repository, dependency vulnerabilities checked.",
    yours:
      "The completed checklist, committed to your repository. “We reviewed it” is demonstrable rather than asserted.",
  },
  {
    n: "08",
    title: "Acceptance",
    duration: "10 business days",
    body: "We test against the acceptance criteria agreed in stage 3 — not a new set invented at the end. Anything that fails those criteria gets fixed at no charge.",
    yours:
      "A clear standard for “done” that was set before the work started, so it can't move in either direction.",
  },
  {
    n: "09",
    title: "Handoff",
    duration: "Week of launch",
    body: "Source code and repository ownership, a deployment you control, written documentation, a recorded walkthrough you can replay, a software bill of materials, and credentials transferred securely. Our access is removed or reduced, and we confirm that in writing.",
    yours:
      "Everything needed to run, change, or hand the system to someone else. Nothing locked to us.",
  },
  {
    n: "10",
    title: "Support window",
    duration: "30–60 days",
    body: "Defects against the acceptance criteria get fixed. Small content and configuration adjustments are included. We log every request so you can see what's a defect and what's a new feature.",
    yours:
      "A defined window with defined coverage, so you know what you're getting rather than hoping.",
  },
  {
    n: "11",
    title: "Retrospective",
    duration: "Two weeks after handoff",
    body: "We re-measure the baseline numbers from kickoff and tell you what actually changed — including if it changed less than we hoped.",
    yours:
      "Real numbers on whether the investment worked. If it's ongoing work, this is where a retainer conversation makes sense.",
  },
];

export const Route = createFileRoute("/process")({
  head: () =>
    pageHead({
      path: "/process",
      title: "Our Process · How Every Project Runs · GivenTake Devs",
      description:
        "The eleven stages every project runs through, from qualifying call to retrospective — with written scope before code, weekly working demos, a review gate, and a full handoff package.",
    }),
  component: ProcessPage,
});

function ProcessPage() {
  return (
    <ProsePage
      eyebrow="Our process"
      title="The same process, every project."
      lede="Most development goes wrong in predictable ways: scope that was never written down, “done” that was never defined, and a change agreed in a chat message that nobody priced. This is the process we run to prevent those — published in full, so you can hold us to it."
    >
      <Callout title="Why this is public">
        Anyone can say they use AI coding agents; you can&rsquo;t verify it and it won&rsquo;t be a
        differentiator for long. A written process you can read before you hire us is something you
        can actually check &mdash; and something you can hold against whoever else you&rsquo;re
        considering.
      </Callout>

      <H2>The eleven stages</H2>
      <P>
        Each stage has a condition for starting, something it produces, and a gate it has to pass
        before the next one begins. We don&rsquo;t skip a gate to move faster, because every gate
        exists to prevent something that costs more later.
      </P>

      <div className="mt-10 space-y-4">
        {stages.map((s) => (
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
            <p className="mt-4 border-t border-hairline pt-3.5 text-[14.5px] leading-relaxed text-muted-ink">
              <span className="font-semibold text-ink">What you get:</span> {s.yours}
            </p>
          </article>
        ))}
      </div>

      <H2>The four rules behind it</H2>
      <P>
        If you remember nothing else from this page, these are the commitments that matter most
        &mdash; and the ones worth asking any developer about, not just us.
      </P>
      <Bullets
        items={[
          <>
            <strong>Nothing is built before the scope is signed.</strong> Not a prototype, not a
            head start. A fixed price on an undefined scope is how both sides end up unhappy.
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
          "Access to the systems we're integrating with, at kickoff rather than mid-build",
        ]}
      />
      <P>
        Where those slip, timelines move day for day. That isn&rsquo;t a penalty &mdash; it&rsquo;s
        the only way a fixed date can be honest when half the inputs are outside our control.
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
