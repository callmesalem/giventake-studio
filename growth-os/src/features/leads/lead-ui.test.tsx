import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadDetailView } from "./lead-detail";
import { LeadList } from "./lead-list";
import type { LeadDetail, LeadListPage } from "./lead.schemas";

const page: LeadListPage = {
  items: [
    {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      name: "Test Lead",
      email: "lead@example.com",
      company: "Example Co",
      status: "qualified",
      declaredSource: "google",
      confidence: "high",
      confirmedRevenueMinor: null,
      confirmedRevenueCurrency: null,
      occurredAt: "2026-08-09T16:00:00.000Z",
      lastActivityAt: "2026-08-10T16:00:00.000Z",
    },
  ],
  nextCursor: null,
};

const detail: LeadDetail = {
  ...page.items[0]!,
  status: "won",
  phone: "+1 555 010 0100",
  notes: "Needs a privacy-safe intake website.",
  budgetRange: "5k-10k",
  timelineRange: "1-2-months",
  firstTouch: { source: "google", confidence: "high", state: "attributed" },
  lastTouch: { source: "google", confidence: "high", state: "attributed" },
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

describe("lead list", () => {
  it("renders the dense operational columns and accessible icon controls", () => {
    render(<LeadList page={page} />);

    for (const heading of [
      "Lead",
      "Status",
      "Received",
      "Source",
      "Confidence",
      "Last activity",
      "Confirmed revenue",
    ]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: "Search leads" })).toHaveAttribute(
      "title",
      "Search leads",
    );
    expect(screen.getByRole("button", { name: "Filter leads" })).toHaveAttribute(
      "title",
      "Filter leads",
    );
    expect(screen.getByRole("button", { name: "Refresh leads" })).toHaveAttribute(
      "title",
      "Refresh leads",
    );
  });

  it("keeps active filters when advancing the cursor", () => {
    render(
      <LeadList
        filters={{ status: "qualified", source: "google" }}
        page={{ ...page, nextCursor: "next-page-token" }}
      />,
    );

    const href = screen.getByRole("link", { name: "Next page" }).getAttribute("href");
    expect(href).toContain("status=qualified");
    expect(href).toContain("source=google");
    expect(href).toContain("cursor=next-page-token");
  });
});

describe("lead detail", () => {
  it("uses a segmented status control and shows revenue only for won", () => {
    render(<LeadDetailView lead={detail} />);

    expect(screen.getByRole("group", { name: "Lead status" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Won" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Confirmed revenue")).toBeVisible();
    expect(screen.getByLabelText("Currency")).toBeVisible();
    expect(screen.getByLabelText("Confirmation date")).toBeVisible();
    expect(screen.getByText("First touch")).toBeVisible();
    expect(screen.getByText("Consent receipt")).toBeVisible();
  });

  it("submits decimal revenue as positive bigint minor units", async () => {
    const saveRevenue = vi.fn().mockResolvedValue({
      amountMinor: "350000",
      currency: "USD",
      confirmedAt: "2026-08-12",
    });
    render(<LeadDetailView lead={detail} saveRevenue={saveRevenue} />);

    fireEvent.change(screen.getByLabelText("Confirmed revenue"), {
      target: { value: "3500.00" },
    });
    fireEvent.change(screen.getByLabelText("Confirmation date"), {
      target: { value: "2026-08-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record revenue" }));

    await waitFor(() =>
      expect(saveRevenue).toHaveBeenCalledWith({
        leadId: detail.id,
        amountMinor: "350000",
        currency: "USD",
        confirmedAt: "2026-08-12",
        note: undefined,
      }),
    );
  });

  it("keeps reopen separate from terminal status transitions", () => {
    render(<LeadDetailView lead={detail} />);

    expect(screen.queryByRole("button", { name: "Qualified" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reopen reason")).toHaveAttribute("minLength", "10");
    expect(screen.getByRole("button", { name: "Reopen lead" })).toBeVisible();
  });
});
