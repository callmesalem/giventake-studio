import ogImageAsset from "@/assets/giventake-og.png.asset.json";

export const BASE_URL = "https://dev-on-demand-hub.lovable.app";
export const OG_IMAGE_URL = `${BASE_URL}${ogImageAsset.url}`;
export const SITE_NAME = "GivenTake Goods Devs";

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
