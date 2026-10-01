#!/usr/bin/env node
// client-template build script. Zero dependencies.
//
// Reads client.config.json + partials/ + pages/ and writes finished HTML to
// dist/. Run:  node build.mjs   (or: npm run build)

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

const config = JSON.parse(readFileSync(join(ROOT, 'client.config.json'), 'utf8'));

function read(p) {
  return readFileSync(join(ROOT, p), 'utf8');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const partials = {};
for (const f of readdirSync(join(ROOT, 'partials'))) {
  if (f.endsWith('.html')) partials[f.replace('.html', '')] = read('partials/' + f);
}
// map include names used in pages
partials.mobileCta = partials['mobile-cta'];
partials.consentBanner = partials['consent-banner'];

const production = config.seo && config.seo.production === true;

const robotsMeta = production
  ? ''
  : '<meta name="robots" content="noindex,nofollow">';

const canonicalBase = (config.siteUrl || '').replace(/\/$/, '');
function canonicalFor(path) {
  if (!production || !canonicalBase) return '';
  return `<link rel="canonical" href="${esc(canonicalBase + path)}">`;
}

// Inert config JSON: IDs live here but fire no requests until tracking.js
// runs after consent. Never put contact data in this block.
// The < escape keeps the JSON safe inside the script tag.
const configJson = JSON.stringify({
  businessName: config.businessName,
  tracking: {
    ga4Id: (config.tracking && config.tracking.ga4Id) || '',
    metaPixelId: (config.tracking && config.tracking.metaPixelId) || '',
    linkedinPartnerId: (config.tracking && config.tracking.linkedinPartnerId) || ''
  }
}).replace(/</g, '\\u003c');

function jsonLdHome() {
  const schemaType = config.schemaType || 'LocalBusiness';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: config.businessName,
    url: canonicalBase || undefined,
    telephone: config.phone || undefined,
    email: config.email || undefined,
    address: config.address || undefined
  });
}

function jsonLdService(service) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.blurb,
    provider: {
      '@type': config.schemaType || 'LocalBusiness',
      name: config.businessName,
      url: canonicalBase || undefined,
      telephone: config.phone || undefined
    }
  });
}

function serviceCards() {
  return (config.services || []).map(s => `
        <div class="service-card">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.blurb)}</p>
          <a href="/services/${esc(s.slug)}.html">Learn more</a>
        </div>`).join('\n');
}

function serviceOptions() {
  return (config.services || []).map(s =>
    `            <option value="${esc(s.slug)}">${esc(s.name)}</option>`).join('\n');
}

function render(template, tokens) {
  let out = template;
  // includes: {{> name}}
  out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (m, name) => {
    const key = name === 'mobile-cta' ? 'mobileCta' : name === 'consent-banner' ? 'consentBanner' : name;
    return partials[key] || '';
  });
  // tokens: {{token}}
  out = out.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, name) =>
    tokens[name] !== undefined ? tokens[name] : m);
  return out;
}

const baseTokens = {
  businessName: esc(config.businessName),
  tagline: esc(config.tagline),
  phone: esc(config.phone),
  phoneHref: esc(config.phoneHref),
  email: esc(config.email),
  address: esc(config.address),
  year: String(new Date().getFullYear()),
  robotsMeta,
  configJson,
  consentBannerText: esc(config.consent?.bannerText || ''),
  consentCheckboxText: esc(config.consent?.checkboxText || '')
};

function writePage(relPath, pageFile, extra) {
  const tpl = read('pages/' + pageFile);
  const tokens = Object.assign({}, baseTokens, extra);
  const html = render(tpl, tokens);
  const outPath = join(DIST, relPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log('wrote', relPath);
}

// home
writePage('index.html', 'home.html', {
  pageTitle: esc(config.businessName) + ' | ' + esc(config.tagline),
  pageDescription: esc(config.tagline),
  canonical: canonicalFor('/'),
  jsonLd: jsonLdHome(),
  serviceCards: serviceCards(),
  serviceOptions: serviceOptions()
});

// one service page per configured service
for (const s of config.services || []) {
  writePage(`services/${s.slug}.html`, 'service.html', {
    pageTitle: esc(s.name) + ' | ' + esc(config.businessName),
    pageDescription: esc(s.blurb),
    canonical: canonicalFor(`/services/${s.slug}.html`),
    jsonLd: jsonLdService(s),
    serviceName: esc(s.name),
    serviceBlurb: esc(s.blurb)
  });
}

// privacy, terms, 404
writePage('privacy.html', 'privacy.html', {
  pageTitle: 'Privacy Policy | ' + esc(config.businessName),
  pageDescription: 'Privacy policy for ' + config.businessName + '.',
  canonical: canonicalFor('/privacy.html'),
  jsonLd: jsonLdHome()
});
writePage('terms.html', 'terms.html', {
  pageTitle: 'Terms of Service | ' + esc(config.businessName),
  pageDescription: 'Terms of service for ' + config.businessName + '.',
  canonical: canonicalFor('/terms.html'),
  jsonLd: jsonLdHome()
});
writePage('404.html', '404.html', {
  pageTitle: 'Page not found | ' + esc(config.businessName),
  pageDescription: 'That page does not exist.',
  canonical: '',
  jsonLd: jsonLdHome()
});

// built.html colophon from the kit template
(function buildColophon() {
  let tpl = read('giventake-kit/built.template.html');
  tpl = tpl.replace('<title>How This Site Was Built</title>',
    `<title>How This Site Was Built | ${esc(config.businessName)}</title>`);
  tpl = tpl.replace('href="styles.css"', 'href="/assets/styles.css"');
  tpl = tpl.replace('<h1>How This Site<br>Was Built</h1>',
    `<h1>How This Site<br>Was Built</h1>\n  <p class="lede">Built for ${esc(config.businessName)} by GivenTake Devs.</p>`);
  if (!production) {
    tpl = tpl.replace('<meta name="robots" content="index, follow">',
      '<meta name="robots" content="noindex,nofollow">');
  }
  writeFileSync(join(DIST, 'built.html'), tpl);
  console.log('wrote built.html');
})();

// robots.txt
writeFileSync(join(DIST, 'robots.txt'),
  production && canonicalBase
    ? `User-agent: *\nAllow: /\n\nSitemap: ${canonicalBase}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`);
console.log('wrote robots.txt');

// assets
mkdirSync(join(DIST, 'assets'), { recursive: true });
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
console.log('copied assets/');

console.log(`done. production=${production}`);
