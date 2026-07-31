/**
 * Consent-gated tracking loader.
 *
 * Loads analytics/marketing SDKs ONLY after the user opts in for the
 * matching category. Nothing here runs on module import — the entry
 * point is `initTracking()`, called once from the client provider.
 *
 * Providers wired up (all legal, consent-gated, first-party-cookieless-friendly):
 *   - Google Analytics 4     (analytics)   — VITE_GA_MEASUREMENT_ID
 *   - Meta / Facebook Pixel  (marketing)   — VITE_META_PIXEL_ID
 *   - TikTok Pixel           (marketing)   — VITE_TIKTOK_PIXEL_ID
 *   - LinkedIn Insight Tag   (marketing)   — VITE_LINKEDIN_PARTNER_ID
 *
 * If an env var is not set, that provider is silently skipped.
 * All providers honor Google's Consent Mode v2 signal.
 */

import type { ConsentState } from "./consent";

type Loaded = Record<string, boolean>;
const loaded: Loaded = {};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: unknown;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: unknown;
    ttq?: any;
    _linkedin_data_partner_ids?: string[];
    lintrk?: (...args: unknown[]) => void;
  }
}

function injectScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function ensureGtagBootstrap() {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    // Consent Mode v2 defaults — deny until updated.
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    });
    window.gtag("js", new Date());
  }
}

function updateConsentMode(state: ConsentState) {
  ensureGtagBootstrap();
  window.gtag?.("consent", "update", {
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
    analytics_storage: state.analytics ? "granted" : "denied",
    functionality_storage: state.preferences ? "granted" : "denied",
    personalization_storage: state.preferences ? "granted" : "denied",
    security_storage: "granted",
  });
}

function loadGA4() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id || loaded.ga4) return;
  ensureGtagBootstrap();
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${id}`, "ga4-script");
  window.gtag?.("config", id, { anonymize_ip: true });
  loaded.ga4 = true;
}

function loadMetaPixel() {
  const id = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
  if (!id || loaded.meta) return;
  // Standard Meta Pixel bootstrap.
  (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq?.("init", id);
  window.fbq?.("track", "PageView");
  loaded.meta = true;
}

function loadTikTokPixel() {
  const id = import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined;
  if (!id || loaded.tiktok) return;
  (function (w: any, d, t) {
    w.TiktokAnalyticsObject = t;
    const ttq = (w[t] = w[t] || []);
    ttq.methods = [
      "page",
      "track",
      "identify",
      "instances",
      "debug",
      "on",
      "off",
      "once",
      "ready",
      "alias",
      "group",
      "enableCookie",
      "disableCookie",
    ];
    ttq.setAndDefer = function (t: any, e: any) {
      t[e] = function () {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t: any) {
      const e = ttq._i[t] || [];
      for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e: string) {
      const n = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = n;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = {};
      const o = d.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = n + "?sdkid=" + e + "&lib=" + t;
      const a = d.getElementsByTagName("script")[0];
      a.parentNode!.insertBefore(o, a);
    };
    ttq.load(id);
    ttq.page();
  })(window, document, "ttq");
  loaded.tiktok = true;
}

function loadLinkedInInsight() {
  const id = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;
  if (!id || loaded.linkedin) return;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(id);
  injectScript("https://snap.licdn.com/li.lms-analytics/insight.min.js", "linkedin-insight");
  loaded.linkedin = true;
}

function apply(state: ConsentState) {
  updateConsentMode(state);
  if (state.analytics) loadGA4();
  if (state.marketing) {
    loadMetaPixel();
    loadTikTokPixel();
    loadLinkedInInsight();
  }
}

let initialized = false;

export function initTracking(getState: () => ConsentState) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  ensureGtagBootstrap();
  apply(getState());

  window.addEventListener("gt:consent-change", (e) => {
    const detail = (e as CustomEvent<ConsentState>).detail;
    if (detail) apply(detail);
  });
}
