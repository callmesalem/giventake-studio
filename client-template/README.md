# client-template

A framework-free static starter for GivenTake Devs managed-website client builds.
Plain HTML, CSS, and vanilla JavaScript. No framework, no runtime dependencies.

Every client site built from this template ships with:

- Lead form with honeypot, idempotency key, and client-side throttle, posting to
  a Cloudflare Worker that delivers to the GivenTake CRM with UTM attribution.
- Consent-gated tracking: GA4, Meta pixel, and LinkedIn Insight load only after
  the visitor accepts. Nothing is tracked before a choice.
- JSON-LD schema (LocalBusiness subtype + Service pages) generated from config.
- SEO gate: builds ship `noindex,nofollow` until the production flag is set.
- The giventake-kit check suite plus a `/built.html` colophon page.

## New client checklist

1. **Copy this folder** to the client's working directory. It is standalone;
   nothing outside it is needed.
2. **Fill in `client.config.json`.** Every value is an EXAMPLE. Replace business
   name, tagline, phone, email, address, site URL, services (name, slug, blurb),
   tracking IDs, and schema type. Leave a tracking ID empty to skip that provider.
   Service blurbs must be written per client, never invented.
3. **Replace the favicon** at `assets/favicon.svg` with the client's mark.
4. **Write the content.** Search the built pages for `TODO(client)` and replace
   every one. Service pages, homepage copy, and the value-tool section are
   per-client work.
5. **Complete `privacy.html` and `terms.html`.** Structure is provided; the policy
   wording must reflect the client's real data practices. The privacy page has a
   required **SMS communications** section: if the client will use a Twilio
   number, that section must describe messaging practices and state that numbers
   are not shared, or Twilio verification will be rejected.
6. **Value tool (optional).** Build the client's interactive tool (planner, quiz,
   calculator) into the `#value-tool` section of `pages/home.html`, unhide the
   section, and call `attachValueToolResult({...})` with the result object. It is
   attached to the lead form and sent with the enquiry.
7. **Build:** `npm run build` (or `node build.mjs`). Output goes to `dist/`.
8. **Review `dist/`.** Open the pages, check the copy, confirm the form options
   match the services.
9. **Verify:** `cd giventake-kit && npm i -D playwright-core` once, then
   `node serve.cjs` in one terminal and `node verify.cjs` in another. Fill in
   `verify.config.cjs` for the client first. Or run against a deploy with
   `SITE_URL=https://... node verify.cjs`. The build must pass before it ships.
10. **Production flag.** Set `seo.production: true` in `client.config.json`
    ONLY after the client has approved the site. Rebuild. This enables indexing,
    canonical tags, and the sitemap reference.
11. **Deploy.** Copy `worker/wrangler.toml.example` to `wrangler.toml`, fill in
    the client values, set the secrets (`wrangler secret put SUPABASE_URL`,
    `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`), then `wrangler deploy`.
    The worker serves `dist/` and the `/api/lead` endpoint.
12. **Local end-to-end test.** `wrangler dev` serves the site plus the worker so
    the lead form can be tested against the real RPC before launch.
13. **Connect Looker Studio** to the client's GA4 property for the monthly proof
    report. The CRM is the lead count of record.

## Known limits

- **Rate limiting is client-side plus validation.** The worker has no KV store,
  so the throttle lives in the browser (3 submissions per 10 minutes) with
  server-side validation as the backstop. For clients who need hard server-side
  limits, add Workers KV and check it in `worker.js`.
- **No CMS.** Content changes mean editing `pages/` and rebuilding. That is the
  trade for speed and zero maintenance.
- **Calls are not tracked yet.** The monthly report headline covers leads until
  the voice agent number is live.

## File map

- `client.config.json` - the one config file. Everything client-specific.
- `build.mjs` - assembles `partials/` + `pages/` into `dist/`.
- `partials/` - head, header, footer, mobile CTA bar, consent banner.
- `pages/` - home, service (one built per configured service), privacy, terms, 404.
- `assets/` - styles.css, app.js (form, consent, attribution), tracking.js
  (consent-gated GA4/Meta/LinkedIn), favicon.svg.
- `worker/` - `worker.js` lead endpoint, `wrangler.toml.example`.
- `giventake-kit/` - the check suite and colophon template, with a blank
  per-client `verify.config.cjs`.
