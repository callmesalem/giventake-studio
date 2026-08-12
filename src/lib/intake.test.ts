import { describe, expect, it, vi } from "vitest";
import type { LeadEventV1 } from "@giventake/growth-os-contract";
import type { ContactInput } from "./intake-schema";
import { deliverContactWith, formatContactEmail } from "./intake";

const REQUEST_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const contact = {
  name: "Test Lead",
  email: "lead@example.com",
  description: "Needs a privacy-safe intake website.",
  budget: "2.5-10k",
  timeline: "1-3mo",
  source: "google_search",
  landing_page: "https://giventakedevs.com/contact",
  consent_receipt: {
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
} satisfies ContactInput;

const event = { event_id: "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4" } as LeadEventV1;

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requestId: () => REQUEST_ID,
    buildEvent: vi.fn().mockReturnValue(event),
    sendEmail: vi.fn().mockResolvedValue({ status: "unconfigured" }),
    sendGrowthOs: vi.fn().mockResolvedValue("unconfigured"),
    logStatus: vi.fn(),
    ...overrides,
  };
}

describe("deliverContactWith", () => {
  it("returns sent when email succeeds even if Growth OS fails", async () => {
    const sendEmail = vi.fn().mockResolvedValue({ status: "sent" });
    const sendGrowthOs = vi.fn().mockRejectedValue(new Error("growth unavailable"));
    const deps = dependencies({ sendEmail, sendGrowthOs });

    await expect(deliverContactWith(contact, deps)).resolves.toEqual({ status: "sent" });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendGrowthOs).toHaveBeenCalledOnce();
  });

  it("returns sent when Growth OS accepts even if email fails", async () => {
    const sendEmail = vi
      .fn()
      .mockResolvedValue({ status: "error", message: "Please email us directly." });
    const sendGrowthOs = vi.fn().mockResolvedValue("accepted");

    await expect(
      deliverContactWith(contact, dependencies({ sendEmail, sendGrowthOs })),
    ).resolves.toEqual({ status: "sent" });
  });

  it("returns unconfigured only when both destinations are unavailable", async () => {
    await expect(deliverContactWith(contact, dependencies())).resolves.toEqual({
      status: "unconfigured",
    });
  });

  it("uses the existing error fallback only when neither destination succeeds", async () => {
    const deps = dependencies({
      sendEmail: vi.fn().mockRejectedValue(new Error("mail unavailable")),
      sendGrowthOs: vi.fn().mockRejectedValue(new Error("growth unavailable")),
    });

    await expect(deliverContactWith(contact, deps)).resolves.toEqual({
      status: "error",
      message: "We couldn't send that. Please email us directly.",
    });
    expect(deps.logStatus.mock.calls).toEqual([
      ["email", "failed", REQUEST_ID],
      ["growth_os", "failed", REQUEST_ID],
    ]);
    expect(JSON.stringify(deps.logStatus.mock.calls)).not.toContain(contact.email);
    expect(JSON.stringify(deps.logStatus.mock.calls)).not.toContain(contact.description);
  });
});

describe("formatContactEmail", () => {
  it("keeps only the referrer hostname", () => {
    const formatted = formatContactEmail({
      ...contact,
      referrer: "https://www.google.com/search?q=private-query#results",
    });

    expect(formatted.text).toContain("Referrer domain: www.google.com");
    expect(formatted.text).not.toContain("private-query");
  });
});
