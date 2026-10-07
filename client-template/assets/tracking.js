/* Consent-gated tracking loader. Vanilla JS mirror of the studio's own
 * consent-gated loader pattern.
 *
 * NOTHING here loads until the visitor grants the matching category in the
 * consent banner (see app.js). The entry point is initTracking(), called once
 * at boot and again whenever consent changes.
 *
 * Providers (all optional; a blank ID in the config skips that provider):
 *  - Google Analytics 4   (analytics)  - config.tracking.ga4Id
 *  - Meta / Facebook Pixel (marketing) - config.tracking.metaPixelId
 *  - LinkedIn Insight Tag (marketing)  - config.tracking.linkedinPartnerId
 *
 * Google Consent Mode v2 defaults to denied and is updated on consent.
 */

(function () {
  'use strict';

  function readConfig() {
    var el = document.getElementById('client-config');
    if (!el) return {};
    try { return JSON.parse(el.textContent || '{}'); } catch (e) { return {}; }
  }
  var CONFIG = readConfig();
  var TRACKING = CONFIG.tracking || {};

  var loaded = {};

  function injectScript(src, id) {
    if (document.getElementById(id)) return;
    var s = document.createElement('script');
    s.id = id;
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function injectImg(src, id) {
    if (document.getElementById(id)) return;
    var img = document.createElement('img');
    img.id = id;
    img.height = 1; img.width = 1;
    img.style.display = 'none';
    img.alt = '';
    img.src = src;
    document.body.appendChild(img);
  }

  /* ----- Google Consent Mode v2: default denied ----- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  /* ----- GA4 ----- */
  function loadGA4() {
    var id = (TRACKING.ga4Id || '').trim();
    if (!id || loaded.ga4) return;
    loaded.ga4 = true;
    injectScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id), 'gtag-js');
    gtag('js', new Date());
    gtag('config', id, { anonymize_ip: true });
  }

  /* ----- Meta Pixel ----- */
  function loadMeta() {
    var id = (TRACKING.metaPixelId || '').trim();
    if (!id || loaded.meta) return;
    loaded.meta = true;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      t.id = 'fb-pixel';
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  /* ----- LinkedIn Insight Tag ----- */
  function loadLinkedIn() {
    var id = (TRACKING.linkedinPartnerId || '').trim();
    if (!id || loaded.linkedin) return;
    loaded.linkedin = true;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(id);
    (function (l) {
      if (!l) {
        window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
        window.lintrk.q = [];
      }
      var s = document.getElementsByTagName('script')[0];
      var b = document.createElement('script');
      b.type = 'text/javascript'; b.async = true; b.id = 'linkedin-insight';
      b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      s.parentNode.insertBefore(b, s);
    })(window.lintrk);
  }

  /* ----- consent wiring ----- */
  function applyConsent(state) {
    if (!state) return; // no choice yet: load nothing
    gtag('consent', 'update', {
      ad_storage: state.marketing ? 'granted' : 'denied',
      ad_user_data: state.marketing ? 'granted' : 'denied',
      ad_personalization: state.marketing ? 'granted' : 'denied',
      analytics_storage: state.analytics ? 'granted' : 'denied'
    });
    if (state.analytics) loadGA4();
    if (state.marketing) { loadMeta(); loadLinkedIn(); }
  }

  function initTracking() {
    var raw = null;
    try { raw = localStorage.getItem('gt-consent'); } catch (e) {}
    if (raw) {
      try { applyConsent(JSON.parse(raw)); } catch (e) {}
    }
    document.addEventListener('gt:consent', function (ev) {
      applyConsent(ev.detail);
    });
  }

  initTracking();
})();
