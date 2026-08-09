import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthenticatedLayout } from "../../routes/_app";
import { BrandSettingsForm } from "../../routes/_app.settings";
import { SupportSessionForm } from "../../routes/admin.support";

const brand = {
  displayName: "Pilot Adjusters",
  logoUrl: "https://cdn.example.com/pilot.svg",
  primaryColor: "#0057b8",
  accentColor: "#f4b400",
  onPrimaryColor: "#ffffff",
  reportName: "Pilot Growth Report",
};

describe("authenticated brand layout", () => {
  it("scopes brand CSS variables to the authenticated layout element", () => {
    render(<AuthenticatedLayout brand={brand} content={<p>Workspace</p>} />);

    const layout = screen.getByTestId("authenticated-layout");
    expect(layout.style.getPropertyValue("--brand-primary")).toBe("#0057b8");
    expect(layout.style.getPropertyValue("--brand-accent")).toBe("#f4b400");
    expect(layout.style.getPropertyValue("--brand-on-primary")).toBe("#ffffff");
    expect(document.documentElement.style.getPropertyValue("--brand-primary")).toBe("");
    expect(document.body.style.getPropertyValue("--brand-primary")).toBe("");
  });
});

describe("brand settings", () => {
  it("uses real color controls and submits normalized settings", async () => {
    const saveBrand = vi.fn().mockResolvedValue({ updated: true });
    render(<BrandSettingsForm brand={brand} saveBrand={saveBrand} />);

    expect(screen.getByLabelText("Primary color")).toHaveAttribute("type", "color");
    expect(screen.getByLabelText("Accent color")).toHaveAttribute("type", "color");
    expect(screen.getByLabelText("Text on primary")).toHaveAttribute("type", "color");
    fireEvent.click(screen.getByRole("button", { name: "Save brand" }));

    await waitFor(() => expect(saveBrand).toHaveBeenCalledWith(brand));
  });
});

describe("support administration", () => {
  it("submits a tenant-specific reason and bounded duration", async () => {
    const beginSupport = vi.fn().mockResolvedValue({
      sessionId: "22222222-2222-2222-2222-222222222222",
      expiresAt: "2026-08-09T16:30:00.000Z",
    });
    render(
      <SupportSessionForm
        tenants={[{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", displayName: "Pilot Adjusters" }]}
        beginSupport={beginSupport}
        onStarted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Support reason"), {
      target: { value: "Investigating a reported dashboard discrepancy." },
    });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Start support" }));

    await waitFor(() =>
      expect(beginSupport).toHaveBeenCalledWith({
        tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        reason: "Investigating a reported dashboard discrepancy.",
        durationMinutes: 30,
      }),
    );
  });
});
