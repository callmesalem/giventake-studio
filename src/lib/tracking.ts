/**
 * Consent-gated tracking loader.
 *
 * Loads analytics/marketing SDKs ONLY after the user opts in for the
 * matching category. Nothing here runs on module import — the entry
 * point is `initTracking()`, called once from the client provider.
 *
 * Providers wired up (all legal, consent-gated, first-party-cookieless-friendly):
 *   - Google Analytics 4     (analytics)   — VITE_GA_MEASUREMENT_ID
 *   - Google Ads             (marketing)   — VITE_GOOGLE_ADS_ID
 *   - Meta / Facebook Pixel  (marketing)   — VITE_META_PIXEL_ID
 *   - TikTok Pixel           (marketing)   — VITE_TIKTOK_PIXEL_ID
 *   - LinkedIn Insight Tag   (marketing)   — VITE_LINKEDIN_PARTNER_ID
 *   - Microsoft Ads UET      (marketing)   — VITE_MICROSOFT_UET_TAG_ID
 *
 * If an env var is not set, that provider is silently skipped.
 * All providers honor Google's Consent Mode v2 signal.
 */

import type { ConsentState } from "./consent-core";
import { isContactBudget, isContactSource, isContactTimeline } from "./contact-options";

type Loaded = Record<string, boolean>;

type LeadEventName =
  "lead_form_submit_success" | "lead_form_mailto_fallback" | "lead_form_submit_error";

type LeadEventProperties = {
  budget?: string;
  timeline?: string;
  source?: string;
};

let currentConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

function sanitizeLeadEventProperties(properties: LeadEventProperties) {
  const safeProperties: LeadEventProperties = {};
  if (isContactBudget(properties.budget)) safeProperties.budget = properties.budget;
  if (isContactTimeline(properties.timeline)) safeProperties.timeline = properties.timeline;
  if (isContactSource(properties.source)) safeProperties.source = properties.source;
  return safeProperties;
}

function googleAdsLeadDestination() {
  const id = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
  const label = import.meta.env.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL as string | undefined;
  if (!id || !/^AW-\d+$/.test(id) || !label || !/^[A-Za-z0-9_-]+$/.test(label)) return;
  return `${id}/${label}`;
}

function linkedInLeadConversionId() {
  const partnerId = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;
  const conversionId = import.meta.env.VITE_LINKEDIN_LEAD_CONVERSION_ID as string | undefined;
  if (!partnerId || !/^\d+$/.test(partnerId) || !conversionId || !/^[1-9]\d*$/.test(conversionId)) {
    return;
  }
  const numericId = Number(conversionId);
  return Number.isSafeInteger(numericId) ? numericId : undefined;
}

const loaded: Loaded = {};

// Vendor pixel bootstrap types are intentionally loose: these objects are
// defined by third-party scripts and only the small surface we call is typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: unknown;
    };
    _fbq?: unknown;
    ttq?: AnyRecord;
    TiktokAnalyticsObject?: string;
    _linkedin_data_partner_ids?: string[];
    lintrk?: (...args: unknown[]) => void;
    uetq?: unknown[] | { push: (...args: unknown[]) => void };
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
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
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

function loadGoogleAds() {
  const id = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
  if (!id || loaded.googleAds) return;
  ensureGtagBootstrap();
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${id}`, "google-ads-script");
  window.gtag?.("config", id, { allow_ad_personalization_signals: true });
  loaded.googleAds = true;
}

function loadMetaPixel() {
  const id = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
  if (!id || loaded.meta) return;

  // Standard Meta Pixel bootstrap (vendor code), rewritten to satisfy project lint rules.
  (function (f: AnyRecord, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: AnyRecord = (f.fbq = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        n.queue.push(args);
      }
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0] as HTMLScriptElement;
    s.parentNode!.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq?.("init", id);
  window.fbq?.("track", "PageView");
  loaded.meta = true;
}

function loadTikTokPixel() {
  const id = import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined;
  if (!id || loaded.tiktok) return;

  // Standard TikTok Pixel bootstrap (vendor code), rewritten to satisfy project lint rules.
  (function (w: AnyRecord, d: Document, t: string) {
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
    ttq.setAndDefer = function (target: AnyRecord, method: string) {
      target[method] = function (...args: unknown[]) {
        target.push([method, ...args]);
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (pixelId: string) {
      const inst = ttq._i[pixelId] || [];
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(inst, ttq.methods[i]);
      return inst;
    };
    ttq.load = function (pixelId: string) {
      const base = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[pixelId] = [];
      ttq._i[pixelId]._u = base;
      ttq._t = ttq._t || {};
      ttq._t[pixelId] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[pixelId] = {};
      const o = d.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = base + "?sdkid=" + pixelId + "&lib=" + t;
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

function loadMicrosoftAds() {
  const id = import.meta.env.VITE_MICROSOFT_UET_TAG_ID as string | undefined;
  if (!id || loaded.microsoftAds) return;

  // Standard Microsoft UET bootstrap, kept behind marketing consent.
  (function (w: AnyRecord, d: Document, t: string, src: string, queueName: string) {
    if (w[queueName]?.push && w.UET) {
      w[queueName].push("pageLoad");
      return;
    }

    w[queueName] = w[queueName] || [];
    const boot = function () {
      const options: AnyRecord = { ti: id, enableAutoSpaTracking: true };
      options.q = w[queueName];
      w[queueName] = new w.UET(options);
      w[queueName].push("pageLoad");
    };

    const script = d.createElement(t) as HTMLScriptElement;
    script.async = true;
    script.src = src;
    script.addEventListener("load", boot, { once: true });
    const first = d.getElementsByTagName(t)[0] as HTMLScriptElement;
    first.parentNode!.insertBefore(script, first);
  })(window, document, "script", "https://bat.bing.com/bat.js", "uetq");

  loaded.microsoftAds = true;
}

function apply(state: ConsentState) {
  currentConsent = state;
  updateConsentMode(state);
  if (state.analytics) loadGA4();
  if (state.marketing) {
    loadGoogleAds();
    loadMetaPixel();
    loadTikTokPixel();
    loadLinkedInInsight();
    loadMicrosoftAds();
  }
}

let initialized = false;

export function trackLeadEvent(name: LeadEventName, properties: LeadEventProperties) {
  if (typeof window === "undefined") return;

  const safeProperties = sanitizeLeadEventProperties(properties);

  if (currentConsent.analytics) {
    window.gtag?.("event", name, safeProperties);
  }

  if (currentConsent.marketing) {
    window.fbq?.("trackCustom", name, safeProperties);
    window.ttq?.track?.(name, safeProperties);
    if (Array.isArray(window.uetq)) {
      window.uetq.push("event", name, safeProperties);
    } else {
      window.uetq?.push?.("event", name, safeProperties);
    }

    if (name === "lead_form_submit_success") {
      const googleAdsDestination = googleAdsLeadDestination();
      if (googleAdsDestination) {
        window.gtag?.("event", "conversion", { send_to: googleAdsDestination });
      }
      const linkedInConversionId = linkedInLeadConversionId();
      if (linkedInConversionId) {
        window.lintrk?.("track", { conversion_id: linkedInConversionId });
      }
    }
  }
}

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
