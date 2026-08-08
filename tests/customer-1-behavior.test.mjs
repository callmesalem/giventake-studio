import assert from "node:assert/strict";
import { createServer } from "vite";

const DEFAULT_CONSENT = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function consentEvent(detail) {
  const event = new Event("gt:consent-change");
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

function createBrowser() {
  const scripts = new Map();
  const parentNode = { insertBefore: (element) => scripts.set(element.id, element) };
  const document = {
    createElement: () => ({
      addEventListener: () => {},
      async: false,
      id: "",
      parentNode,
      src: "",
      type: "",
    }),
    getElementById: (id) => scripts.get(id),
    getElementsByTagName: () => [{ parentNode }],
    head: { appendChild: (element) => scripts.set(element.id, element) },
  };
  const window = new EventTarget();
  window.location = { pathname: "/contact" };
  return { document, window };
}

function createProviderCalls(window) {
  const calls = { fbq: [], gtag: [], linkedin: [], tiktok: [], uet: [] };
  window.fbq = (...args) => calls.fbq.push(args);
  window.gtag = (...args) => calls.gtag.push(args);
  window.lintrk = (...args) => calls.linkedin.push(args);
  window.ttq = { track: (...args) => calls.tiktok.push(args) };
  window.uetq = { push: (...args) => calls.uet.push(args) };
  return calls;
}

function clearProviderCalls(calls) {
  for (const providerCalls of Object.values(calls)) providerCalls.length = 0;
}

function contactInput(description) {
  return {
    name: "Test Person",
    email: "test@example.com",
    company: "Example Co",
    description,
    budget: "2.5-10k",
    timeline: "1-3mo",
    source: "direct",
  };
}

process.env.VITE_GOOGLE_ADS_ID = "AW-123456789";
process.env.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL = "LeadForm_abc123";
process.env.VITE_LINKEDIN_PARTNER_ID = "123456";
process.env.VITE_LINKEDIN_LEAD_CONVERSION_ID = "987654";

const browser = createBrowser();
globalThis.document = browser.document;
globalThis.window = browser.window;
const calls = createProviderCalls(browser.window);
const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { contactSchema } = await vite.ssrLoadModule("/src/lib/intake-schema.ts");
  const { createQualificationBrief } = await vite.ssrLoadModule("/src/lib/qualification-brief.ts");
  const { initTracking, trackLeadEvent } = await vite.ssrLoadModule("/src/lib/tracking.ts");

  test("contact schema accepts only enumerated budget and timeline values", () => {
    assert.equal(
      contactSchema.safeParse(contactInput("A valid project description")).success,
      true,
    );
    assert.equal(
      contactSchema.safeParse({
        ...contactInput("A valid project description"),
        budget: "Jane Doe jane@example.com",
      }).success,
      false,
    );
    assert.equal(
      contactSchema.safeParse({
        ...contactInput("A valid project description"),
        timeline: "Call Jane at 555-0100",
      }).success,
      false,
    );
  });

  test("default consent denial sends no lead events", () => {
    initTracking(() => DEFAULT_CONSENT);
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_success", {
      budget: "2.5-10k",
      timeline: "1-3mo",
      source: "direct",
    });
    assert.deepEqual(calls, { fbq: [], gtag: [], linkedin: [], tiktok: [], uet: [] });
  });

  test("explicit consent denial sends no lead events", () => {
    browser.window.dispatchEvent(consentEvent(DEFAULT_CONSENT));
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_success", { source: "direct" });
    assert.deepEqual(calls, { fbq: [], gtag: [], linkedin: [], tiktok: [], uet: [] });
  });

  test("analytics-only consent sends only a sanitized analytics event", () => {
    browser.window.dispatchEvent(consentEvent({ ...DEFAULT_CONSENT, analytics: true }));
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_success", {
      budget: "2.5-10k",
      timeline: "1-3mo",
      source: "direct",
    });
    assert.deepEqual(calls.gtag, [
      [
        "event",
        "lead_form_submit_success",
        { budget: "2.5-10k", timeline: "1-3mo", source: "direct" },
      ],
    ]);
    assert.deepEqual(calls.fbq, []);
    assert.deepEqual(calls.linkedin, []);
    assert.deepEqual(calls.tiktok, []);
    assert.deepEqual(calls.uet, []);
  });

  test("marketing-only consent sends marketing events and configured success conversions", () => {
    browser.window.dispatchEvent(consentEvent({ ...DEFAULT_CONSENT, marketing: true }));
    clearProviderCalls(calls);
    const safeProperties = { budget: "2.5-10k", timeline: "1-3mo", source: "direct" };
    trackLeadEvent("lead_form_submit_success", safeProperties);

    assert.deepEqual(calls.gtag, [
      ["event", "conversion", { send_to: "AW-123456789/LeadForm_abc123" }],
    ]);
    assert.deepEqual(calls.fbq, [["trackCustom", "lead_form_submit_success", safeProperties]]);
    assert.deepEqual(calls.tiktok, [["lead_form_submit_success", safeProperties]]);
    assert.deepEqual(calls.uet, [["event", "lead_form_submit_success", safeProperties]]);
    assert.deepEqual(calls.linkedin, [["track", { conversion_id: 987654 }]]);
  });

  test("vendor conversion calls are limited to successful lead submissions", () => {
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_error", { source: "direct" });
    assert.deepEqual(calls.gtag, []);
    assert.deepEqual(calls.linkedin, []);
  });

  test("runtime consent changes stop provider events immediately", () => {
    browser.window.dispatchEvent(consentEvent(DEFAULT_CONSENT));
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_success", { source: "direct" });
    assert.deepEqual(calls, { fbq: [], gtag: [], linkedin: [], tiktok: [], uet: [] });
  });

  test("tracking independently omits unsafe values and personal-looking fields", () => {
    browser.window.dispatchEvent(consentEvent({ ...DEFAULT_CONSENT, analytics: true }));
    clearProviderCalls(calls);
    trackLeadEvent("lead_form_submit_success", {
      budget: "Jane Doe jane@example.com",
      timeline: "Call 555-0100 tomorrow",
      source: "jane@example.com",
      path: "/customers/jane-doe?email=jane@example.com",
      email: "jane@example.com",
      name: "Jane Doe",
    });
    assert.deepEqual(calls.gtag, [["event", "lead_form_submit_success", {}]]);
  });

  test("offer matching uses specific evidence and leaves unclear requests uncertain", () => {
    const cases = [
      [
        "We need a new marketing website and CMS for our business that our team can update.",
        "A marketing site your team can actually update",
      ],
      [
        "We need lead intake that classifies new enquiries and routes each form submission.",
        "AI lead intake and routing",
      ],
      [
        "Replace our spreadsheets with a dashboard for invoice and job status tracking.",
        "Replace your spreadsheets with one dashboard",
      ],
      ["We need help improving how our team works.", "Uncertain"],
    ];

    for (const [description, expected] of cases) {
      assert.equal(createQualificationBrief(contactInput(description)).offerMatch, expected);
    }
  });

  test("regulated detection covers healthcare, banking, and credential variants", () => {
    for (const description of [
      "A healthcare scheduling workflow for our clinic.",
      "A banking dashboard for internal operations.",
      "A portal that stores customer credentials.",
    ]) {
      assert.ok(createQualificationBrief(contactInput(description)).flags.includes("regulated"));
    }
  });

  test("invalid conversion identifiers are skipped silently", async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalGoogleLabel = process.env.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL;
    const originalLinkedInId = process.env.VITE_LINKEDIN_LEAD_CONVERSION_ID;
    const invalidBrowser = createBrowser();
    const invalidCalls = createProviderCalls(invalidBrowser.window);
    let invalidVite;

    try {
      process.env.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL = "Jane Doe jane@example.com";
      process.env.VITE_LINKEDIN_LEAD_CONVERSION_ID = "not-a-number";
      globalThis.window = invalidBrowser.window;
      globalThis.document = invalidBrowser.document;
      invalidVite = await createServer({
        envFile: false,
        logLevel: "silent",
        server: { middlewareMode: true },
      });
      const invalidTracking = await invalidVite.ssrLoadModule("/src/lib/tracking.ts");
      invalidTracking.initTracking(() => ({ ...DEFAULT_CONSENT, marketing: true }));
      clearProviderCalls(invalidCalls);
      invalidTracking.trackLeadEvent("lead_form_submit_success", { source: "direct" });
      assert.deepEqual(invalidCalls.gtag, []);
      assert.deepEqual(invalidCalls.linkedin, []);
    } finally {
      await invalidVite?.close();
      process.env.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL = originalGoogleLabel;
      process.env.VITE_LINKEDIN_LEAD_CONVERSION_ID = originalLinkedInId;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    }
  });

  let failures = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failures > 0) process.exitCode = 1;
} finally {
  await vite.close();
  delete globalThis.document;
  delete globalThis.window;
}
