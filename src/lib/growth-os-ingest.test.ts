import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContactInput } from "./intake-schema";
import { buildGrowthOsLeadEvent, deliverLeadToGrowthOs } from "./growth-os-ingest";

const EVENT_ID = "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4";
const NOW = new Date("2026-08-09T16:00:00.000Z");

const contact: ContactInput = {
  name: "Test Lead",
  email: "lead@example.com",
  company: "Example Service",
  description: "Needs a privacy-safe intake website.",
  budget: "2.5-10k",
  timeline: "1-3mo",
  source: "google_search",
  source_detail: "Search results",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "launch",
  utm_content: "headline-a",
  utm_term: "agency",
  referrer: "https://www.google.com/search?q=private-query#results",
  landing_page: "https://giventakedevs.com/contact?gclid=click-1#brief",
  gclid: "click-1",
  fbclid: "click-2",
  consent_receipt: {
    policy_version: "privacy-2026-08-08",
    source: "contact-form",
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: true,
    contact_requested: true,
    gpc: false,
    recorded_at: NOW.toISOString(),
  },
};

afterEach(() => {
  delete process.env.GROWTH_OS_INGEST_URL;
  delete process.env.GROWTH_OS_SITE_KEY_ID;
  delete process.env.GROWTH_OS_SITE_SIGNING_SECRET;
  vi.unstubAllGlobals();
});

describe("buildGrowthOsLeadEvent", () => {
  it("keeps only landing origin plus pathname and referrer hostname", () => {
    const event = buildGrowthOsLeadEvent(contact, { eventId: EVENT_ID, now: NOW });

    expect(event.attribution.landing_page).toBe("https://giventakedevs.com/contact");
    expect(event.attribution.referrer_domain).toBe("www.google.com");
    expect(JSON.stringify(event.attribution)).not.toContain("private-query");
  });

  it("clears click ids when marketing is false while retaining first-party context", () => {
    const event = buildGrowthOsLeadEvent(contact, { eventId: EVENT_ID, now: NOW });

    expect(event.attribution.click_ids).toEqual({});
    expect(event.attribution.utm_source).toBe("google");
    expect(event.attribution.declared_source).toBe("google_search");
    expect(event.consent.marketing).toBe(false);
  });

  it("forces marketing false and clears click ids under GPC", () => {
    const event = buildGrowthOsLeadEvent(
      {
        ...contact,
        consent_receipt: {
          ...contact.consent_receipt,
          marketing: true,
          gpc: true,
        },
      },
      { eventId: EVENT_ID, now: NOW },
    );

    expect(event.consent.marketing).toBe(false);
    expect(event.attribution.click_ids).toEqual({});
  });
});

describe("deliverLeadToGrowthOs", () => {
  it("reads configuration at call time and returns unconfigured when any value is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const event = buildGrowthOsLeadEvent(contact, { eventId: EVENT_ID, now: NOW });

    await expect(deliverLeadToGrowthOs(event)).resolves.toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.GROWTH_OS_INGEST_URL = "https://app.giventakedevs.com/api/ingest/v1/leads";
    process.env.GROWTH_OS_SITE_KEY_ID = "site-key-test-1";
    process.env.GROWTH_OS_SITE_SIGNING_SECRET = "website-signing-secret-at-least-32-bytes";
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    await expect(deliverLeadToGrowthOs(event)).resolves.toBe("accepted");
  });

  it("signs the exact raw JSON body only on the server", async () => {
    const secret = "website-signing-secret-at-least-32-bytes";
    process.env.GROWTH_OS_INGEST_URL = "https://app.giventakedevs.com/api/ingest/v1/leads";
    process.env.GROWTH_OS_SITE_KEY_ID = "site-key-test-1";
    process.env.GROWTH_OS_SITE_SIGNING_SECRET = secret;
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const event = buildGrowthOsLeadEvent(contact, { eventId: EVENT_ID, now: NOW });

    await expect(deliverLeadToGrowthOs(event)).resolves.toBe("duplicate");

    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    const headers = new Headers(init.headers);
    const body = init.body as string;
    const timestamp = headers.get("X-GT-Timestamp")!;
    const expected = `sha256=${createHmac("sha256", secret)
      .update(`${timestamp}\n${EVENT_ID}\n${body}`, "utf8")
      .digest("hex")}`;
    expect(headers.get("X-GT-Key-Id")).toBe("site-key-test-1");
    expect(headers.get("X-GT-Idempotency-Key")).toBe(EVENT_ID);
    expect(headers.get("X-GT-Signature")).toBe(expected);
    expect(JSON.parse(body)).toEqual(event);
  });
});
