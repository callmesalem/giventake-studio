#!/usr/bin/env node
//
// GivenTake build standard.
//
// Files use .cjs so the kit drops into a host package regardless of whether
// that package sets "type": "module". A .js file in an ESM package is
// treated as ESM and every require() in here fails on load.
//
//   node giventake-kit/verify.cjs
//   SITE_URL=https://example.com node giventake-kit/verify.cjs
//
// Every check runs against a real page in a real browser, not a DOM snapshot
// or a static parse. A build that fails does not ship.
//
// The checks below are universal: nothing in this file knows anything about
// a particular site. Project-specific assertions live in verify.config.cjs
// under `custom`.

const path = require('path');
const fs = require('fs');

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('playwright-core is not installed.  npm i -D playwright-core');
  process.exit(2);
}

const cfg = require(path.join(process.cwd(), process.env.VERIFY_CONFIG || 'giventake-kit/verify.config.cjs'));
const SITE = process.env.SITE_URL || cfg.url;
const ROOT = path.resolve(path.dirname(require.resolve(path.join(process.cwd(), process.env.VERIFY_CONFIG || 'giventake-kit/verify.config.cjs'))), cfg.root || '..');

// Chromium: use an explicit path, or whatever Playwright already downloaded.
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.LOCALAPPDATA || process.env.HOME || '', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    for (const rel of ['chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const CHECKS = [];
const check = (name, fn) => CHECKS.push({ name, fn });
const VIEW = { width: 1440, height: 900 };

// ── contrast maths, shared ──────────────────────────────────────────
const CONTRAST_FN = `
  function __lum(rgb) {
    const [r,g,b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  }
  // Let the browser resolve the colour rather than parsing the string.
  //
  // Scraping the first three numbers out of a colour works for rgb() and
  // breaks silently on everything else. Tailwind v4 emits oklab by default,
  // and "oklab(0.9755 -0.0007 0.0025 / 0.6)" read as RGB gives near-black,
  // which turns a white background into a mid-grey and invents contrast
  // failures that are not there. Painting one pixel handles every colour
  // space the browser supports, including alpha, and always will.
  const __cvs = document.createElement('canvas');
  __cvs.width = __cvs.height = 1;
  const __ctx = __cvs.getContext('2d', { willReadFrequently: true });
  const __cache = new Map();
  function __rgba(c) {
    if (__cache.has(c)) return __cache.get(c);
    let out;
    try {
      __ctx.clearRect(0, 0, 1, 1);
      __ctx.fillStyle = '#000';
      __ctx.fillStyle = c;
      __ctx.fillRect(0, 0, 1, 1);
      const d = __ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], d[3] / 255];
    } catch (e) {
      out = [0, 0, 0, 1];
    }
    __cache.set(c, out);
    return out;
  }
  function __parse(c) { return __rgba(c).slice(0, 3); }
  function __alpha(c) {
    // transparent keywords and 0-alpha both come back with a === 0
    if (!c || c === 'transparent' || c === 'none') return 0;
    return __rgba(c)[3];
  }
  function __ratio(fg, bg) {
    const a = __lum(fg), b = __lum(bg);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  }
  // Walk up compositing every semi-transparent layer over the one behind it.
  // Stopping at the first non-transparent background is wrong: a tint like
  // rgba(95,212,143,0.16) sitting over a dark page is nearly the dark page,
  // but read as opaque it scores 1.00:1 against text of the same hue.
  // Returns null when the backdrop cannot be determined with confidence.
  //
  // A gradient or background image contributes nothing to backgroundColor,
  // which computes as transparent. Walking past it lands on some ancestor
  // that may look nothing like what is actually behind the text. That is how
  // navy text on a 96%-white gradient got reported as navy-on-navy at 1.00:1.
  // Refusing to answer is right here: a confident wrong accusation is worse
  // than a gap, because it teaches people to ignore the tool.
  function __effectiveBg(el) {
    const layers = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = cs.backgroundColor;
      const a = __alpha(c);
      if (a > 0) { layers.push({ rgb: __parse(c), a }); if (a >= 0.999) break; }
      n = n.parentElement;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    if (rootStyle.backgroundImage && rootStyle.backgroundImage !== 'none') return null;
    let base = __alpha(rootStyle.backgroundColor) > 0 ? __parse(rootStyle.backgroundColor) : [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const { rgb, a } = layers[i];
      base = [0, 1, 2].map(k => rgb[k] * a + base[k] * (1 - a));
    }
    return base;
  }
`;

// ══════════════════════════════════════════════════════════════════════
// 1. The page works without JavaScript
// ══════════════════════════════════════════════════════════════════════
check('renders without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(900);

  const r = await p.evaluate(() => {
    // Anything sizeable that is invisible with scripting off is content the
    // visitor has silently lost.
    const hidden = [...document.querySelectorAll('body *')].filter(el => {
      if (el.closest('[hidden]') || el.hasAttribute('hidden')) return false;  // deliberate
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;     // deliberate
      const rect = el.getBoundingClientRect();
      if (parseFloat(s.opacity) >= 0.25 || rect.height <= 40 || rect.width <= 40) return false;
      // A decorative glow at low opacity is a design choice. Only text a
      // visitor can no longer read counts as content lost.
      return (el.innerText || '').trim().length > 10;
    });
    return {
      invisible: hidden.length,
      sample: hidden.slice(0, 4).map(e => e.className || e.tagName),
      textLength: document.body.innerText.trim().length,
    };
  });
  await ctx.close();

  if (r.textLength < 200) throw new Error(`only ${r.textLength} chars of text render without JS`);
  if (r.invisible) throw new Error(`${r.invisible} sizeable element(s) invisible without JS: ${r.sample.join(', ')}`);
});

// ══════════════════════════════════════════════════════════════════════
// 2. Contrast, via axe-core
//
// This was a hand-written check. It produced four separate classes of false
// positive before being replaced: oklab colours parsed as RGB, alpha
// backgrounds treated as opaque, gradients invisible to backgroundColor, and
// findings keyed by class name so different elements merged into one. Each
// fix revealed the next.
//
// The lesson is not that those were hard bugs. It is that contrast is a
// solved problem with a maintained implementation, and re-deriving it by hand
// produced a tool confident enough to accuse a client's site of failures it
// did not have. axe-core is what browser devtools and commercial auditors
// run. Playwright injects it directly, so a strict CSP does not block it.
// ══════════════════════════════════════════════════════════════════════
const AXE_PATH = (() => {
  try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; }
})();

