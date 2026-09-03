import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BASE_URL } from "@/lib/seo";
import { offers } from "@/lib/offers";
import { articles } from "@/lib/articles";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          // Offer and article pages are the primary organic search targets, so
          // they rank above the legal pages here. Both derive from the same
          // source as the routes themselves, so new entries are listed
          // automatically.
          ...offers.map(
            (o): SitemapEntry => ({
              path: `/services/${o.slug}`,
              changefreq: "monthly",
              priority: "0.8",
            }),
          ),
          { path: "/work", changefreq: "monthly", priority: "0.8" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/process", changefreq: "monthly", priority: "0.8" },
          { path: "/how-we-use-ai", changefreq: "monthly", priority: "0.7" },
          { path: "/articles", changefreq: "weekly", priority: "0.7" },
          ...articles.map(
            (a): SitemapEntry => ({
              path: `/articles/${a.slug}`,
              changefreq: "yearly",
              priority: "0.6",
            }),
          ),
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/compliance", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/cookies", changefreq: "yearly", priority: "0.3" },
          { path: "/do-not-sell", changefreq: "yearly", priority: "0.3" },
          { path: "/data-request", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
