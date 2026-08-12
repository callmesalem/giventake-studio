import { describe, expect, it } from "vitest";
import { resolveAttribution } from "./attribution";

describe("resolveAttribution", () => {
  it.each([
    [
      "declared wins selection while a conflicting click id stays visible",
      { declaredSource: "referral", clickIds: { gclid: "g-1" }, utmSource: "google" },
      { source: "referral", confidence: "medium", state: "ambiguous" },
    ],
    [
      "click id beats utm",
      { declaredSource: null, clickIds: { gclid: "g-1" }, utmSource: "newsletter" },
      { source: "google_ads", confidence: "high", state: "attributed" },
    ],
    [
      "utm beats referrer",
      {
        declaredSource: null,
        clickIds: {},
        utmSource: "meta",
        referrerDomain: "google.com",
      },
      { source: "meta_ads", confidence: "medium", state: "attributed" },
    ],
    [
      "referrer is low confidence",
      {
        declaredSource: null,
        clickIds: {},
        utmSource: null,
        referrerDomain: "google.com",
      },
      { source: "google_organic", confidence: "low", state: "attributed" },
    ],
    [
      "missing evidence stays unattributed",
      { declaredSource: null, clickIds: {}, utmSource: null, referrerDomain: null },
      { source: null, confidence: "low", state: "unattributed" },
    ],
  ])("%s", (_name, evidence, expected) => {
    expect(resolveAttribution(evidence)).toMatchObject(expected);
  });

  it("preserves declared and conflicting click reason codes in canonical order", () => {
    expect(
      resolveAttribution({
        declaredSource: "referral",
        clickIds: { gclid: "g-1" },
        utmSource: "google",
      }),
    ).toEqual({
      source: "referral",
      campaignExternalId: null,
      confidence: "medium",
      state: "ambiguous",
      reasonCodes: ["declared_source:referral", "click_id:gclid"],
    });
  });

  it("makes different click providers ambiguous without treating same-provider ids as a conflict", () => {
    expect(
      resolveAttribution({
        declaredSource: null,
        clickIds: { gclid: "g-1", fbclid: "f-1" },
      }),
    ).toEqual({
      source: "google_ads",
      campaignExternalId: null,
      confidence: "medium",
      state: "ambiguous",
      reasonCodes: ["click_id:gclid", "click_id:fbclid"],
    });
    expect(
      resolveAttribution({
        declaredSource: null,
        clickIds: { gclid: "g-1", wbraid: "w-1" },
      }),
    ).toMatchObject({ source: "google_ads", confidence: "high", state: "attributed" });
  });

  it.each([
    ["google", "google_ads"],
    [" Google Ads ", "google_ads"],
    ["facebook", "meta_ads"],
    ["INSTAGRAM", "meta_ads"],
    ["meta", "meta_ads"],
    ["referral", "referral"],
    ["organic", "organic"],
    ["direct", "direct"],
    ["unrecognized source", "other"],
  ])("normalizes declared source %s", (declaredSource, source) => {
    expect(resolveAttribution({ declaredSource, clickIds: {} }).source).toBe(source);
  });

  it("keeps direct and unknown evidence low confidence", () => {
    expect(resolveAttribution({ declaredSource: "direct", clickIds: {} })).toMatchObject({
      source: "direct",
      confidence: "low",
      state: "attributed",
    });
    expect(resolveAttribution({ declaredSource: "not in the map", clickIds: {} })).toMatchObject({
      source: "other",
      confidence: "low",
      state: "attributed",
    });
  });

  it("returns only sanitized bounded campaign evidence", () => {
    const campaign = `  launch-${"x".repeat(250)}\u0000  `;
    const result = resolveAttribution({
      declaredSource: null,
      clickIds: {},
      utmSource: " Newsletter ",
      utmCampaign: campaign,
    });

    expect(result).toMatchObject({
      source: "other",
      confidence: "medium",
      state: "attributed",
      reasonCodes: ["utm_source:other"],
    });
    expect(result.campaignExternalId).toHaveLength(200);
    expect(
      Array.from(result.campaignExternalId ?? "").every((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      }),
    ).toBe(true);
  });

  it("ignores empty or invalid click references instead of resolving a person", () => {
    expect(
      resolveAttribution({
        declaredSource: null,
        clickIds: { gclid: "  ", fbclid: "x".repeat(201) },
      }),
    ).toEqual({
      source: null,
      campaignExternalId: null,
      confidence: "low",
      state: "unattributed",
      reasonCodes: ["direct_or_unknown"],
    });
  });
});
