/**
 * Demo sites — the sales-facing "we already built you a demo" asset.
 *
 * The CRM cannot build one. The generator is a Python + headless pipeline
 * (Google Places photos/reviews -> static site -> Vercel deploy) that lives on
 * the VPS with the Maps + Vercel keys, and Cloudflare Workers can run none of
 * it. So demo_sites is a REQUEST QUEUE and a RESULT store: the app writes a
 * 'requested' row, the VPS agent polls, builds, deploys, and writes back the
 * url. See supabase/migrations/20260911223000_demo_sites.sql.
 *
 * Nothing in this module reaches the generator, and nothing here should ever
 * learn how to. The moment a Vercel or Maps key is needed up here, the design
 * has been lost.
 */

/**
 * 'requested' is the only status the app writes. The other four are written by
 * the VPS agent through demo_site_set_result, which validates the string in
 * the database rather than trusting a caller — so this union is a mirror of
 * that check, not the enforcement of it.
 */
export type DemoSiteStatus = "requested" | "building" | "live" | "failed" | "archived";

/** One demo_sites row, camel-cased at the store boundary. */
export interface DemoSiteRow {
  id: string;
  companyId: string | null;
  dealId: string | null;
  businessName: string;
  address: string | null;
  vertical: string | null;
  status: DemoSiteStatus;
  /** Set only once the VPS agent has deployed. Null at every earlier status,
   *  and null on 'failed' — a failed build has no site to link to. */
  url: string | null;
  /** The builder's own message on 'failed'. Shown to the operator verbatim:
   *  it is the only account of why there is no demo, and paraphrasing it in
   *  the UI would leave nobody able to act on it. */
  error: string | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
