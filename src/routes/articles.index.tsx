import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { IconArrowRight } from "@/components/marks";
import { pageHead } from "@/lib/seo";
import { articles, formatArticleDate } from "@/lib/articles";

export const Route = createFileRoute("/articles/")({
  head: () =>
    pageHead({
      path: "/articles",
      title: "Articles · Straight Answers About Custom Software · GivenTake Devs",
      description:
        "Practical writing for people deciding whether to commission custom software: what it costs, whether to buy or build, and what to expect from a developer.",
    }),
  component: ArticlesIndexPage,
});

function ArticlesIndexPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />

      <main>
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <p className="text-[13px] font-medium text-violet">Articles</p>
            <h1 className="mt-3 font-display text-[38px] font-medium leading-[1.03] tracking-[-0.03em] text-ink md:text-[48px]">
              Straight answers about custom software.
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-muted-ink">
              Written for people deciding whether to commission software at all, including the cases
              where the honest answer is don&rsquo;t. No newsletter, no gated PDFs.
            </p>
          </div>
        </section>

        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <div className="space-y-4">
              {articles.map((a) => (
                <Link
                  key={a.slug}
                  to="/articles/$slug"
                  params={{ slug: a.slug }}
                  className="card-lift group block rounded-2xl border border-hairline bg-white p-6 shadow-soft transition hover:border-ink md:p-7"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                      {a.topic}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-hairline" />
                    <span className="text-[12px] text-muted-ink">
                      {formatArticleDate(a.published)} · {a.readingMinutes} min read
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-[24px] font-medium leading-snug tracking-[-0.02em] text-ink md:text-[28px]">
                    {a.title}
                  </h2>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-muted-ink">{a.summary}</p>
                  <span className="btn-icon-nudge mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet group-hover:gap-2.5">
                    Read it
                    <IconArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