check('all visible text clears WCAG AA', async ({ browser }) => {
  if (!AXE_PATH) throw new Error('axe-core is not installed.  npm i -D axe-core');

  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });

  // Scroll-reveal animations start elements at opacity 0, and axe folds
  // opacity into its contrast maths. Auditing mid-transition reports perfectly
  // legible text as near-transparent: on this site it produced six violations
  // for copy that measures 5.9:1 once the reveal finishes. Wait for the page
  // to stop moving before judging it.
  await p.waitForTimeout(4000);
  await p.waitForFunction(() => {
    return ![...document.querySelectorAll('body *')].some(el => {
      const o = parseFloat(getComputedStyle(el).opacity);
      return o > 0.02 && o < 0.98;
    });
  }, { timeout: 8000 }).catch(() => { /* some pages never fully settle; audit anyway */ });

  await p.addScriptTag({ path: AXE_PATH });
  const res = await p.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
      resultTypes: ['violations', 'incomplete'],
    });
    const fmt = (n) => n.nodes.slice(0, 6).map((node) => {
      const detail = (node.any[0] && node.any[0].data) || {};
      const text = (node.html.replace(/<[^>]*>/g, '').trim() || node.target[0]).slice(0, 30);
      return detail.contrastRatio
        ? `"${text}" ${detail.contrastRatio}:1 needs ${detail.expectedContrastRatio || '?'}`
        : `"${text}" (${node.target[0]})`;
    });
    return {
      violations: r.violations.flatMap(fmt),
      // axe reports "incomplete" where it cannot see the backdrop, e.g. text
      // over an image or gradient. Surfaced, never asserted on.
      incomplete: r.incomplete.reduce((a, n) => a + n.nodes.length, 0),
    };
  });
  await ctx.close();

  if (res.incomplete) {
    console.log(`        (${res.incomplete} element(s) axe could not judge, usually text over an image or gradient)`);
  }
  if (res.violations.length) {
    throw new Error(`${res.violations.length} contrast violation(s): ${res.violations.join('; ')}`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3. Accessibility basics
// ══════════════════════════════════════════════════════════════════════
check('accessibility basics', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(1100);

  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
    let skipped = 0;
    for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) skipped++;

    return {
      lang: document.documentElement.lang,
      viewport: !!document.querySelector('meta[name="viewport"]'),
      title: (document.title || '').length,
      h1: document.querySelectorAll('h1').length,
      skippedLevels: skipped,
      imgsNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length,
      imgsNoDims: imgs.filter(i => !i.getAttribute('width') && !getComputedStyle(i).aspectRatio.includes('/')).length,
      clickableDivs: [...document.querySelectorAll('div[onclick],span[onclick]')].length,
      noOpener: [...document.querySelectorAll('a[target="_blank"]')].filter(a => !(a.rel || '').includes('noopener')).length,
      iframeNoTitle: [...document.querySelectorAll('iframe')].filter(f => !f.title).length,
      unlabelledControls: [...document.querySelectorAll('button,[role="button"]')]
        .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
      inputsNoLabel: [...document.querySelectorAll('input:not([type=hidden]),textarea,select')]
        .filter(i => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length,
      // WCAG 2.5.8 exempts a link sitting inside a sentence of text.
      smallTargets: [...document.querySelectorAll('a,button')].filter(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return false;
        const inSentence = [...(el.parentElement?.childNodes || [])]
          .some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (inSentence) return false;
        return b.height < 44 || b.width < 44;
      }).map(el => el.textContent.trim().slice(0, 18) || el.className),
    };
  });
  await ctx.close();

  const e = [];
  if (!r.lang) e.push('<html> has no lang');
  if (!r.viewport) e.push('no viewport meta');
  if (!r.title) e.push('no <title>');
  if (r.h1 !== 1) e.push(`${r.h1} h1 elements, expected exactly 1`);
  if (r.skippedLevels) e.push(`${r.skippedLevels} skipped heading level(s)`);
  if (r.imgsNoAlt) e.push(`${r.imgsNoAlt} img without alt`);
  if (r.imgsNoDims) e.push(`${r.imgsNoDims} img without width/height or aspect-ratio`);
  if (r.clickableDivs) e.push(`${r.clickableDivs} clickable div/span`);
  if (r.noOpener) e.push(`${r.noOpener} _blank link(s) without rel=noopener`);
  if (r.iframeNoTitle) e.push(`${r.iframeNoTitle} iframe(s) without title`);
  if (r.unlabelledControls) e.push(`${r.unlabelledControls} control(s) with no accessible name`);
  if (r.inputsNoLabel) e.push(`${r.inputsNoLabel} form field(s) with no label`);
  if (r.smallTargets.length) e.push(`${r.smallTargets.length} tap target(s) under 44px: ${r.smallTargets.slice(0, 4).join(', ')}`);
  if (e.length) throw new Error(e.join(' | '));
});

