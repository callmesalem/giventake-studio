import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadDetailRouteContent } from "../../routes/_app.leads.$leadId";
import { LeadListRouteContent } from "../../routes/_app.leads";
import type { LeadDetail, LeadListPage } from "./lead.schemas";

const item = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  name: "Test Lead",
  email: "lead@example.com",
  company: null,
  status: "won" as const,
  declaredSource: "direct",
  confidence: "low" as const,
  confirmedRevenueMinor: null,
  confirmedRevenueCurrency: null,
  occurredAt: "2026-08-09T16:00:00.000Z",
  lastActivityAt: "2026-08-10T16:00:00.000Z",
};

const page: LeadListPage = { items: [item], nextCursor: null };
const detail: LeadDetail = {
  ...item,
  phone: null,
  notes: "Follow up requested.",
  budgetRange: "5k-10k",
  timelineRange: "1-2-months",
  firstTouch: null,
  lastTouch: null,
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
  audit: [],
};

afterEach(cleanup);

describe("lead route support capability", () => {
  it("threads support read-only state into the list route content", () => {
    render(
      <LeadListRouteContent
        filters={{}}
        page={page}
        supportSession={{ expiresAt: "2026-08-12T17:00:00.000Z" }}
      />,
    );

    expect(screen.getByText("Support session: read-only")).toBeVisible();
  });

  it("threads support read-only and refresh into detail route content", () => {
    render(
      <LeadDetailRouteContent
        lead={detail}
        refresh={vi.fn().mockResolvedValue(undefined)}
        supportSession={{ expiresAt: "2026-08-12T17:00:00.000Z" }}
      />,
    );

    expect(screen.getByText("Support session: read-only")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Record revenue" })).not.toBeInTheDocument();
  });
});
