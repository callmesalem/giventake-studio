import type { ReactNode } from "react";

/**
 * Long-form articles at /articles/<slug>.
 *
 * Strategy (docs/business/08 §5): narrow, useful, buyer-facing content aimed at
 * people already deciding — not generic "10 benefits of AI" posts, which rank
 * for nothing and attract browsers rather than buyers.
 *
 * Truthfulness rules, same as the rest of the site:
 *   - No outcome metrics from work we haven't delivered. Cost and time figures
 *     must be stated as market ranges with the reasoning shown, never as
 *     "our clients save X".
 *   - No invented client anecdotes. Write "a business with five spreadsheets",
 *     never "a client of ours".
 *   - Studio voice ("we"), no headcount claims.
 *   - Honest content includes the cases where the answer is "don't hire us".
 *     That's what makes the rest of it credible.
 *
 * Body content lives in the route component, keyed by slug, so articles can use
 * the shared prose components rather than a markdown renderer.
 */

export type Article = {
  slug: string;
  title: string;
  /** Shown on the hub and as the page lede. */
  summary: string;
  metaTitle: string;
  metaDescription: string;
  /** ISO date. Used for display and Article JSON-LD. */
  published: string;
  readingMinutes: number;
  topic: string;
};

export const articles: Article[] = [
  {
    slug: "what-custom-software-costs",
    title: "What does custom software actually cost?",
    summary:
      "Real ranges for internal tools, automations, and web apps — plus what actually drives the number up or down, and when you shouldn't build at all.",
    metaTitle: "What Does Custom Software Actually Cost? (2026 Ranges) · GivenTake Devs",
    metaDescription:
      "Honest price ranges for custom internal tools, automations, and web applications, what drives the cost up or down, and how to tell whether a quote is realistic.",
    published: "2026-08-01",
    readingMinutes: 7,
    topic: "Budgeting",
  },
  {
    slug: "buy-or-build",
    title: "Should you buy software or build it?",
    summary:
      "Most of the time you should buy. Here's how to tell which situation you're in, and the four signals that mean off-the-shelf has genuinely run out.",
    metaTitle: "Should You Buy Software or Build It? · GivenTake Devs",
    metaDescription:
      "A practical test for whether to buy off-the-shelf software or commission a custom build, including the cases where buying is clearly the right answer.",
    published: "2026-08-01",
    readingMinutes: 6,
    topic: "Deciding",
  },
  {
    slug: "what-you-get-at-handoff",
    title: "What you should get when a development project ends",
    summary:
      "The handoff checklist to hold any developer to — including the two things people forget to ask for until they need them and it's too late.",
    metaTitle: "What You Should Get at Handoff From a Development Project · GivenTake Devs",
    metaDescription:
      "The complete list of what a developer should hand over at the end of a project: code, deployment, documentation, credentials, SBOM, and access removal.",
    published: "2026-08-01",
    readingMinutes: 5,
    topic: "Hiring developers",
  },
];

export const articleBySlug = (slug: string) => articles.find((a) => a.slug === slug);

export function formatArticleDate(iso: string): string {
  // Explicit UTC parts — avoids a locale/timezone mismatch between the SSR
  // render and hydration, which would trigger a React hydration warning.
  const d = new Date(`${iso}T00:00:00Z`);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Registered in the route module; kept as a type here to avoid a cycle. */
export type ArticleBodies = Record<string, () => ReactNode>;
