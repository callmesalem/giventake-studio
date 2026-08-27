Both sitemap and robots.txt already exist in the project:

1. Verify the existing files
   - `src/routes/sitemap[.]xml.ts` serves all public routes: `/`, `/privacy`, `/terms`, `/cookies`, `/do-not-sell`, `/data-request`
   - `public/robots.txt` allows all crawlers and points to `https://dev-on-demand-hub.lovable.app/sitemap.xml`

2. Publish the site
   - Deploy the current build so `/sitemap.xml` and `/robots.txt` are live on the published domain

3. Verify live endpoints
   - Confirm `https://dev-on-demand-hub.lovable.app/sitemap.xml` returns valid XML
   - Confirm `https://dev-on-demand-hub.lovable.app/robots.txt` is accessible

If you want, I can also fix the separate metadata findings (canonical links and social previews) after publishing, since those affect indexing but are not part of the sitemap/robots files themselves.
