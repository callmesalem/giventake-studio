import ogImageAsset from "@/assets/giventake-og.png.asset.json";

/**
 * Single source of truth for the production origin. Canonical links, Open Graph
 * URLs, the sitemap and the JSON-LD graph all derive from this — change it here
 * and nowhere else when the custom domain goes live.
 *
 * `public/robots.txt` is a static file and cannot import this; update its
 * Sitemap: line by hand at the same time.
 */
export const BASE_URL = "https://giventakedevs.com";
export const OG_IMAGE_URL = `${BASE_URL}${ogImageAsset.url}`;
export const SITE_NAME = "GivenTake Devs";

/**
 * Legal entity that actually contracts, used in the legal pages and JSON-LD.
 *
 * TODO(before launch): confirm once the entity is formed with the Ohio SOS.
 * This is NOT GivenTake Goods LLC (SOS doc 202225804070) — that entity performed
 * contractor work and carries a construction-defect tail under ORC 2305.131, so
 * the studio is being set up in a separate LLC. See
 * docs/business/01-structure-and-formation.md. The site must never name an
 * entity other than the one that signs the client agreements.
 */
export const LEGAL_ENTITY = "GivenTake Devs LLC";
export const LEGAL_ENTITY_LONG = `${SITE_NAME} is operated by ${LEGAL_ENTITY}, an Ohio limited liability company`;

/**
 * TODO(before launch): replace with the registered business address.
 * A registered-agent or virtual-office address is fine — the point is that the
 * legal pages identify a real, servable address for the entity. Do not publish
 * the site with this placeholder still in place.
 */
export const BUSINESS_ADDRESS = "[registered business address, Ohio]";

/** Governing law / venue for the website terms. */
export const GOVERNING_STATE = "the State of Ohio";

type PageHeadInput = {
  /** Route path beginning with a slash, e.g. "/privacy". */
  path: string;
  title: string;
  description: string;
  /** Defaults to "website". */
  ogType?: string;
};

/**
 * Builds a complete, self-referencing head() payload: title, description,
 * canonical, Open Graph and Twitter card metadata for a leaf route.
 */
export function pageHead({ path, title, description, ogType = "website" }: PageHeadInput) {
  const url = `${BASE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: ogType },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE_NAME} — Your On-Demand Development Team` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