// ══════════════════════════════════════════════════════════════════════
// 4. Reduced motion is genuinely respected
// ══════════════════════════════════════════════════════════════════════
check('prefers-reduced-motion respected', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(1400);

  const r = await p.evaluate(() => {
    const running = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      const dur = parseFloat(s.animationDuration) || 0;
      return s.animationName !== 'none' && dur > 0.05 && s.animationIterationCount !== '1';
    });
    // The real failure: something hidden waiting for an animation that will
    // never run, leaving the visitor with a blank space.
    const stranded = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (parseFloat(s.opacity) >= 0.25 || b.height <= 40 || b.width <= 40) return false;
      if (s.display === 'none' || s.visibility === 'hidden' || el.hasAttribute('hidden')) return false;
      return (el.innerText || '').trim().length > 10;   // text only, not decoration
    });
    return {
      looping: running.length,
      loopSample: running.slice(0, 3).map(e => e.className || e.tagName),
      stranded: stranded.length,
      strandedSample: stranded.slice(0, 3).map(e => e.className || e.tagName),
    };
  });
  await ctx.close();

  const e = [];
  if (r.stranded) e.push(`${r.stranded} element(s) left invisible: ${r.strandedSample.join(', ')}`);
  if (r.looping) e.push(`${r.looping} looping animation(s) still running: ${r.loopSample.join(', ')}`);
  if (e.length) throw new Error(e.join(' | '));
});

