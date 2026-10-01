# GivenTake build standard

A portable check suite and a colophon template. Copy this folder into any
site, change one config file, and that site is held to the same standard
as every other build.

The point is not the checks. The point is that the claims become
**falsifiable**. Anyone can put "fast, accessible, privacy-first" on a
services page. Very few can hand you a page that measures itself in your
browser and a suite that fails the build when it stops being true.

---

## Install

```bash
npm i -D playwright-core
cp -r giventake-kit /path/to/new-site/
```

Then edit `verify.config.cjs`. It is the only file you change per project.

```bash
node giventake-kit/serve.cjs     # local static server on :8899
node giventake-kit/verify.cjs    # run the suite
```

Point it at a deployment instead of localhost:

```bash
SITE_URL=https://example.com node giventake-kit/verify.cjs
```

Exit code is 0 when everything passes, 1 when anything fails, so it drops
straight into CI or a pre-push hook.

---

## What it checks

Nine universal checks, plus whatever you add under `custom`.

| Check | What would otherwise slip through |
|---|---|
| Renders without JavaScript | Content that only appears after a script runs. A blank page for anyone whose JS fails, and a thin one for some crawlers. |
| Contrast clears WCAG AA | Runs **axe-core**, the engine browser devtools use. Reports what it cannot judge rather than guessing. |
| Accessibility basics | Missing lang, no or multiple H1s, skipped heading levels, images with no alt or no dimensions, clickable divs, `_blank` without `noopener`, untitled iframes, unlabelled controls and form fields, tap targets under 44px. |
| Reduced motion respected | Looping animation still running, and worse, elements left invisible waiting for an animation that will never fire. |
| No tracking before consent | Cookies set and third-party hosts contacted on load, against an explicit allowlist. |
| No horizontal overflow | At every width in the config. Reports the element causing it. |
| Transfer budget | Above-the-fold weight, with the three heaviest resources named when it fails. |
| Asset weights | Oversized video, and a favicon that is secretly a photograph. |
| Meta and structured data | Missing or overlong description, missing canonical, **relative `og:image`** (blank link previews), invalid JSON-LD, required schema types and fields. |

### Why contrast uses axe-core

This check was hand-written first. It produced **four** separate classes of
false positive before being replaced, each one only visible after checking a
finding against the real computed styles:

1. **oklab colours parsed as RGB.** Tailwind v4 emits oklab by default.
   `oklab(0.9755 -0.0007 0.0025 / 0.6)` read as RGB is near-black, which turned
   a white page grey and invented eight failures on giventakedevs.com.
2. **Alpha backgrounds treated as opaque.** A tint like
   `rgba(95,212,143,0.16)` over a dark page is almost the dark page, but read
   as opaque it scores 1.00:1 against text of the same hue.
3. **Gradients invisible to `backgroundColor`.** Navy text on a 96%-white
   gradient was reported as navy-on-navy, because the walk skipped the
   gradient and landed on a dark ancestor.
4. **Findings keyed by class name.** Every `<a class="inline-flex">` on a page
   merged into one finding, so a reported failure could not be traced to an
   element. A visible white-on-navy phone number was reported at 1.07:1.

None of those were hard bugs. The point is that contrast is a solved problem
with a maintained implementation, and re-deriving it by hand produced a tool
confident enough to accuse a client's site of failures it did not have.

**One thing axe cannot do for you:** it folds opacity into its maths, so
auditing a page mid-animation reports perfectly legible text as
near-transparent. The suite waits for scroll-reveal transitions to settle
first. Without that wait it reported six violations on Ohio City Subs for copy
that measures 5.9:1 once the reveal finishes.

---

## The colophon

`built.template.html` drops in as `/built.html`. Five CSS variables to
match the host site, two paragraphs to edit, done.

It reads the Performance API on load and prints that page's real transfer
weight, request count, load time, cookies and third-party hosts. Nothing is
hardcoded, which is the whole point: open devtools and check it, reload and
watch it change.

Pair it with a `humans.txt` and a quiet footer credit. The colophon is where
the claim lives; the footer is just a way to find it.

---

## Config

```js
module.exports = {
  name: 'Client Name',
  url: 'http://127.0.0.1:8899/index.html',
  root: '..',                    // directory serve.cjs should serve
  index: 'index.html',

  budgets: { transferKB: 500, maxMediaMB: 5, maxFaviconKB: 50 },

  privacy: {
    maxCookiesBeforeConsent: 0,
    allowedThirdParties: [],     // empty means fully self-contained
  },

  widths: [375, 390, 768, 1024, 1440],

  schema: {
    required: true,
    expectTypes: ['Restaurant'], // LocalBusiness, Organization, SoftwareApplication...
    expectFields: ['url', 'address', 'telephone'],
  },

  custom: [                      // anything true of this site but not sites in general
    { name: 'no placeholder links', async run(page) { /* return string or null */ } },
  ],
};
```

Set `budgets.transferKB` from a real measurement of the finished site. Then
it only ever catches regressions, which is the useful job.

**Infrastructure cookies need allowlisting.** Vercel sets `__dpl` and
Cloudflare sets `__cf_bm`; neither tracks anyone across sites, but both
count. Add them to `allowedThirdParties` or raise
`maxCookiesBeforeConsent`, and write down why.

---

## Run it on your own sites first

Pointed at four GivenTake builds on 16 Aug 2026, each with its own config:

| | Result | What it caught |
|---|---|---|
| Ohio City Subs | 10/11 | One deliberate placeholder link |
| giventakedevs.com | 8/10 | 61 text-bearing elements invisible without JavaScript; 8 form fields with no label |
| nidalisten.org | 5/9 | 64 characters of text without JavaScript; consent buttons under 44px |
| alwaysthankfulclaims.com | 3/9 | Every page shipped with `localhost:4173` module preloads, and a Meta pixel reporting `domain=localhost` |

That last one is the reason to run this on your own work first. Eight blocked
preloads per page and a pixel corrupting ad attribution had been live for a
while, because neither breaks anything you can see. They only exist in a
console nobody had open.

## Verify before you report

Four of the first findings on these sites were the tool being wrong, not the
site. We also nearly told a client their lead form was broken on the strength
of a failed module preload; the form was fine, and testing it properly took
two minutes.

A check that cries wolf gets ignored, which is worse than having no check.
When a finding is surprising, confirm it against the real computed values
before acting on it.
