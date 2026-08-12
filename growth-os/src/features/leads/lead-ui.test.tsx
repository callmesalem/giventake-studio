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

  it("uses POST local state for exact lookup and keeps PII out of actions and hrefs", async () => {
    const lookupLeads = vi.fn().mockResolvedValue({ ...page, nextCursor: "lookup-next" });
    render(
      <LeadList
        filters={{ status: "qualified", source: "google" }}
        lookupLeads={lookupLeads}
        page={page}
      />,
    );

    const lookupForm = screen.getByRole("form", { name: "Exact lead lookup" });
    expect(lookupForm).toHaveAttribute("method", "post");
    fireEvent.change(screen.getByLabelText("Exact email"), {
      target: { value: "private@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Exact phone"), {
      target: { value: "+1 555 010 0199" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search leads" }));

    await waitFor(() =>
      expect(lookupLeads).toHaveBeenCalledWith({
        exactEmail: "private@example.com",
        exactPhone: "+1 555 010 0199",
        limit: 25,
        source: "google",
        status: "qualified",
      }),
    );
    for (const link of screen.queryAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(
        /private%40example\.com|private@example\.com|555|exactEmail|exactPhone/,
      );
    }

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(lookupLeads).toHaveBeenLastCalledWith({
        cursor: "lookup-next",
        exactEmail: "private@example.com",
        exactPhone: "+1 555 010 0199",
        limit: 25,
        source: "google",
        status: "qualified",
      }),
    );
  });

  it("renders support lead lists as clearly read-only", () => {
    render(<LeadList page={page} readOnly />);

    expect(screen.getByText("Support session: read-only")).toBeVisible();
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

  it("shows a manual attribution correction without hiding the computed result", () => {
    render(
      <LeadDetailView
        lead={{
          ...detail,
          firstTouch: {
            source: "google_ads",
            confidence: "high",
            state: "attributed",
            original: { source: "referral", confidence: "medium", state: "ambiguous" },
            correction: {
              source: "google_ads",
              confidence: "high",
              state: "attributed",
              reason: "Customer confirmed the paid Google source.",
            },
          },
        }}
      />,
    );

    expect(screen.getByText(/Computed: referral \/ Medium \/ Ambiguous/)).toBeVisible();
    expect(screen.getByText(/Correction: google_ads \/ High \/ Attributed/)).toBeVisible();
    expect(screen.getByText("Customer confirmed the paid Google source.")).toBeVisible();
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

  it("hides every mutation control during support and renders read-only state", () => {
    render(<LeadDetailView lead={detail} readOnly />);

    expect(screen.getByText("Support session: read-only")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reopen lead" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record revenue" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reopen reason")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirmed revenue")).not.toBeInTheDocument();
  });

  it("waits for route data refresh before showing mutation success", async () => {
    let finishRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const saveReopen = vi.fn().mockResolvedValue({ status: "booked" as const });
    render(<LeadDetailView lead={detail} refresh={refresh} saveReopen={saveReopen} />);

    fireEvent.change(screen.getByLabelText("Reopen reason"), {
      target: { value: "Customer restarted the project discussion." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reopen lead" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
    finishRefresh?.();
    await waitFor(() => expect(screen.getByText("Saved.")).toBeVisible());
  });

  it("uses the selected currency exponent when submitting revenue", async () => {
    const saveRevenue = vi.fn().mockResolvedValue({
      amountMinor: "1234",
      currency: "BHD",
      confirmedAt: "2026-08-12",
    });
    render(<LeadDetailView lead={detail} saveRevenue={saveRevenue} />);

    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "BHD" } });
    fireEvent.change(screen.getByLabelText("Confirmed revenue"), {
      target: { value: "1.234" },
    });
    fireEvent.change(screen.getByLabelText("Confirmation date"), {
      target: { value: "2026-08-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record revenue" }));

    await waitFor(() =>
      expect(saveRevenue).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMinor: "1234",
          currency: "BHD",
        }),
      ),
    );
  });
});