// ══════════════════════════════════════════════════════════════════════
// 5. Nothing tracked before consent
// ══════════════════════════════════════════════════════════════════════
check('no tracking before consent', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  const hosts = new Set();
  p.on('request', r => { try { hosts.add(new URL(r.url()).host); } catch (err) {} });

  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
    }
  });
  await p.waitForTimeout(2500);

  const cookies = await ctx.cookies();
  const here = new URL(SITE).host;
  const allowed = cfg.privacy?.allowedThirdParties || [];
  const strangers = [...hosts].filter(h => h !== here && !allowed.includes(h));
  await ctx.close();

  const max = cfg.privacy?.maxCookiesBeforeConsent ?? 0;
  const e = [];
  if (cookies.length > max) e.push(`${cookies.length} cookie(s) before consent (max ${max}): ${cookies.map(c => c.name).slice(0, 5).join(', ')}`);
  if (strangers.length) e.push(`${strangers.length} unapproved third-party host(s): ${strangers.slice(0, 5).join(', ')}`);
  if (e.length) throw new Error(e.join(' | '));
});

// ══════════════════════════════════════════════════════════════════════
// 6. Responsive at every width
// ══════════════════════════════════════════════════════════════════════
check('no horizontal overflow at any width', async ({ browser }) => {
  const bad = [];
  for (const w of (cfg.widths || [375, 768, 1440])) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(SITE, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const over = await p.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
      culprit: (() => {
        const vw = document.documentElement.clientWidth;
        const el = [...document.querySelectorAll('body *')].find(e => {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || getComputedStyle(e).position === 'fixed') return false;
          let n = e.parentElement, clipped = false;
          while (n && n !== document.body) {
            if (/hidden|clip|auto|scroll/.test(getComputedStyle(n).overflowX)) { clipped = true; break; }
            n = n.parentElement;
          }
          return !clipped && r.right > vw + 1;
        });
        return el ? (el.className || el.tagName) : '';
      })(),
    }));
    if (over.s > over.c) bad.push(`${w}px (${over.s} > ${over.c}${over.culprit ? ', from .' + String(over.culprit).split(' ')[0] : ''})`);
    await ctx.close();
  }
  if (bad.length) throw new Error(`overflow at: ${bad.join('; ')}`);
});

// ══════════════════════════════════════════════════════════════════════
// 7. Weight budget
// ══════════════════════════════════════════════════════════════════════
check('within transfer budget', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      kb: Math.round((res.reduce((a, x) => a + (x.transferSize || 0), 0) + (nav?.transferSize || 0)) / 1024),
      reqs: res.length,
      heaviest: res.map(x => ({ n: x.name.split('/').pop().slice(0, 30), kb: Math.round((x.transferSize || 0) / 1024) }))
        .sort((a, b) => b.kb - a.kb).slice(0, 3),
    };
  });
  await ctx.close();

  const budget = cfg.budgets?.transferKB;
  console.log(`        (${r.kb} KB across ${r.reqs} requests${budget ? `, budget ${budget} KB` : ''})`);
  if (budget && r.kb > budget) {
    throw new Error(`${r.kb} KB over the ${budget} KB budget. Heaviest: ${r.heaviest.map(h => `${h.n} ${h.kb}KB`).join(', ')}`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 8. Asset weights on disk
// ══════════════════════════════════════════════════════════════════════
check('asset weights', async () => {
  const maxMedia = (cfg.budgets?.maxMediaMB ?? 5) * 1024 * 1024;
  const maxIcon = (cfg.budgets?.maxFaviconKB ?? 50) * 1024;
  const errs = [];

  const walk = dir => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(full);
      return [full];
    });
  };

  for (const f of walk(path.join(ROOT, 'assets'))) {
    const size = fs.statSync(f).size;
    if (/\.(mp4|webm|mov)$/i.test(f) && size > maxMedia) {
      errs.push(`${path.basename(f)} is ${(size / 1048576).toFixed(1)}MB`);
    }
  }

  // whatever the page actually points at as its icon
  const entry = path.join(ROOT, cfg.index || 'index.html');
  if (fs.existsSync(entry)) {
    const html = fs.readFileSync(entry, 'utf8');
    const m = html.match(/<link[^>]+rel="icon"[^>]*href="([^"]+)"/);
    if (m) {
      const icon = path.join(ROOT, m[1]);
      if (fs.existsSync(icon) && fs.statSync(icon).size > maxIcon) {
        errs.push(`favicon ${m[1]} is ${(fs.statSync(icon).size / 1024).toFixed(0)}KB`);
      }
    }
  }
  if (errs.length) throw new Error(errs.join(' | '));
});

