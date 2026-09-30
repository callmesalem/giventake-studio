import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ProsePage, H2, H3, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead, BASE_URL, SITE_NAME } from "@/lib/seo";
import {
  articleBySlug,
  articles,
  formatArticleDate,
  type Article,
  type ArticleBodies,
} from "@/lib/articles";

export const Route = createFileRoute("/articles/$slug")({
  loader: ({ params }) => {
    const article = articleBySlug(params.slug);
    if (!article || !bodies[params.slug]) throw notFound();
    return article;
  },
  head: ({ params }) => {
    const article = articleBySlug(params.slug);
    if (!article) {
      return {
        meta: [{ title: `Not found · ${SITE_NAME}` }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      ...pageHead({
        path: `/articles/${article.slug}`,
        title: article.metaTitle,
        description: article.metaDescription,
        ogType: "article",
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.metaDescription,
            datePublished: article.published,
            dateModified: article.published,
            author: { "@id": `${BASE_URL}/#organization` },
            publisher: { "@id": `${BASE_URL}/#organization` },
            mainEntityOfPage: `${BASE_URL}/articles/${article.slug}`,
          }),
        },
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  // Cast: loader inference doesn't flow through a hand-maintained routeTree
  // until the router plugin regenerates it on the next dev/build run.
  const article = Route.useLoaderData() as Article;
  const Body = bodies[article.slug];
  const others = articles.filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <ProsePage
      eyebrow={article.topic}
      title={article.title}
      lede={article.summary}
      meta={`${formatArticleDate(article.published)} · ${article.readingMinutes} min read`}
    >
      <Body />

      {others.length > 0 && (
        <div className="mt-14 border-t border-hairline pt-8">
          <p className="text-[13px] font-medium text-violet">Keep reading</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((a) => (
              <Link
                key={a.slug}
                to="/articles/$slug"
                params={{ slug: a.slug }}
                className="card-lift rounded-2xl border border-hairline bg-white p-5 shadow-soft"
              >
                <p className="text-[15px] font-semibold leading-snug text-ink">{a.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-ink">{a.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </ProsePage>
  );
}

/* ------------------------------------------------------------------ bodies */

const bodies: ArticleBodies = {
  "what-custom-software-costs": () => (
    <>
      <P>
        Almost nobody publishes this, which is why you&rsquo;re reading a fifth search result to
        find it. Agencies want you on a call before they say a number, and freelance marketplaces
        show rates without scope, which is worse than useless.
      </P>
      <P>
        So here are real ranges, what moves them, and how to tell whether a quote you&rsquo;ve been
        given is realistic. These are market figures for small-business custom development in the
        US, not a price list. Ours are on the{" "}
        <Link to="/services" className="font-semibold text-ink underline">
          services page
        </Link>
        .
      </P>

      <H2>The ranges</H2>
      <H3>A marketing site with a CMS: $2,500 – $15,000</H3>
      <P>
        The low end is a handful of pages on an existing brand, with a content editor your team can
        use. The high end adds custom design, complex content structures, integrations, and a
        migration from an old site with redirects handled properly.
      </P>
      <P>
        Below about $2,000 you are buying a template someone configured, which is a legitimate
        purchase. Just know that&rsquo;s what it is.
      </P>

      <H3>An automation or integration: $3,000 – $12,000</H3>
      <P>
        Connecting systems that don&rsquo;t talk, or automating a repetitive manual process. Cost is
        driven almost entirely by how many systems are involved and how well documented their
        interfaces are. A well-documented modern API is cheap to work with; a legacy system with no
        API and a CSV export is not.
      </P>

      <H3>An internal tool or dashboard: $6,000 – $30,000</H3>
      <P>
        Replacing spreadsheets with one source of truth. The range is wide because &ldquo;a
        dashboard&rdquo; covers everything from one read-only view to a full operational system with
        roles, editing, and audit history. Data migration from messy existing files is routinely
        underestimated by both sides.
      </P>

      <H3>A customer-facing web application: $15,000 – $75,000+</H3>
      <P>
        Anything your customers log into. The jump from internal to customer-facing is real:
        authentication, permissions, payments, and error states all have to work for people you
        can&rsquo;t train and can&rsquo;t call.
      </P>

      <H3>Ongoing development: $2,000 – $10,000+ / month</H3>
      <P>
        A retainer for continuous work. Priced on capacity rather than deliverables, which suits a
        roadmap that changes month to month.
      </P>

      <H2>What actually moves the number</H2>
      <Bullets
        items={[
          <>
            <strong>How well you can describe the current process.</strong> The single biggest
            factor, and the one clients don&rsquo;t expect. If you can walk someone through it step
            by step, scoping is quick and accurate. If you can&rsquo;t, the first phase of the
            project is discovering it, and that gets billed.
          </>,
          <>
            <strong>Integrations.</strong> Each system you connect to adds cost, and legacy systems
            without proper interfaces add a lot.
          </>,
          <>
            <strong>Number of user types.</strong> One kind of user is straightforward. Admin,
            staff, and customer with different permissions is roughly three times the surface area
            to build and test.
          </>,
          <>
            <strong>Data migration.</strong> Moving history out of spreadsheets is nearly always
            underestimated, because the mess only becomes visible once someone tries to import it.
          </>,
          <>
            <strong>Decision speed on your side.</strong> Genuinely a cost driver. A project that
            waits a week for each approval costs more than the same project with a responsive
            contact, because idle time still has to be scheduled around.
          </>,
        ]}
      />

      <H2>What should make you suspicious</H2>
      <Bullets
        items={[
          <>
            <strong>A fixed price with no discovery.</strong> Either they&rsquo;ve padded it
            heavily, or they&rsquo;ll discover the real scope later and come back for more. Neither
            is good for you.
          </>,
          <>
            <strong>A quote far below the ranges above.</strong> Usually means a different
            definition of &ldquo;done&rdquo;: no tests, no documentation, no handoff, and nobody
            available when it breaks.
          </>,
          <>
            <strong>No written exclusion list.</strong> If nobody has told you what
            <em>isn&rsquo;t</em> included, you will find out by invoice.
          </>,
          <>
            <strong>Hourly billing with no cap on an undefined scope.</strong> All the risk sits
            with you.
          </>,
        ]}
      />

      <H2>When you shouldn&rsquo;t build at all</H2>
      <P>
        Plenty of the time, custom software is the wrong answer, and a developer who won&rsquo;t
        tell you that is not one to hire. Buy off-the-shelf if an existing product does 80% of what
        you need, if your process isn&rsquo;t unusual, or if you can&rsquo;t yet describe what the
        software should do. More on that in{" "}
        <Link
          to="/articles/$slug"
          params={{ slug: "buy-or-build" }}
          className="font-semibold text-ink underline"
        >
          buy or build
        </Link>
        .
      </P>

      <Callout title="A useful way to frame the budget">
        Work out what the problem costs you now: hours per week, times what those hours cost, times
        fifty-two. Then compare that to a build that would mostly remove it. If the software pays
        for itself inside eighteen months, it&rsquo;s usually worth doing. If it takes five years,
        spend the money somewhere else.
      </Callout>
    </>
  ),

  "buy-or-build": () => (
    <>
      <P>
        Most businesses that ask this should buy. That&rsquo;s an odd thing to read on a development
        studio&rsquo;s website, but talking someone into a custom build they didn&rsquo;t need is
        how you get a client who resents the invoice.
      </P>
      <P>Here&rsquo;s the honest test.</P>

      <H2>Buy if any of these are true</H2>
      <Bullets
        items={[
          <>
            <strong>An existing product does 80% of what you need.</strong> The last 20% is almost
            never worth the price difference. Adapt your process to the tool.
          </>,
          <>
            <strong>Your process isn&rsquo;t unusual.</strong> If ten thousand other businesses do
            it roughly your way, someone has already built good software for it and spread the cost
            across all of them.
          </>,
          <>
            <strong>You can&rsquo;t describe what the software should do.</strong> Not a criticism.
            It just means you&rsquo;re not ready. Custom development converts a clear specification
            into working software; it can&rsquo;t supply the clarity.
          </>,
          <>
            <strong>The problem is a process problem.</strong> Software makes a good process faster
            and a bad process faster to fail. If nobody follows the current procedure, building
            software won&rsquo;t change that.
          </>,
          <>
            <strong>It&rsquo;s a compliance or accounting function.</strong> Payroll, tax,
            invoicing: buy it. The rules change constantly and a vendor absorbs that for you.
          </>,
        ]}
      />

      <H2>Build if you hit these</H2>
      <Bullets
        items={[
          <>
            <strong>You&rsquo;re paying for four tools and re-keying between them.</strong> The
            subscriptions plus the hours often exceed a build inside two years.
          </>,
          <>
            <strong>The workaround has become the system.</strong> When a spreadsheet has become
            load-bearing and everyone is afraid to touch it, that spreadsheet is describing the
            software you need, usefully, in detail.
          </>,
          <>
            <strong>The thing you do differently is the thing you&rsquo;re good at.</strong> If your
            advantage is a process no product supports, forcing it into off-the-shelf software
            erodes the advantage.
          </>,
          <>
            <strong>You&rsquo;ve outgrown the tool&rsquo;s ceiling.</strong> Per-seat pricing that
            scales badly, or a hard limit you keep bumping into.
          </>,
        ]}
      />

      <Callout title="The most common answer is “both”">
        Buy the commodity parts (accounting, email, payments, storage) and build the thin layer
        that&rsquo;s specific to how you work, connecting them. That&rsquo;s usually far cheaper
        than a full custom system and gets you most of the benefit.
      </Callout>

      <H2>The cost comparison people get wrong</H2>
      <P>
        Comparing a $6,000 build against a $200/month subscription looks obvious until you count
        properly. Over three years the subscription is $7,200, and that&rsquo;s before per-seat
        increases and price rises. But the build has costs the subscription doesn&rsquo;t: hosting,
        maintenance, and the fact that when something breaks, it&rsquo;s yours.
      </P>
      <P>
        A fair comparison includes, on the buy side, subscription across all seats plus the hours
        spent working around what it doesn&rsquo;t do. On the build side: the build, hosting, and a
        realistic maintenance allowance. Software isn&rsquo;t furniture. It needs occasional
        attention or it degrades as everything around it changes.
      </P>

      <H2>A question worth asking first</H2>
      <P>
        <em>What would have to be true for the off-the-shelf option to work?</em>
      </P>
      <P>
        Sometimes the answer is &ldquo;we&rsquo;d have to change how we do onboarding,&rdquo; and
        that turns out to be an improvement you&rsquo;d wanted anyway. Sometimes it&rsquo;s
        &ldquo;we&rsquo;d have to stop doing the thing our customers choose us for.&rdquo; Now you
        have your answer.
      </P>
    </>
  ),

  "what-you-get-at-handoff": () => (
    <>
      <P>
        The end of a project is where a lot of goodwill quietly disappears. The software works, the
        invoice is paid, and six months later you need a change, and discover the original developer
        still owns the hosting account, there&rsquo;s no documentation, and nobody knows which of
        three environments is live.
      </P>
      <P>
        This is the list to agree <em>before</em> the project starts. Any competent developer will
        say yes to all of it; the ones who hesitate are telling you something useful.
      </P>

      <H2>Code and infrastructure</H2>
      <Bullets
        items={[
          <>
            <strong>The repository, transferred to you or with you as owner.</strong> Owner, not
            collaborator. Being a collaborator on someone else&rsquo;s account is not ownership.
          </>,
          <>
            <strong>Hosting in your account, billed to you.</strong> If it sits on the
            developer&rsquo;s account, you don&rsquo;t control your own product.
          </>,
          <>
            <strong>Domain and DNS under your control.</strong>
          </>,
          <>
            <strong>All third-party accounts in your name</strong>: payment processor, email
            service, any API.
          </>,
          <>
            <strong>A documented, repeatable deployment process.</strong> Not one that only works
            from one laptop.
          </>,
        ]}
      />

      <H2>Documentation</H2>
      <Bullets
        items={[
          "How the system works, in plain language, not just code comments",
          "How to make the changes you're most likely to want",
          "Known limitations and the trade-offs that were made deliberately",
          "Where the data lives and how backups work",
        ]}
      />

      <H2>A recorded walkthrough</H2>
      <P>
        A live walkthrough is standard. Ask for it <strong>recorded</strong>: thirty minutes of
        screen recording. Six months later, when the person who attended has left, the recording is
        the only thing that still knows how the system fits together.
      </P>

      <H2>The two people forget to ask for</H2>

      <H3>1. A software bill of materials</H3>
      <P>
        A list of every third-party component in your software and its licence. This matters for a
        reason that only shows up much later: open-source licences carry obligations, and a copyleft
        component buried in a proprietary product is the kind of thing that surfaces during
        acquisition due diligence, years after the developer has moved on.
      </P>
      <P>
        It matters more now that most code is written with AI assistance, because those tools learn
        from public code and can reproduce parts of it. Ask whether a licence scan was run and ask
        to see the result. We explain how we handle this in{" "}
        <Link to="/how-we-use-ai" className="font-semibold text-ink underline">
          how we use AI
        </Link>
        .
      </P>

      <H3>2. Confirmation that their access was removed</H3>
      <P>
        When a project ends, the developer&rsquo;s access should be removed or cut back to whatever
        the support window needs. They should confirm in writing that they&rsquo;ve done it.
      </P>
      <P>
        This protects both sides. You reduce the number of people holding keys to your systems, and
        they stop being a live credential holder for a system they no longer maintain. Almost nobody
        asks for it.
      </P>

      <H2>Commercial</H2>
      <Bullets
        items={[
          <>
            <strong>Clarity on when IP transfers.</strong> Standard practice is on full payment.
            Make sure it&rsquo;s written down.
          </>,
          <>
            <strong>Written acceptance</strong> against criteria agreed at the start, not invented
            at the end.
          </>,
          <>
            <strong>Support window dates, and what&rsquo;s covered.</strong> &ldquo;Thirty days of
            support&rdquo; means little until someone defines whether a new feature request counts.
          </>,
        ]}
      />

      <Callout title="The test">
        Could you hand everything you received to a different developer tomorrow and have them
        productive within a day? If not, the handoff isn&rsquo;t finished, whatever the invoice
        says. Our full{" "}
        <Link to="/process" className="font-semibold text-ink underline">
          process
        </Link>{" "}
        sets out exactly what we hand over and when.
      </Callout>
    </>
  ),
};
