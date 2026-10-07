// BLANK example config for the giventake-kit check suite.
//
// Copy this folder into a client site, fill in the values below for THAT
// client, and run:  node serve.cjs  (in one terminal)
//                   node verify.cjs (in another)
// Or point at a deployment:  SITE_URL=https://example.com node verify.cjs
//
// Every value below is empty or EXAMPLE. Nothing here belongs to a real business.

module.exports = {
  // ── identity ──────────────────────────────────────────────────────
  // EXAMPLE: the client's business name, e.g. 'Example Plumbing LLC'
  name: '',

  // Local page to test. Override at run time with SITE_URL to point at a
  // deployment instead:  SITE_URL=https://example.com node verify.cjs
  url: 'http://127.0.0.1:8899/',

  // Directory served by serve.cjs, relative to this config file.
  // For client-template builds this is the build output directory.
  root: '../dist',

  // Entry file, used when a request hits "/"
  index: 'index.html',

  // ── budgets ───────────────────────────────────────────────────────
  budgets: {
    // Above-the-fold transfer in KB. Measure the finished page, set the
    // number, and it only ever catches regressions. EXAMPLE value below.
    transferKB: 300,

    // Any single media file larger than this is almost always a mistake.
    maxMediaMB: 5,

    // Favicons get served at 32px. A photograph is never the right answer.
    maxFaviconKB: 50,
  },

  // ── what "no tracking" means here ─────────────────────────────────
  privacy: {
    // Cookies allowed before a visitor has agreed to anything.
    maxCookiesBeforeConsent: 0,

    // Hosts the page is permitted to contact. Everything else is a finding.
    // Leave empty to require a fully self-contained page.
    // EXAMPLE: only add hosts the client actually needs, e.g. a map embed.
    allowedThirdParties: [],
  },

  // ── responsive ────────────────────────────────────────────────────
  widths: [375, 390, 768, 1024, 1440],

  // ── structured data ───────────────────────────────────────────────
  schema: {
    required: true,
    // Every one of these @types must appear across the page's JSON-LD.
    // EXAMPLE: use the client's real schema.org type, e.g. ['Plumber'],
    // ['GeneralContractor'], ['Dentist']. See client.config.json schemaType.
    expectTypes: ['LocalBusiness'],
    // Fields that must be present on the first block of each expected type.
    expectFields: ['url', 'telephone'],
  },

  // ── project-specific assertions ───────────────────────────────────
  // Anything true of THIS site but not of sites in general. Each gets the
  // page and returns an error string, or null when it passes.
  custom: [
    {
      name: 'no unresolved placeholder links',
      async run(page) {
        const bad = await page.$$eval('a[href]', els =>
          els.map(a => a.getAttribute('href'))
             .filter(h => /PENDING|TODO|REPLACE_ME|EXAMPLE/i.test(h)));
        return bad.length ? `${bad.length} placeholder link(s): ${[...new Set(bad)].join(', ')}` : null;
      },
    },
    {
      name: 'no lorem ipsum',
      async run(page) {
        const hit = await page.evaluate(() => /lorem ipsum|dolor sit amet/i.test(document.body.innerText));
        return hit ? 'placeholder copy is still on the page' : null;
      },
    },
  ],
};
