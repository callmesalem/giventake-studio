/* Client-site app logic. Vanilla JS, no dependencies.
 *
 * Responsibilities:
 *  - read the inert client config JSON
 *  - consent banner (accept/decline, persisted, nothing tracked before a choice)
 *  - UTM attribution capture from the landing URL
 *  - lead form: validation, honeypot, idempotency key, client-side throttle,
 *    POST to /api/lead, PII-free dataLayer events
 *  - value-tool slot wiring: attachValueToolResult(obj)
 */

(function () {
  'use strict';

  /* ---------- config ---------- */
  function readConfig() {
    var el = document.getElementById('client-config');
    if (!el) return {};
    try { return JSON.parse(el.textContent || '{}'); } catch (e) { return {}; }
  }
  var CONFIG = readConfig();

  /* ---------- dataLayer (PII-free) ---------- */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    // Never put contact data (name, email, phone, message) in here.
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
  }

  /* ---------- consent ---------- */
  var CONSENT_KEY = 'gt-consent';
  function getConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setConsent(state) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(state)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('gt:consent', { detail: state }));
  }
  function initConsentBanner() {
    var banner = document.getElementById('consent-banner');
    if (!banner) return;
    if (getConsent()) return; // choice already made: stay hidden
    banner.hidden = false;
    var accept = document.getElementById('consent-accept');
    var decline = document.getElementById('consent-decline');
    if (accept) accept.addEventListener('click', function () {
      setConsent({ necessary: true, analytics: true, marketing: true, decidedAt: new Date().toISOString() });
      banner.hidden = true;
    });
    if (decline) decline.addEventListener('click', function () {
      setConsent({ necessary: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() });
      banner.hidden = true;
    });
  }

  /* ---------- attribution ---------- */
  var ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var ATTR_KEY = 'gt-attribution';
  function clean(value) {
    if (typeof value !== 'string') return undefined;
    var t = value.trim().slice(0, 150);
    return t ? t : undefined;
  }
  function captureAttribution() {
    // Record once per session, on the landing page, so later page views
    // do not overwrite the first-touch source.
    try {
      if (sessionStorage.getItem(ATTR_KEY)) return;
    } catch (e) { /* storage unavailable: capture per submit instead */ }
    var params = new URLSearchParams(window.location.search);
    var attr = {};
    ATTRIBUTION_KEYS.forEach(function (key) {
      var v = clean(params.get(key));
      if (v) attr[key] = v;
    });
    var ref = clean(document.referrer);
    if (ref) attr.referrer = ref;
    try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr)); } catch (e) {}
  }
  function getAttribution() {
    try {
      var raw = sessionStorage.getItem(ATTR_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  /* ---------- value-tool slot ---------- */
  var valueToolResult = null;
  window.attachValueToolResult = function (obj) {
    valueToolResult = obj || null;
    var hidden = document.getElementById('lf-value-tool');
    if (hidden) {
      try { hidden.value = JSON.stringify(valueToolResult).slice(0, 2000); }
      catch (e) { hidden.value = ''; }
    }
    track('value_tool_complete', {});
  };

  /* ---------- tracked clicks ---------- */
  function initTrackedClicks() {
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-track]') : null;
      if (!el) return;
      var name = el.getAttribute('data-track');
      if (name === 'lead_form_submit') return; // handled on submit with outcome
      track(name, { label: el.getAttribute('data-track-label') || undefined });
    });
  }

  /* ---------- lead form ---------- */
  var THROTTLE_KEY = 'gt-lead-throttle';
  function throttleOk() {
    var now = Date.now();
    var stamps;
    try { stamps = JSON.parse(localStorage.getItem(THROTTLE_KEY) || '[]'); }
    catch (e) { stamps = []; }
    stamps = stamps.filter(function (t) { return now - t < 10 * 60 * 1000; });
    if (stamps.length >= 3) return false;
    stamps.push(now);
    try { localStorage.setItem(THROTTLE_KEY, JSON.stringify(stamps)); } catch (e) {}
    return true;
  }

  function initLeadForm() {
    var form = document.getElementById('lead-form');
    if (!form) return;
    var note = document.getElementById('lead-form-note');

    function say(msg, ok) {
      if (!note) return;
      note.textContent = msg;
      note.className = 'form-note ' + (ok ? 'ok' : 'err');
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var email = String(data.get('email') || '').trim();
      var phone = String(data.get('phone') || '').trim();
      var service = String(data.get('service') || '').trim();
      var message = String(data.get('message') || '').trim();
      var honeypot = String(data.get('company_website') || '').trim();
      var consent = form.querySelector('#lf-consent');

      if (!name || !email || !service || !message || !(consent && consent.checked)) {
        say('Please complete every required field and the consent checkbox.', false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say('That email address does not look valid.', false);
        return;
      }
      if (!throttleOk()) {
        say('You have sent several enquiries recently. Please wait a few minutes.', false);
        return;
      }

      // Honeypot filled: pretend success, send nothing. (Spambots get no signal.)
      if (honeypot) {
        say('Thanks. We will be in touch shortly.', true);
        track('lead_form_submit_success', { service: service });
        form.reset();
        return;
      }

      var payload = {
        request_id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        name: name.slice(0, 120),
        email: email.slice(0, 160),
        phone: phone.slice(0, 40),
        service: service,
        message: message.slice(0, 1500),
        value_tool_result: valueToolResult,
        attribution: getAttribution(),
        consent_text: consent ? (consent.closest('.field-check') ? consent.closest('.field-check').querySelector('label').textContent.trim() : '') : ''
      };

      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      say('Sending...', true);

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('bad status ' + res.status);
        return res.json();
      }).then(function () {
        say('Thanks. We will be in touch shortly.', true);
        track('lead_form_submit_success', { service: service });
        form.reset();
        valueToolResult = null;
      }).catch(function () {
        say('Something went wrong sending your enquiry. Please call us instead.', false);
        track('lead_form_submit_error', { service: service });
      }).finally(function () {
        if (btn) btn.disabled = false;
      });
    });
  }

  /* ---------- boot ---------- */
  captureAttribution();
  initConsentBanner();
  initTrackedClicks();
  initLeadForm();
})();
