/**
 * Whether an asset descriptor still points somewhere real.
 *
 * The site was built on Lovable and its images were served from Lovable's CDN
 * under /__l5e/. When the apex moved to the Cloudflare Worker those paths began
 * returning 404 - the binaries were never in this repository, only descriptors
 * pointing at Lovable's bucket, and that bucket is no longer reachable.
 *
 * Referencing a 404 is worse than referencing nothing. A broken <img> renders a
 * placeholder icon, and a broken og:image is cached as broken by scrapers that
 * do not retry. So anything still on the old prefix is treated as absent until
 * a real file replaces it.
 */
export function assetAvailable(url: string | null | undefined): boolean {
  return Boolean(url) && !String(url).startsWith("/__l5e/");
}