// ══════════════════════════════════════════════════════════════════════
// 9. Meta and structured data
// ══════════════════════════════════════════════════════════════════════
check('meta and structured data', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEW });
  const p = await ctx.newPage();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.waitForTimeout(900);

  const r = await p.evaluate(() => {
    const meta = n => document.querySelector(`meta[${n.startsWith('og:') || n.startsWith('twitter:') ? 'property' : 'name'}="${n}"]`)?.content
      || document.querySelector(`meta[name="${n}"]`)?.content
      || document.querySelector(`meta[property="${n}"]`)?.content || '';
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
      try { return JSON.parse(s.textContent); } catch (e) { return { __invalid: e.message }; }
    });
    return {
      description: meta('description'),
      ogImage: meta('og:image'),
      ogUrl: meta('og:url'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      blocks,
    };
  });
  await ctx.close();

  const e = [];
  if (!r.description) e.push('no meta description');
  else if (r.description.length > 165) e.push(`meta description is ${r.description.length} chars, will be truncated`);
  if (!r.canonical) e.push('no canonical');
  if (r.ogImage && !/^https?:\/\//.test(r.ogImage)) e.push(`og:image is relative ("${r.ogImage}"), link previews will be blank`);
  if (!r.ogImage) e.push('no og:image, shares will have no picture');
  if (!r.ogUrl) e.push('no og:url');

  const invalid = r.blocks.filter(b => b.__invalid);
  if (invalid.length) e.push(`invalid JSON-LD: ${invalid[0].__invalid}`);

  if (cfg.schema?.required) {
    const types = r.blocks.flatMap(b => {
      const list = b['@graph'] || [b];
      return list.map(x => x['@type']).flat();
    }).filter(Boolean);
    if (!types.length) e.push('no structured data');
    for (const want of (cfg.schema.expectTypes || [])) {
      if (!types.includes(want)) e.push(`no ${want} schema (found: ${types.join(', ') || 'none'})`);
    }
    for (const want of (cfg.schema.expectFields || [])) {
      const primary = r.blocks.find(b => (cfg.schema.expectTypes || []).includes(b['@type']));
      if (primary && !primary[want]) e.push(`schema missing "${want}"`);
    }
  }
  if (e.length) throw new Error(e.join(' | '));
});

// ══════════════════════════════════════════════════════════════════════
// 10. Project-specific checks from the config
// ══════════════════════════════════════════════════════════════════════
for (const c of (cfg.custom || [])) {
  check(c.name, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: VIEW });
    const p = await ctx.newPage();
    await p.goto(SITE, { waitUntil: 'load' });
    await p.waitForTimeout(1000);
    let msg = null;
    try { msg = await c.run(p); } finally { await ctx.close(); }
    if (msg) throw new Error(msg);
  });
}

// ══════════════════════════════════════════════════════════════════════
(async () => {
  const exe = findChrome();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  console.log(`\n  ${cfg.name}\n  ${SITE}\n`);

  let pass = 0;
  const failed = [];
  for (const c of CHECKS) {
    try { await c.fn({ browser }); console.log(`  PASS  ${c.name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${c.name}\n        ${err.message}`); failed.push(c.name); }
  }
  await browser.close();

  console.log(`\n  ${pass}/${CHECKS.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})();
