import { describe, expect, it } from "vitest";
import { leadEventV1Schema } from "./index";

const valid = {
  schema_version: 1,
  event_id: "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4",
  occurred_at: "2026-08-09T16:00:00.000Z",
  lead: {
    name: "Test Lead",
    email: "lead@example.com",
    company: "Example Service",
    phone: null,
    notes: "Needs a new intake website.",
    budget_range: "5k-10k",
    timeline_range: "1-2-months",
  },
  attribution: {
    declared_source: "google",
    source_detail: null,
    landing_page: "https://giventakedevs.com/",
    offer_id: "project-brief",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch",
    utm_content: null,
    utm_term: null,
    referrer_domain: "google.com",
    click_ids: { gclid: "safe-click-id" },
  },
  consent: {
    policy_version: "privacy-2026-08-08",
    source: "contact-form",
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
    contact_requested: true,
    gpc: false,
    recorded_at: "2026-08-09T16:00:00.000Z",
  },
};

describe("leadEventV1Schema", () => {
  it("accepts a necessary lead when optional tracking consent is denied", () => {
    expect(leadEventV1Schema.parse(valid).consent.marketing).toBe(false);
  });

  it.each(["ip", "latitude", "longitude", "fingerprint", "advertising_id"])(
    "rejects prohibited field %s",
    (field) => {
      expect(() => leadEventV1Schema.parse({ ...valid, [field]: "forbidden" })).toThrow();
    },
  );

  it("rejects personal data inside attribution evidence", () => {
    expect(() =>
      leadEventV1Schema.parse({
        ...valid,
        attribution: { ...valid.attribution, email: "lead@example.com" },
      }),
    ).toThrow();
  });
});
