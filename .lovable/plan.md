# Plan: Complete homepage SEO metadata

## Goal
Add homepage-specific title, description, Open Graph, and Twitter card metadata aligned with the "Your On-Demand Development Team" tagline, while removing root-level overrides that currently leak onto every route.

## Current issues
- `__root.tsx` currently sets page-specific meta (title, description, og:title, og:description, og:image, twitter:title, twitter:description, twitter:image, author, twitter:site). This violates TanStack Router best practice and can override child-route share previews.
- `index.tsx` has only partial tags: title, description, og:title/og:description, og:type, og:url, twitter:card, canonical. It's missing og:site_name, og:image, twitter:title, twitter:description, twitter:image.
- The existing `og:image` is a generic Lovable-generated URL.

## Proposed changes

1. Clean up `__root.tsx`
   - Keep only sitewide defaults: `charSet`, `viewport`, `google-site-verification`, favicon, preload links, and the Organization/WebSite JSON-LD.
   - Remove: `title`, `description`, `author`, `og:title`, `og:description`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site`.

2. Generate a branded Open Graph image
   - 1200×630 PNG
   - Visual style: clean, minimal, dotted grid, indigo accent, craft/exchange theme, "GivenTake Goods Devs" lockup and tagline
   - Upload via `lovable-assets` to get a stable CDN URL

3. Expand `src/routes/index.tsx` head()
   - Title: "GivenTake Goods Devs | Your On-Demand Development Team"
   - Description: "AI-native development studio for small businesses, founders, and growing teams. Websites, apps, agentic workflows, and internal tools — built with human review."
   - OG: `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:image`
   - Twitter: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
   - Omit `twitter:site` per the user.
   - Keep existing canonical link and FAQ JSON-LD.

4. Verify
   - Build passes.
   - No duplicate meta tags emitted.
   - Suggest SEO rescan after deployment.

## Decisions already made
- Generate a new branded OG image (not keep the existing URL).
- No Twitter/X handle exists, so `twitter:site` will be omitted.